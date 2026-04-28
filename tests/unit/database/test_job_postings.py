from datetime import UTC, datetime
from typing import cast
from uuid import uuid4

import pytest
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.database import job_postings as job_postings_module


class FakeExecuteResult:
    def __init__(self, row):
        self._row = row

    async def fetchone(self):
        return self._row


class FakeCursor:
    def __init__(self, *, rows=None, fetchone_results=None):
        self._rows = rows or []
        self._fetchone_results = list(fetchone_results or [])
        self.execute_calls: list[tuple[str, tuple | None]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def execute(self, query: str, params: tuple | None = None) -> None:
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
    user_id = uuid4()
    returned_row = {
        "id": 7,
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
    )

    assert row == returned_row
    assert conn.cursor_row_factories == [dict_row]
    assert cursor.execute_calls == [
        (
            job_postings_module._UPSERT_SQL,
            (
                user_id,
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
    user_id = uuid4()
    rows = [
        {
            "id": 1,
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
        (job_postings_module._LIST_SQL, (user_id, 20, 40)),
        (job_postings_module._COUNT_SQL, (user_id,)),
    ]


@pytest.mark.asyncio
async def test_get_job_postings_skips_count_when_with_total_false() -> None:
    user_id = uuid4()
    rows = [{"id": 2, "platform": "saramin"}]
    cursor = FakeCursor(rows=rows)
    conn = FakeConnection(cursor=cursor)

    result_rows, total = await job_postings_module.get_job_postings(
        cast(AsyncConnection, conn),
        user_id=user_id,
        limit=10,
        offset=0,
        with_total=False,
    )

    assert result_rows == rows
    assert total is None
    assert cursor.execute_calls == [
        (job_postings_module._LIST_SQL, (user_id, 10, 0)),
    ]


@pytest.mark.asyncio
async def test_get_job_posting_uses_detail_query_and_returns_row() -> None:
    user_id = uuid4()
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
