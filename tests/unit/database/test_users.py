from typing import cast
from uuid import uuid4

import pytest
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.database import users as users_module


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
        self.cursor_row_factories: list[object] = []

    def cursor(self, *, row_factory):
        self.cursor_row_factories.append(row_factory)
        return self._cursor


def make_user_row(*, user_id=None) -> dict:
    return {
        "id": user_id or uuid4(),
        "google_id": "google-user-1",
        "email": "user@example.com",
        "name": "Career OS User",
        "picture": None,
        "is_active": True,
    }


@pytest.mark.asyncio
async def test_find_user_by_google_id_uses_dict_rows_and_returns_row() -> None:
    row = make_user_row()
    cursor = FakeCursor(fetchone_results=[row])
    conn = FakeConnection(cursor=cursor)

    result = await users_module.find_user_by_google_id(
        cast(AsyncConnection, conn),
        "google-user-1",
    )

    assert result == row
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (users_module._FIND_BY_GOOGLE_ID_SQL, ("google-user-1",)),
    ]


@pytest.mark.asyncio
async def test_find_user_by_id_returns_none_when_missing() -> None:
    user_id = uuid4()
    cursor = FakeCursor(fetchone_results=[None])
    conn = FakeConnection(cursor=cursor)

    result = await users_module.find_user_by_id(cast(AsyncConnection, conn), user_id)

    assert result is None
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [(users_module._FIND_BY_ID_SQL, (user_id,))]


@pytest.mark.asyncio
async def test_update_user_name_executes_sql_with_user_id_and_name() -> None:
    user_id = uuid4()
    row = make_user_row(user_id=user_id) | {"name": "New Name"}
    cursor = FakeCursor(fetchone_results=[row])
    conn = FakeConnection(cursor=cursor)

    result = await users_module.update_user_name(
        cast(AsyncConnection, conn),
        user_id,
        "New Name",
    )

    assert result == row
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (users_module._UPDATE_NAME_SQL, ("New Name", user_id)),
    ]


@pytest.mark.asyncio
async def test_upsert_user_executes_sql_and_returns_row() -> None:
    row = make_user_row()
    cursor = FakeCursor(fetchone_results=[row])
    conn = FakeConnection(cursor=cursor)

    result = await users_module.upsert_user(
        cast(AsyncConnection, conn),
        "google-user-1",
        "user@example.com",
        "Career OS User",
        None,
    )

    assert result == row
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (
            users_module._UPSERT_SQL,
            ("google-user-1", "user@example.com", "Career OS User", None),
        ),
    ]
