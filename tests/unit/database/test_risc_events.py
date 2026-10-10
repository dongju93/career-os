from typing import cast

import pytest
from psycopg import AsyncConnection

from career_os_api.database import risc_events as risc_events_module


class FakeCursor:
    def __init__(self, *, fetchone_results=None) -> None:
        self._fetchone_results = list(fetchone_results or [])
        self.execute_calls: list[tuple[str, tuple | None]] = []

    async def __aenter__(self) -> FakeCursor:
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def execute(self, query: str, params: tuple | None = None) -> None:
        self.execute_calls.append((query, params))

    async def fetchone(self):
        if not self._fetchone_results:
            return None
        return self._fetchone_results.pop(0)


class FakeConnection:
    def __init__(self, *, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def cursor(self):
        return self._cursor


@pytest.mark.asyncio
async def test_record_risc_event_inserts_and_returns_true() -> None:
    cursor = FakeCursor(fetchone_results=[(1,)])
    conn = FakeConnection(cursor=cursor)

    inserted = await risc_events_module.record_risc_event(
        cast(AsyncConnection, conn),
        jti="jti-1",
        event_type="https://example/event",
        google_id="google-user-1",
        reason="hijacking",
        issued_at=1_700_000_000,
    )

    assert inserted is True
    assert len(cursor.execute_calls) == 1
    query, params = cursor.execute_calls[0]
    assert query == risc_events_module._INSERT_SQL
    assert params == (
        "jti-1",
        "https://example/event",
        "google-user-1",
        "hijacking",
        1_700_000_000,
    )


@pytest.mark.asyncio
async def test_record_risc_event_returns_false_on_duplicate() -> None:
    cursor = FakeCursor(fetchone_results=[None])  # ON CONFLICT DO NOTHING
    conn = FakeConnection(cursor=cursor)

    inserted = await risc_events_module.record_risc_event(
        cast(AsyncConnection, conn),
        jti="jti-1",
        event_type="https://example/event",
        google_id=None,
        reason=None,
        issued_at=1_700_000_000,
    )

    assert inserted is False


@pytest.mark.asyncio
async def test_anonymize_risc_events_by_google_id_unlinks_audit_rows() -> None:
    cursor = FakeCursor()
    conn = FakeConnection(cursor=cursor)

    await risc_events_module.anonymize_risc_events_by_google_id(
        cast(AsyncConnection, conn), "google-user-1"
    )

    assert cursor.execute_calls == [
        (risc_events_module._ANONYMIZE_BY_GOOGLE_ID_SQL, ("google-user-1",)),
    ]


@pytest.mark.asyncio
async def test_delete_expired_risc_events_uses_retention_window() -> None:
    cursor = FakeCursor()
    conn = FakeConnection(cursor=cursor)

    await risc_events_module.delete_expired_risc_events(
        cast(AsyncConnection, conn), retention_days=90
    )

    assert cursor.execute_calls == [
        (risc_events_module._DELETE_EXPIRED_SQL, (90,)),
    ]
