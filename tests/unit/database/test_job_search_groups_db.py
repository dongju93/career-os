"""Unit tests for career_os_api.database.job_search_groups."""

import uuid
from datetime import UTC, date, datetime
from typing import cast

import pytest
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.database import job_search_groups as groups_module


class FakeCursor:
    def __init__(self, *, rows=None, fetchone_results=None):
        self._rows = rows or []
        self._fetchone_results = list(fetchone_results or [])
        self.execute_calls: list[tuple] = []
        self.rowcount: int = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def execute(self, query: str, params=None) -> None:
        self.execute_calls.append((query, params))

    async def fetchall(self):
        return self._rows

    async def fetchone(self):
        if not self._fetchone_results:
            return None
        return self._fetchone_results.pop(0)


class FakeConnection:
    def __init__(self, *, cursor: FakeCursor | None = None, fetchone_result=None):
        self._cursor = cursor
        self.cursor_row_factories: list = []

    def cursor(self, *, row_factory=None):
        self.cursor_row_factories.append(row_factory)
        return self._cursor


_NOW = datetime(2026, 5, 1, 0, 0, tzinfo=UTC)
_TODAY = date(2026, 5, 1)


def _make_row(user_id: uuid.UUID, group_id: uuid.UUID | None = None) -> dict:
    return {
        "id": group_id or uuid.uuid7(),
        "user_id": user_id,
        "name": "테스트 그룹",
        "started_at": _TODAY,
        "ended_at": None,
        "memo": None,
        "created_at": _NOW,
        "updated_at": _NOW,
    }


@pytest.mark.asyncio
async def test_create_job_search_group_returns_row() -> None:
    user_id = uuid.uuid7()
    returned = _make_row(user_id)
    cursor = FakeCursor(fetchone_results=[returned])
    conn = FakeConnection(cursor=cursor)

    row = await groups_module.create_job_search_group(
        cast(AsyncConnection, conn),
        user_id=user_id,
        name="테스트 그룹",
        started_at=_TODAY,
        ended_at=None,
        memo=None,
    )

    assert row == returned
    assert conn.cursor_row_factories == [dict_row]
    assert len(cursor.execute_calls) == 1
    sql, params = cursor.execute_calls[0]
    assert sql == groups_module._INSERT_SQL
    assert params[1] == user_id
    assert params[2] == "테스트 그룹"
    assert params[3] == _TODAY


@pytest.mark.asyncio
async def test_get_job_search_group_returns_row_for_any_user() -> None:
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    returned = _make_row(user_id, group_id)
    cursor = FakeCursor(fetchone_results=[returned])
    conn = FakeConnection(cursor=cursor)

    row = await groups_module.get_job_search_group(
        cast(AsyncConnection, conn),
        group_id,
    )

    assert row == returned


@pytest.mark.asyncio
async def test_get_job_search_group_returns_none_when_not_found() -> None:
    cursor = FakeCursor(fetchone_results=[None])
    conn = FakeConnection(cursor=cursor)

    row = await groups_module.get_job_search_group(
        cast(AsyncConnection, conn),
        uuid.uuid7(),
    )

    assert row is None


@pytest.mark.asyncio
async def test_get_job_search_groups_uses_active_sql_for_active_filter() -> None:
    user_id = uuid.uuid7()
    list_row = {
        "id": uuid.uuid7(),
        "name": "활성 그룹",
        "started_at": _TODAY,
        "ended_at": None,
        "memo": None,
        "posting_count": 2,
        "created_at": _NOW,
        "updated_at": _NOW,
    }
    cursor = FakeCursor(rows=[list_row], fetchone_results=[{"total": 1}])
    conn = FakeConnection(cursor=cursor)

    rows, total = await groups_module.get_job_search_groups(
        cast(AsyncConnection, conn),
        user_id=user_id,
        status="active",
        limit=20,
        offset=0,
    )

    assert rows == [list_row]
    assert total == 1
    # Both SQL lookups must use the active-filter constants
    list_sql, _ = cursor.execute_calls[0]
    count_sql, _ = cursor.execute_calls[1]
    assert list_sql is groups_module._LIST_ACTIVE_SQL
    assert count_sql is groups_module._COUNT_ACTIVE_SQL


@pytest.mark.asyncio
async def test_get_current_group_id_returns_id_when_found() -> None:
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    cursor = FakeCursor(fetchone_results=[{"id": group_id}])
    conn = FakeConnection(cursor=cursor)

    result = await groups_module.get_current_group_id(
        cast(AsyncConnection, conn),
        user_id,
    )

    assert result == group_id


@pytest.mark.asyncio
async def test_get_current_group_id_returns_none_when_no_active_group() -> None:
    cursor = FakeCursor(fetchone_results=[None])
    conn = FakeConnection(cursor=cursor)

    result = await groups_module.get_current_group_id(
        cast(AsyncConnection, conn),
        uuid.uuid7(),
    )

    assert result is None


@pytest.mark.asyncio
async def test_has_any_group_returns_true() -> None:
    cursor = FakeCursor(fetchone_results=[{"has_group": True}])
    conn = FakeConnection(cursor=cursor)

    result = await groups_module.has_any_group(
        cast(AsyncConnection, conn),
        uuid.uuid7(),
    )

    assert result is True


@pytest.mark.asyncio
async def test_has_any_group_returns_false() -> None:
    cursor = FakeCursor(fetchone_results=[{"has_group": False}])
    conn = FakeConnection(cursor=cursor)

    result = await groups_module.has_any_group(
        cast(AsyncConnection, conn),
        uuid.uuid7(),
    )

    assert result is False


@pytest.mark.asyncio
async def test_update_job_search_group_builds_dynamic_sql() -> None:
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    updated = _make_row(user_id, group_id)
    updated["name"] = "새 이름"
    cursor = FakeCursor(fetchone_results=[updated])
    conn = FakeConnection(cursor=cursor)

    row = await groups_module.update_job_search_group(
        cast(AsyncConnection, conn),
        group_id,
        user_id=user_id,
        fields={"name": "새 이름"},
    )

    assert row is not None
    assert row["name"] == "새 이름"
    sql, params = cursor.execute_calls[0]
    assert "name = %s" in sql
    assert "새 이름" in params


@pytest.mark.asyncio
async def test_update_job_search_group_with_empty_fields_fetches_existing() -> None:
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    existing = _make_row(user_id, group_id)
    cursor = FakeCursor(fetchone_results=[existing])
    conn = FakeConnection(cursor=cursor)

    row = await groups_module.update_job_search_group(
        cast(AsyncConnection, conn),
        group_id,
        user_id=user_id,
        fields={},
    )

    # With empty fields, the function calls get_job_search_group which runs _GET_SQL
    assert row == existing


@pytest.mark.asyncio
async def test_create_initial_group_uses_korean_name() -> None:
    user_id = uuid.uuid7()
    returned = _make_row(user_id)
    returned["name"] = "첫 번째 구직 활동"
    cursor = FakeCursor(fetchone_results=[returned])
    conn = FakeConnection(cursor=cursor)

    row = await groups_module.create_initial_group(
        cast(AsyncConnection, conn),
        user_id,
    )

    assert row["name"] == "첫 번째 구직 활동"
    _, params = cursor.execute_calls[0]
    assert params[2] == "첫 번째 구직 활동"
