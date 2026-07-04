import uuid
from typing import cast

import pytest
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.database import auth_exchange as auth_exchange_module


class FakeCursor:
    def __init__(self, *, fetchone_results=None):
        self._fetchone_results = list(fetchone_results or [])
        self.execute_calls: list[tuple[str, tuple | None]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def execute(self, query: str, params: tuple | None = None) -> None:
        self.execute_calls.append((query, params))

    async def fetchone(self):
        if not self._fetchone_results:
            return None
        return self._fetchone_results.pop(0)


class FakeConnection:
    def __init__(self, *, cursor: FakeCursor):
        self._cursor = cursor
        self.cursor_row_factories: list[object | None] = []

    def cursor(self, *, row_factory=None):
        self.cursor_row_factories.append(row_factory)
        return self._cursor


@pytest.mark.asyncio
async def test_create_exchange_code_inserts_random_code_for_user() -> None:
    user_id = uuid.uuid7()
    cursor = FakeCursor()
    conn = FakeConnection(cursor=cursor)

    code = await auth_exchange_module.create_exchange_code(
        cast(AsyncConnection, conn), user_id
    )

    assert code
    sql, params = cursor.execute_calls[0]
    assert sql == auth_exchange_module._INSERT_SQL
    assert params == (
        code,
        user_id,
        auth_exchange_module.EXCHANGE_CODE_TTL_SECONDS,
    )


@pytest.mark.asyncio
async def test_create_exchange_code_generates_distinct_codes() -> None:
    user_id = uuid.uuid7()
    first = await auth_exchange_module.create_exchange_code(
        cast(AsyncConnection, FakeConnection(cursor=FakeCursor())), user_id
    )
    second = await auth_exchange_module.create_exchange_code(
        cast(AsyncConnection, FakeConnection(cursor=FakeCursor())), user_id
    )

    assert first != second


@pytest.mark.asyncio
async def test_redeem_exchange_code_returns_user_id_when_valid() -> None:
    user_id = uuid.uuid7()
    cursor = FakeCursor(fetchone_results=[{"user_id": user_id}])
    conn = FakeConnection(cursor=cursor)

    result = await auth_exchange_module.redeem_exchange_code(
        cast(AsyncConnection, conn), "some-code"
    )

    assert result == user_id
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (auth_exchange_module._REDEEM_SQL, ("some-code",)),
    ]


@pytest.mark.asyncio
async def test_redeem_exchange_code_returns_none_when_missing_or_expired() -> None:
    cursor = FakeCursor(fetchone_results=[None])
    conn = FakeConnection(cursor=cursor)

    result = await auth_exchange_module.redeem_exchange_code(
        cast(AsyncConnection, conn), "unknown-code"
    )

    assert result is None
