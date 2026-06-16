import uuid
from typing import cast

import pytest
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.database import user_profiles as user_profiles_module
from career_os_api.schemas import UserProfileUpsertRequest


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


def make_profile_row(*, user_id=None, inserted: bool | None = None) -> dict:
    row: dict = {
        "user_id": user_id or uuid.uuid7(),
        "headline": "Backend Engineer",
        "years_experience": 5,
        "target_roles": ["Backend Engineer"],
        "skills": ["Python", "FastAPI"],
        "locations": ["Seoul"],
        "salary_expectation": "협의",
        "summary": "5년차 백엔드 개발자",
        "created_at": None,
        "updated_at": None,
    }
    if inserted is not None:
        row["inserted"] = inserted
    return row


@pytest.mark.asyncio
async def test_get_user_profile_scopes_by_user_and_uses_dict_rows() -> None:
    user_id = uuid.uuid7()
    row = make_profile_row(user_id=user_id)
    cursor = FakeCursor(fetchone_results=[row])
    conn = FakeConnection(cursor=cursor)

    result = await user_profiles_module.get_user_profile(
        cast(AsyncConnection, conn), user_id=user_id
    )

    assert result == row
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [(user_profiles_module._GET_SQL, (user_id,))]


@pytest.mark.asyncio
async def test_get_user_profile_returns_none_when_missing() -> None:
    cursor = FakeCursor(fetchone_results=[None])
    conn = FakeConnection(cursor=cursor)

    result = await user_profiles_module.get_user_profile(
        cast(AsyncConnection, conn), user_id=uuid.uuid7()
    )

    assert result is None


@pytest.mark.asyncio
async def test_upsert_user_profile_passes_fields_in_column_order() -> None:
    user_id = uuid.uuid7()
    data = UserProfileUpsertRequest(
        headline="Backend Engineer",
        years_experience=5,
        target_roles=["Backend Engineer"],
        skills=["Python", "FastAPI"],
        locations=["Seoul"],
        salary_expectation="협의",
        summary="5년차 백엔드 개발자",
    )
    returned = make_profile_row(user_id=user_id, inserted=True)
    cursor = FakeCursor(fetchone_results=[returned])
    conn = FakeConnection(cursor=cursor)

    result = await user_profiles_module.upsert_user_profile(
        cast(AsyncConnection, conn), user_id=user_id, data=data
    )

    assert result == returned
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (
            user_profiles_module._UPSERT_SQL,
            (
                user_id,
                "Backend Engineer",
                5,
                ["Backend Engineer"],
                ["Python", "FastAPI"],
                ["Seoul"],
                "협의",
                "5년차 백엔드 개발자",
            ),
        )
    ]


@pytest.mark.asyncio
async def test_upsert_user_profile_writes_nulls_for_omitted_fields() -> None:
    # Full-replace semantics: omitted fields become NULL, not preserved.
    user_id = uuid.uuid7()
    data = UserProfileUpsertRequest()
    cursor = FakeCursor(fetchone_results=[make_profile_row(inserted=False)])
    conn = FakeConnection(cursor=cursor)

    await user_profiles_module.upsert_user_profile(
        cast(AsyncConnection, conn), user_id=user_id, data=data
    )

    _, params = cursor.execute_calls[0]
    assert params == (user_id, None, None, None, None, None, None, None)


@pytest.mark.asyncio
async def test_upsert_user_profile_inserted_flag_drives_create_vs_replace() -> None:
    cursor = FakeCursor(fetchone_results=[make_profile_row(inserted=False)])
    conn = FakeConnection(cursor=cursor)

    result = await user_profiles_module.upsert_user_profile(
        cast(AsyncConnection, conn),
        user_id=uuid.uuid7(),
        data=UserProfileUpsertRequest(headline="x"),
    )

    assert result["inserted"] is False
    # xmax = 0 expression must be part of the RETURNING clause.
    assert "(xmax = 0) AS inserted" in user_profiles_module._UPSERT_SQL
