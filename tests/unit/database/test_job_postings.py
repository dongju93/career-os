import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import pytest
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.database import ddl as ddl_module
from career_os_api.database import job_postings as job_postings_module
from career_os_api.schemas import ApplicationStatus


class FakeExecuteResult:
    def __init__(self, row):
        self._row = row

    async def fetchone(self):
        return self._row


class FakeCursor:
    def __init__(self, *, rows=None, fetchone_results=None):
        self._rows = rows or []
        self._fetchone_results = list(fetchone_results or [])
        # Params are positional tuples for the legacy queries and dicts for the
        # named-parameter chat-context queries.
        self.execute_calls: list[tuple[str, Any]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def execute(self, query: str, params: Any = None) -> None:
        self.execute_calls.append((query, params))

    async def fetchall(self):
        return self._rows

    async def fetchone(self):
        if not self._fetchone_results:
            return None
        return self._fetchone_results.pop(0)


class FakeConnection:
    def __init__(self, *, execute_row=None, cursor=None):
        self._execute_row = execute_row
        self._cursor = cursor
        self.execute_calls: list[tuple[str, tuple]] = []
        self.cursor_row_factories: list[object] = []

    async def execute(self, query: str, params: tuple):
        self.execute_calls.append((query, params))
        return FakeExecuteResult(self._execute_row)

    def cursor(self, *, row_factory):
        self.cursor_row_factories.append(row_factory)
        return self._cursor


@pytest.mark.asyncio
async def test_upsert_job_posting_executes_sql_with_model_fields(
    sample_job_posting,
) -> None:
    timestamp = datetime(2026, 4, 13, 9, 0, tzinfo=UTC)
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    returned_row = {
        "id": 7,
        "group_id": group_id,
        "scraped_at": timestamp,
        "created_at": timestamp,
        "updated_at": timestamp,
        "inserted": True,
    }
    cursor = FakeCursor(fetchone_results=[returned_row])
    conn = FakeConnection(cursor=cursor)

    row = await job_postings_module.upsert_job_posting(
        cast(AsyncConnection, conn),
        sample_job_posting,
        user_id=user_id,
        group_id=group_id,
    )

    assert row == returned_row
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (
            job_postings_module._UPSERT_SQL,
            (
                user_id,
                group_id,
                "saramin",
                sample_job_posting.posting_id,
                sample_job_posting.posting_url,
                sample_job_posting.company_name,
                sample_job_posting.job_title,
                sample_job_posting.experience_req,
                sample_job_posting.deadline,
                sample_job_posting.location,
                sample_job_posting.employment_type,
                sample_job_posting.job_description,
                sample_job_posting.responsibilities,
                sample_job_posting.qualifications,
                sample_job_posting.preferred_points,
                sample_job_posting.benefits,
                sample_job_posting.hiring_process,
                sample_job_posting.education_req,
                sample_job_posting.salary,
                sample_job_posting.tech_stack,
                sample_job_posting.tags,
                sample_job_posting.application_method,
                sample_job_posting.application_form,
                sample_job_posting.contact_person,
                sample_job_posting.homepage,
                sample_job_posting.job_category,
                sample_job_posting.industry,
            ),
        )
    ]


@pytest.mark.asyncio
async def test_get_job_postings_uses_dict_rows_and_returns_count() -> None:
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    rows = [
        {
            "id": 1,
            "group_id": group_id,
            "platform": "saramin",
            "posting_id": "4930",
            "posting_url": "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
            "company_name": "Career OS",
            "job_title": "Backend Engineer",
            "experience_req": "3 years+",
            "deadline": "2026-05-31",
            "location": "Seoul",
            "employment_type": "Full-time",
            "salary": None,
            "tech_stack": ["Python", "FastAPI"],
            "tags": ["#backend"],
            "job_category": None,
            "industry": None,
            "scraped_at": datetime(2026, 4, 13, 9, 0, tzinfo=UTC),
            "created_at": datetime(2026, 4, 13, 9, 0, tzinfo=UTC),
            "updated_at": datetime(2026, 4, 13, 9, 0, tzinfo=UTC),
        }
    ]
    cursor = FakeCursor(rows=rows, fetchone_results=[{"total": 3}])
    conn = FakeConnection(cursor=cursor)

    result_rows, total = await job_postings_module.get_job_postings(
        cast(AsyncConnection, conn),
        user_id=user_id,
        limit=20,
        offset=40,
    )

    assert result_rows == rows
    assert total == 3
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (job_postings_module._LIST_BY_USER_SQL, (user_id, 20, 40)),
        (job_postings_module._COUNT_BY_USER_SQL, (user_id,)),
    ]


