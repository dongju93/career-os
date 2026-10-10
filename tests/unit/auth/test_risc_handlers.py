from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from psycopg import AsyncConnection

import career_os_api.auth.risc_handlers as handlers_module
from career_os_api.auth.dependencies import _is_current_user_session
from career_os_api.auth.risc import (
    EVENT_ACCOUNT_DISABLED,
    EVENT_ACCOUNT_ENABLED,
    EVENT_ACCOUNT_PURGED,
    EVENT_CREDENTIAL_CHANGE_REQUIRED,
    EVENT_SESSIONS_REVOKED,
    EVENT_TOKEN_REVOKED,
    EVENT_TOKENS_REVOKED,
    EVENT_VERIFICATION,
    RiscEvent,
)
from career_os_api.config import settings
from career_os_api.database.users import (
    RiscAccountState,
    RiscAccountStateRow,
    UserRow,
)

_GOOGLE_ID = "google-user-1"
_T0 = 1_700_000_000


def _event(
    *,
    event_type: str,
    jti: str = "jti-1",
    google_id: str | None = _GOOGLE_ID,
    reason: str | None = None,
    state: str | None = None,
    issued_at: int = _T0,
) -> RiscEvent:
    return RiscEvent(
        jti=jti,
        event_type=event_type,
        issued_at=issued_at,
        google_id=google_id,
        reason=reason,
        state=state,
    )


class _FakeConnection:
    def __init__(self) -> None:
        self.transactions = 0

    @asynccontextmanager
    async def transaction(self):
        self.transactions += 1
        yield


@pytest.fixture
def fake_conn() -> AsyncConnection:
    return cast(AsyncConnection, _FakeConnection())


class _FakeUserStore:
    """In-memory stand-in for the users/risc_events tables touched by RISC."""

    def __init__(self) -> None:
        self.seen_jtis: set[str] = set()
        self.user: UserRow = {
            "id": UUID("00000000-0000-0000-0000-000000000001"),
            "google_id": _GOOGLE_ID,
            "email": "x@example.com",
            "name": None,
            "picture": None,
            "is_active": True,
            "auth_session_revoked_at": None,
        }
        self.state: RiscAccountStateRow = {
            "risc_account_state": None,
            "risc_account_state_at": None,
        }
        self.deleted = False
        self.delete_calls: list[str] = []
        self.anonymized_google_ids: list[str] = []
        self.retention_days_swept: list[int] = []
        self.purged_subjects: set[str] = set()

    def _has_user(self, google_id: str) -> bool:
        return google_id == _GOOGLE_ID and not self.deleted

    async def record(self, _conn, *, jti: str, **_kwargs) -> bool:
        if jti in self.seen_jtis:
            return False
        self.seen_jtis.add(jti)
        return True

    async def delete_user(self, _conn, google_id: str) -> bool:
        assert google_id in self.purged_subjects
        self.delete_calls.append(google_id)
        if not self._has_user(google_id):
            return False
        self.deleted = True
        return True

    async def mark_purged(self, _conn, google_id: str) -> None:
        self.purged_subjects.add(google_id)

    async def anonymize(self, _conn, google_id: str) -> None:
        self.anonymized_google_ids.append(google_id)

    async def sweep(self, _conn, *, retention_days: int) -> None:
        self.retention_days_swept.append(retention_days)

    async def lock(self, _conn, google_id: str) -> RiscAccountStateRow | None:
        return self.state.copy() if self._has_user(google_id) else None

    async def revoke(self, _conn, google_id: str) -> UserRow | None:
        if not self._has_user(google_id):
            return None
        self.user["auth_session_revoked_at"] = datetime.now(UTC)
        return self.user

    async def set_state(
        self,
        _conn,
        google_id: str,
        *,
        state: RiscAccountState,
        issued_at: datetime,
    ) -> UserRow | None:
        if not self._has_user(google_id):
            return None
        self.user["is_active"] = state is RiscAccountState.ENABLED
        self.state = {
            "risc_account_state": state.value,
            "risc_account_state_at": issued_at,
        }
        return self.user


@pytest.fixture
def store(monkeypatch: pytest.MonkeyPatch) -> _FakeUserStore:
    fake = _FakeUserStore()
    monkeypatch.setattr(handlers_module, "record_risc_event", fake.record)
    monkeypatch.setattr(handlers_module, "delete_expired_risc_events", fake.sweep)
    monkeypatch.setattr(handlers_module, "delete_user_by_google_id", fake.delete_user)
    monkeypatch.setattr(
        handlers_module, "record_google_subject_purge", fake.mark_purged
    )
    monkeypatch.setattr(
        handlers_module, "anonymize_risc_events_by_google_id", fake.anonymize
    )
    monkeypatch.setattr(
        handlers_module, "lock_user_risc_account_state_by_google_id", fake.lock
    )
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", fake.revoke
    )
    monkeypatch.setattr(
        handlers_module, "set_user_risc_account_state_by_google_id", fake.set_state
    )
    return fake


