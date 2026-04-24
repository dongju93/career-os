from typing import cast
from unittest.mock import AsyncMock

import pytest
from psycopg import AsyncConnection

import career_os_api.auth.risc_handlers as handlers_module
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


def _event(
    *,
    event_type: str,
    jti: str = "jti-1",
    google_id: str | None = "google-user-1",
    reason: str | None = None,
    state: str | None = None,
) -> RiscEvent:
    return RiscEvent(
        jti=jti,
        event_type=event_type,
        issued_at=1_700_000_000,
        google_id=google_id,
        reason=reason,
        state=state,
        raw_payload={"jti": jti, "events": {event_type: {}}},
    )


@pytest.fixture
def fake_conn() -> AsyncConnection:
    return cast(AsyncConnection, object())


@pytest.mark.parametrize(
    "event_type",
    [
        EVENT_ACCOUNT_DISABLED,
        EVENT_ACCOUNT_PURGED,
    ],
)
async def test_apply_deactivating_events_set_user_inactive(
    event_type: str,
    fake_conn: AsyncConnection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    record = AsyncMock(return_value=True)
    set_active = AsyncMock(
        return_value={
            "id": "00000000-0000-0000-0000-000000000001",
            "google_id": "google-user-1",
            "email": "x@example.com",
            "name": None,
            "picture": None,
            "is_active": False,
        }
    )
    revoke_sessions = AsyncMock()
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "set_user_active_by_google_id", set_active)
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(fake_conn, _event(event_type=event_type))

    record.assert_awaited_once()
    set_active.assert_awaited_once_with(fake_conn, "google-user-1", is_active=False)
    revoke_sessions.assert_not_awaited()


async def test_apply_account_enabled_sets_user_active(
    fake_conn: AsyncConnection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    record = AsyncMock(return_value=True)
    set_active = AsyncMock(return_value=None)
    revoke_sessions = AsyncMock()
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "set_user_active_by_google_id", set_active)
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_ENABLED)
    )

    set_active.assert_awaited_once_with(fake_conn, "google-user-1", is_active=True)
    revoke_sessions.assert_not_awaited()


async def test_apply_verification_event_is_audit_only(
    fake_conn: AsyncConnection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    record = AsyncMock(return_value=True)
    set_active = AsyncMock()
    revoke_sessions = AsyncMock()
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "set_user_active_by_google_id", set_active)
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_VERIFICATION, google_id=None, state="state-1"),
    )

    record.assert_awaited_once()
    set_active.assert_not_awaited()
    revoke_sessions.assert_not_awaited()


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
    set_active = AsyncMock()
    revoke_sessions = AsyncMock(return_value=None)
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "set_user_active_by_google_id", set_active)
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(fake_conn, _event(event_type=event_type))

    record.assert_awaited_once()
    revoke_sessions.assert_awaited_once_with(fake_conn, "google-user-1")
    set_active.assert_not_awaited()


async def test_apply_token_revoked_is_audit_only(
    fake_conn: AsyncConnection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    record = AsyncMock(return_value=True)
    set_active = AsyncMock()
    revoke_sessions = AsyncMock()
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "set_user_active_by_google_id", set_active)
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_TOKEN_REVOKED, google_id=None),
    )

    record.assert_awaited_once()
    set_active.assert_not_awaited()
    revoke_sessions.assert_not_awaited()


async def test_apply_duplicate_jti_skips_user_mutation(
    fake_conn: AsyncConnection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    record = AsyncMock(return_value=False)  # duplicate
    set_active = AsyncMock()
    revoke_sessions = AsyncMock()
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "set_user_active_by_google_id", set_active)
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(
        fake_conn, _event(event_type=EVENT_ACCOUNT_DISABLED)
    )

    record.assert_awaited_once()
    set_active.assert_not_awaited()
    revoke_sessions.assert_not_awaited()


async def test_apply_subject_less_non_verification_event_skips_user_mutation(
    fake_conn: AsyncConnection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    record = AsyncMock(return_value=True)
    set_active = AsyncMock()
    revoke_sessions = AsyncMock()
    monkeypatch.setattr(handlers_module, "record_risc_event", record)
    monkeypatch.setattr(handlers_module, "set_user_active_by_google_id", set_active)
    monkeypatch.setattr(
        handlers_module, "revoke_user_sessions_by_google_id", revoke_sessions
    )

    await handlers_module.apply_risc_event(
        fake_conn,
        _event(event_type=EVENT_ACCOUNT_DISABLED, google_id=None),
    )

    record.assert_awaited_once()
    set_active.assert_not_awaited()
    revoke_sessions.assert_not_awaited()