@pytest.mark.asyncio
async def test_get_job_postings_filters_by_group_id() -> None:
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    rows: list = []
    cursor = FakeCursor(rows=rows, fetchone_results=[{"total": 0}])
    conn = FakeConnection(cursor=cursor)

    result_rows, total = await job_postings_module.get_job_postings(
        cast(AsyncConnection, conn),
        user_id=user_id,
        limit=10,
        offset=0,
        group_id=group_id,
    )

    assert result_rows == []
    assert total == 0
    assert cursor.execute_calls == [
        (job_postings_module._LIST_BY_GROUP_SQL, (group_id, 10, 0)),
        (job_postings_module._COUNT_BY_GROUP_SQL, (group_id,)),
    ]


@pytest.mark.asyncio
async def test_get_job_posting_uses_detail_query_and_returns_row() -> None:
    user_id = uuid.uuid7()
    row = {
        "id": 19,
        "platform": "saramin",
        "posting_id": "4930",
    }
    cursor = FakeCursor(fetchone_results=[row])
    conn = FakeConnection(cursor=cursor)

    result = await job_postings_module.get_job_posting(
        cast(AsyncConnection, conn),
        19,
        user_id=user_id,
    )

    assert result == row
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (job_postings_module._DETAIL_SQL, (19, user_id)),
    ]


@pytest.mark.asyncio
async def test_search_chat_context_scopes_by_user_and_wraps_pattern() -> None:
    user_id = uuid.uuid7()
    rows = [{"id": 1, "company_name": "Career OS"}]
    cursor = FakeCursor(rows=rows)
    conn = FakeConnection(cursor=cursor)

    result = await job_postings_module.search_job_postings_for_chat_context(
        cast(AsyncConnection, conn),
        user_id=user_id,
        query="backend",
        group_id=None,
        limit=5,
    )

    assert result == rows
    assert conn.cursor_row_factories == [dict_row]
    sql, params = cursor.execute_calls[0]
    assert "user_id = %(user_id)s" in sql
    assert params == {
        "user_id": user_id,
        "group_id": None,
        "query": "backend",
        "pattern": "%backend%",
        "limit": 5,
    }


@pytest.mark.asyncio
async def test_search_chat_context_escapes_like_wildcards() -> None:
    # 모델이 고른 query의 %, _, \는 와일드카드가 아니라 literal로 검색돼야 한다.
    cursor = FakeCursor(rows=[])
    conn = FakeConnection(cursor=cursor)

    await job_postings_module.search_job_postings_for_chat_context(
        cast(AsyncConnection, conn),
        user_id=uuid.uuid7(),
        query="100%_done\\",
        group_id=None,
        limit=5,
    )

    _, params = cursor.execute_calls[0]
    assert params["pattern"] == "%100\\%\\_done\\\\%"


@pytest.mark.asyncio
async def test_search_chat_context_without_query_binds_null_filters() -> None:
    user_id = uuid.uuid7()
    cursor = FakeCursor(rows=[])
    conn = FakeConnection(cursor=cursor)

    result = await job_postings_module.search_job_postings_for_chat_context(
        cast(AsyncConnection, conn),
        user_id=user_id,
        query=None,
        group_id=None,
        limit=3,
    )

    assert result == []
    _, params = cursor.execute_calls[0]
    assert params["query"] is None
    assert params["pattern"] is None
    assert params["limit"] == 3