def _stale_token_iat() -> int:
    # A credential minted well before any RISC event in these tests is handled.
    return int(datetime.now(UTC).timestamp()) - 3600


# ── Account-state events ─────────────────────────────────────────────────────


async def test_disable_event_deactivates_and_revokes_atomically(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_DISABLED)
    )

    assert cast(_FakeConnection, fake_conn).transactions == 1
    assert store.user["is_active"] is False
    assert store.user["auth_session_revoked_at"] is not None
    assert store.state == {
        "risc_account_state": RiscAccountState.DISABLED.value,
        "risc_account_state_at": datetime.fromtimestamp(_T0, UTC),
    }


async def test_enable_after_disable_does_not_revive_pre_disable_credential(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    stale_iat = _stale_token_iat()
    assert _is_current_user_session(store.user, stale_iat)

    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_DISABLED, jti="d", issued_at=_T0)
    )
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_ENABLED, jti="e", issued_at=_T0 + 60),
    )

    assert store.user["is_active"] is True
    assert store.state["risc_account_state"] == RiscAccountState.ENABLED
    assert not _is_current_user_session(store.user, stale_iat)
    assert _is_current_user_session(store.user, int(datetime.now(UTC).timestamp()) + 1)


async def test_out_of_order_enable_older_than_disable_is_ignored(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_DISABLED, jti="d", issued_at=_T0 + 60),
    )
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_ENABLED, jti="e", issued_at=_T0)
    )

    assert store.user["is_active"] is False
    assert store.state["risc_account_state"] == RiscAccountState.DISABLED


async def test_late_disable_older_than_enable_keeps_account_but_revokes(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    stale_iat = _stale_token_iat()

    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_ENABLED, jti="e", issued_at=_T0 + 60),
    )
    store.user["auth_session_revoked_at"] = None
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_DISABLED, jti="d", issued_at=_T0)
    )

    assert store.user["is_active"] is True
    assert store.state["risc_account_state"] == RiscAccountState.ENABLED
    assert not _is_current_user_session(store.user, stale_iat)


async def test_account_purged_deletes_user_and_anonymizes_audit_rows(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_PURGED, jti="p", issued_at=_T0)
    )

    assert cast(_FakeConnection, fake_conn).transactions == 1
    assert store.deleted is True
    assert store.anonymized_google_ids == [_GOOGLE_ID]
    assert store.purged_subjects == {_GOOGLE_ID}
    assert store.seen_jtis == {"p"}
    assert store.state == {"risc_account_state": None, "risc_account_state_at": None}


async def test_enable_after_purge_does_not_recreate_or_reactivate_user(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_PURGED, jti="p", issued_at=_T0)
    )
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_ENABLED, jti="e", issued_at=_T0 + 60),
    )

    assert store.deleted is True
    assert store.state == {"risc_account_state": None, "risc_account_state_at": None}
    assert store.user["auth_session_revoked_at"] is None


async def test_purge_for_unknown_google_id_still_anonymizes_and_does_not_raise(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_PURGED, google_id="someone-else"),
    )

    assert cast(_FakeConnection, fake_conn).transactions == 1
    assert store.deleted is False
    assert store.delete_calls == ["someone-else"]
    assert store.purged_subjects == {"someone-else"}
    assert store.anonymized_google_ids == ["someone-else"]
    assert store.user["is_active"] is True


async def test_duplicate_purge_jti_does_nothing(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_PURGED, jti="p")
    )
    # Google retries the same purge delivery with the same jti.
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_PURGED, jti="p")
    )

    assert store.delete_calls == [_GOOGLE_ID]
    assert store.anonymized_google_ids == [_GOOGLE_ID]


async def test_duplicate_enable_jti_is_not_reapplied(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_ENABLED, jti="e", issued_at=_T0)
    )
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_DISABLED, jti="d", issued_at=_T0 + 60),
    )
    # Google retries the original enable with the same jti.
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_ENABLED, jti="e", issued_at=_T0)
    )

    assert store.user["is_active"] is False
    assert store.state["risc_account_state"] == RiscAccountState.DISABLED


async def test_account_state_event_for_unknown_user_is_noop(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_DISABLED, google_id="someone-else"),
    )

    assert store.user["is_active"] is True
    assert store.user["auth_session_revoked_at"] is None
    assert store.state["risc_account_state"] is None


