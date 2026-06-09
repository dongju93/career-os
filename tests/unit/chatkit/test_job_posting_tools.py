"""Unit tests for career_os_api.chatkit.job_posting_tools.

The `_impl` functions are exercised directly against fake pool/connection/cursor
doubles (same style as test_store.py), so user scoping, untrusted-input handling,
and payload trimming are asserted without the Agents SDK call machinery or a live
database.
"""

import json
import uuid
from collections.abc import Sequence
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, cast

import pytest

from career_os_api.chatkit.context import ChatKitRequestContext
from career_os_api.chatkit.job_posting_tools import (
    _MAX_DETAIL_FIELD_CHARS,
    _SUMMARY_FIELDS,
    _get_saved_job_posting_detail_impl,
    _search_saved_job_postings_impl,
)

_NOW = datetime(2026, 6, 5, 12, 0, tzinfo=UTC)


# ── fake DB doubles (test_store.py style, trimmed to the read-only tool path) ──


class FakeCursor:
    def __init__(
        self,
        *,
        fetchone: Sequence[Any] | None = None,
        fetchall: Sequence[Any] | None = None,
    ) -> None:
        self._fetchone = list(fetchone or [])
        self._fetchall = list(fetchall or [])
        self.executed: list[tuple[str, Any]] = []

    async def __aenter__(self) -> FakeCursor:
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    async def execute(self, sql: str, params: Any = None) -> None:
        self.executed.append((sql, params))

    async def fetchone(self) -> Any:
        return self._fetchone.pop(0) if self._fetchone else None

    async def fetchall(self) -> Any:
        return self._fetchall.pop(0) if self._fetchall else []


class FakeConnection:
    def __init__(self, cursors: Sequence[FakeCursor]) -> None:
        self._cursors = list(cursors)
        self.row_factories: list[Any] = []

    def cursor(self, *, row_factory: Any = None) -> FakeCursor:
        self.row_factories.append(row_factory)
        return self._cursors.pop(0)


class FakePool:
    def __init__(self, conn: FakeConnection) -> None:
        self._conn = conn

    @asynccontextmanager
    async def connection(self):  # type: ignore[no-untyped-def]
        yield self._conn


def _make_context(
    user_id: uuid.UUID, cursors: Sequence[FakeCursor]
) -> ChatKitRequestContext:
    pool = FakePool(FakeConnection(cursors))
    return ChatKitRequestContext(user_id=user_id, pool=cast(Any, pool))


def _detail_row(**overrides: Any) -> dict[str, Any]:
    """Full JobPostingChatDetailRow shape — the payload builder subscripts every key."""
    row: dict[str, Any] = {
        "id": 19,
        "group_id": uuid.uuid7(),
        "platform": "saramin",
        "company_name": "Career OS",
        "job_title": "Backend Engineer",
        "experience_req": "3 years+",
        "deadline": "2026-06-30",
        "location": "Seoul",
        "employment_type": "Full-time",
        "salary": None,
        "tech_stack": ["Python", "FastAPI"],
        "job_category": None,
        "industry": None,
        "scraped_at": _NOW,
        "posting_url": "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=19",
        "job_description": "백엔드 API 개발",
        "responsibilities": None,
        "qualifications": None,
        "preferred_points": None,
        "benefits": None,
        "hiring_process": None,
        "education_req": None,
        "application_method": None,
        "homepage": None,
    }
    row.update(overrides)
    return row


# ── search tool ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_impl_scopes_by_request_user_and_projects_summary() -> None:
    user_id = uuid.uuid7()
    summary_row = {
        "id": 1,
        "group_id": uuid.uuid7(),
        "platform": "saramin",
        "company_name": "Career OS",
        "job_title": "Backend Engineer",
        "experience_req": None,
        "deadline": None,
        "location": "Seoul",
        "employment_type": None,
        "salary": None,
        "tech_stack": ["Python"],
        "job_category": None,
        "industry": None,
        "scraped_at": _NOW,
    }
    cursor = FakeCursor(fetchall=[[summary_row]])
    context = _make_context(user_id, [cursor])

    out = await _search_saved_job_postings_impl(
        context, query="backend", group_id=None, limit=5
    )

    payload = json.loads(out)
    assert payload["count"] == 1
    assert set(payload["items"][0]) == set(_SUMMARY_FIELDS)
    assert payload["items"][0]["company_name"] == "Career OS"
    sql, params = cursor.executed[0]
    assert "user_id = %(user_id)s" in sql
    assert params["user_id"] == user_id
    assert params["pattern"] == "%backend%"


@pytest.mark.asyncio
async def test_search_impl_invalid_group_id_returns_json_error() -> None:
    cursor = FakeCursor()
    context = _make_context(uuid.uuid7(), [cursor])

    out = await _search_saved_job_postings_impl(
        context, query=None, group_id="oops", limit=5
    )

    assert json.loads(out) == {"error": "invalid_group_id"}
    assert cursor.executed == []


@pytest.mark.asyncio
async def test_search_impl_clamps_limit_to_maximum() -> None:
    cursor = FakeCursor(fetchall=[[]])
    context = _make_context(uuid.uuid7(), [cursor])

    await _search_saved_job_postings_impl(context, query=None, group_id=None, limit=999)

    _, params = cursor.executed[0]
    assert params["limit"] == 8


# ── detail tool ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_detail_impl_missing_row_returns_not_found() -> None:
    cursor = FakeCursor(fetchone=[None])
    context = _make_context(uuid.uuid7(), [cursor])

    out = await _get_saved_job_posting_detail_impl(context, job_id=123)

    assert json.loads(out) == {"found": False}


@pytest.mark.asyncio
async def test_detail_impl_trims_long_job_description() -> None:
    cursor = FakeCursor(fetchone=[_detail_row(job_description="가" * 5_000)])
    context = _make_context(uuid.uuid7(), [cursor])

    out = await _get_saved_job_posting_detail_impl(context, job_id=19)

    payload = json.loads(out)
    assert payload["found"] is True
    assert len(payload["posting"]["job_description"]) <= _MAX_DETAIL_FIELD_CHARS


@pytest.mark.asyncio
async def test_detail_impl_scopes_by_user_and_excludes_contact_person() -> None:
    user_id = uuid.uuid7()
    cursor = FakeCursor(fetchone=[_detail_row()])
    context = _make_context(user_id, [cursor])

    out = await _get_saved_job_posting_detail_impl(context, job_id=19)

    payload = json.loads(out)
    assert payload["found"] is True
    assert "contact_person" not in payload["posting"]
    assert cursor.executed[0][1] == {"job_id": 19, "user_id": user_id}


@pytest.mark.asyncio
async def test_detail_impl_rejects_non_positive_job_id() -> None:
    cursor = FakeCursor()
    context = _make_context(uuid.uuid7(), [cursor])

    out = await _get_saved_job_posting_detail_impl(context, job_id=0)

    assert json.loads(out) == {"error": "invalid_job_id"}
    assert cursor.executed == []