@pytest.mark.asyncio
async def test_search_chat_context_group_filter_keeps_user_scope() -> None:
    user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    cursor = FakeCursor(rows=[])
    conn = FakeConnection(cursor=cursor)

    await job_postings_module.search_job_postings_for_chat_context(
        cast(AsyncConnection, conn),
        user_id=user_id,
        query=None,
        group_id=group_id,
        limit=5,
    )

    sql, params = cursor.execute_calls[0]
    assert "user_id = %(user_id)s" in sql
    assert params["group_id"] == group_id
    assert params["user_id"] == user_id


@pytest.mark.asyncio
async def test_update_job_posting_fields_stamps_status_updated_at() -> None:
    user_id = uuid.uuid7()
    row = {"id": 7, "application_status": "applied"}
    cursor = FakeCursor(fetchone_results=[row])
    conn = FakeConnection(cursor=cursor)

    result = await job_postings_module.update_job_posting_fields(
        cast(AsyncConnection, conn),
        user_id=user_id,
        job_id=7,
        fields={"application_status": "applied"},
    )

    assert result == row
    assert conn.cursor_row_factories == [dict_row]
    sql, params = cursor.execute_calls[0]
    assert "application_status = %s" in sql
    # A status change must also bump status_updated_at in the same statement.
    assert "status_updated_at = NOW()" in sql
    assert "WHERE id = %s AND user_id = %s" in sql
    assert params == ("applied", 7, user_id)


@pytest.mark.asyncio
async def test_update_job_posting_fields_returns_none_when_no_row_matches() -> None:
    # Foreign / unknown id matches no row under the user_id-scoped WHERE.
    cursor = FakeCursor(fetchone_results=[None])
    conn = FakeConnection(cursor=cursor)

    result = await job_postings_module.update_job_posting_fields(
        cast(AsyncConnection, conn),
        user_id=uuid.uuid7(),
        job_id=999,
        fields={"application_status": "applied"},
    )

    assert result is None


def test_list_and_detail_sql_project_application_lifecycle_columns() -> None:
    for sql in (
        job_postings_module._DETAIL_SQL,
        job_postings_module._LIST_BY_USER_SQL,
        job_postings_module._LIST_BY_GROUP_SQL,
    ):
        assert "application_status" in sql
        assert "status_updated_at" in sql


def test_upsert_do_update_set_preserves_status_but_returns_it() -> None:
    # Re-saving a posting must not reset its lifecycle columns, so they must be
    # absent from DO UPDATE SET — yet still projected in RETURNING.
    after_conflict = job_postings_module._UPSERT_SQL.split("DO UPDATE SET", 1)[1]
    set_clause, returning_clause = after_conflict.split("RETURNING", 1)
    assert "application_status" not in set_clause
    assert "status_updated_at" not in set_clause
    assert "application_status" in returning_clause
    assert "status_updated_at" in returning_clause


def test_application_status_enum_matches_ddl_check_constraints() -> None:
    # Guards against silent drift between the StrEnum and the literal CHECK lists
    # in both the CREATE TABLE and the migration for existing databases.
    migration_sql = (
        Path(__file__).parents[3] / "migrations/2026-06-10-1.sql"
    ).read_text()
    for member in ApplicationStatus:
        token = f"'{member.value}'"
        assert token in ddl_module.CREATE_JOB_POSTINGS_TABLE
        assert token in migration_sql


@pytest.mark.asyncio
async def test_get_chat_context_detail_scopes_by_user() -> None:
    user_id = uuid.uuid7()
    row = {"id": 19, "company_name": "Career OS"}
    cursor = FakeCursor(fetchone_results=[row])
    conn = FakeConnection(cursor=cursor)

    result = await job_postings_module.get_job_posting_for_chat_context(
        cast(AsyncConnection, conn),
        user_id=user_id,
        job_id=19,
    )

    assert result == row
    assert conn.cursor_row_factories == [dict_row]
    sql, params = cursor.execute_calls[0]
    assert "WHERE id = %(job_id)s AND user_id = %(user_id)s" in sql
    assert params == {"job_id": 19, "user_id": user_id}