_AT = datetime.fromtimestamp(_T0, UTC)
_LATER = datetime.fromtimestamp(_T0 + 1, UTC)
_EARLIER = datetime.fromtimestamp(_T0 - 1, UTC)


@pytest.mark.parametrize(
    ("current_state", "new_state", "issued_at", "expected"),
    [
        (None, RiscAccountState.ENABLED, _EARLIER, True),
        (None, RiscAccountState.DISABLED, _EARLIER, True),
        (RiscAccountState.DISABLED, RiscAccountState.ENABLED, _LATER, True),
        (RiscAccountState.DISABLED, RiscAccountState.ENABLED, _AT, False),
        (RiscAccountState.DISABLED, RiscAccountState.ENABLED, _EARLIER, False),
        (RiscAccountState.ENABLED, RiscAccountState.DISABLED, _AT, True),
        (RiscAccountState.ENABLED, RiscAccountState.DISABLED, _EARLIER, False),
    ],
)
def test_supersedes_account_state(
    current_state: RiscAccountState | None,
    new_state: RiscAccountState,
    issued_at: datetime,
    expected: bool,
) -> None:
    current: RiscAccountStateRow = {
        "risc_account_state": current_state.value if current_state else None,
        "risc_account_state_at": _AT if current_state else None,
    }

    assert (
        handlers_module._supersedes_account_state(current, new_state, issued_at)
        is expected
    )


# ── Other events ─────────────────────────────────────────────────────────────


async def test_every_risc_event_runs_retention_sweep(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_VERIFICATION, google_id=None)
    )
    # A duplicate jti still goes through the sweep before being ignored.
    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_VERIFICATION, google_id=None)
    )

    assert store.retention_days_swept == [
        settings.risc_event_retention_days,
        settings.risc_event_retention_days,
    ]


async def test_apply_verification_event_is_audit_only(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_VERIFICATION, google_id=None, state="state-1"),
    )

    assert store.seen_jtis == {"jti-1"}
    assert store.user["auth_session_revoked_at"] is None
    assert store.state["risc_account_state"] is None


@pytest.mark.parametrize(
    "event_type",
    [EVENT_CREDENTIAL_CHANGE_REQUIRED, EVENT_SESSIONS_REVOKED, EVENT_TOKENS_REVOKED],
)
async def test_risc_revocation_rejects_same_second_sessions(
    event_type: str,
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(fake_conn, _event(event_type=event_type))

    revoked_at = store.user["auth_session_revoked_at"]
    assert revoked_at is not None
    cutoff = revoked_at.timestamp()
    assert not _is_current_user_session(store.user, int(cutoff))
    assert not _is_current_user_session(store.user, cutoff - 0.000001)
    assert not _is_current_user_session(store.user, cutoff)
    assert _is_current_user_session(store.user, cutoff + 0.000001)


@pytest.mark.parametrize(
    "event_type",
    [EVENT_CREDENTIAL_CHANGE_REQUIRED, EVENT_SESSIONS_REVOKED, EVENT_TOKENS_REVOKED],
)
async def test_apply_session_token_revocations_revoke_user_sessions(
    event_type: str,
    fake_conn: AsyncConnection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    record = AsyncMock(return_value=True)
    sweep = AsyncMock()
    set_state = AsyncMock()
    revoke_sessions = AsyncMock(return_value=None)
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "delete_expired_risc_events", sweep)
    monkeypatch.setattr(
        handlers_module, "set_user_risc_account_state_by_google_id", set_state
    )
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(fake_conn, _event(event_type=event_type))

    record.assert_awaited_once()
    revoke_sessions.assert_awaited_once_with(fake_conn, _GOOGLE_ID)
    set_state.assert_not_awaited()


async def test_apply_token_revoked_is_audit_only(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_TOKEN_REVOKED, google_id=None),
    )

    assert store.seen_jtis == {"jti-1"}
    assert store.user["auth_session_revoked_at"] is None
    assert store.state["risc_account_state"] is None


async def test_apply_duplicate_jti_skips_user_mutation(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    store.seen_jtis.add("jti-1")

    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_DISABLED)
    )

    assert store.user["is_active"] is True
    assert store.user["auth_session_revoked_at"] is None
    assert store.state["risc_account_state"] is None


async def test_apply_subject_less_non_verification_event_skips_user_mutation(
    fake_conn: AsyncConnection,
    store: _FakeUserStore,
) -> None:
    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_DISABLED, google_id=None),
    )

    assert store.seen_jtis == {"jti-1"}
    assert store.user["is_active"] is True
    assert store.state["risc_account_state"] is None
