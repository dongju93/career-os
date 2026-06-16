"""Unit tests for career_os_api.strategist.strategist_tools.

The `_impl` functions are exercised directly against fake pool/connection/cursor
doubles (same style as tests/unit/chatkit/test_job_posting_tools.py), so user
scoping, untrusted-input handling, and limit clamping are asserted without the
Agents SDK call machinery or a live database. The 400-char trim and contact_person
omission are properties of the SQL constant, so they are asserted on it directly.
"""

import json
import uuid
from collections.abc import Sequence
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, cast

import pytest

from career_os_api.config import settings as app_settings
from career_os_api.database.job_postings import (
    _MAX_STRATEGIST_FIELD_CHARS,
    _STRATEGIST_LIST_SQL,
)
from career_os_api.strategist.strategist_context import StrategistRunContext
from career_os_api.strategist.strategist_tools import (
    _get_career_profile_impl,
    _list_postings_with_status_impl,
)

_NOW = datetime(2026, 6, 12, 12, 0, tzinfo=UTC)


# ── fake DB doubles ───────────────────────────────────────────────────────────


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
    user_id: uuid.UUID,
    cursors: Sequence[FakeCursor],
    *,
    target_group_id: uuid.UUID | None = None,
) -> StrategistRunContext:
    pool = FakePool(FakeConnection(cursors))
    return StrategistRunContext(
        user_id=user_id, pool=cast(Any, pool), target_group_id=target_group_id
    )


def _profile_row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "user_id": uuid.uuid7(),
        "headline": "백엔드 엔지니어",
        "years_experience": 5,
        "target_roles": ["Backend Engineer"],
        "skills": ["Python", "FastAPI"],
        "locations": ["Seoul"],
        "salary_expectation": "6000만원",
        "summary": "API 개발 경험 다수",
        "created_at": _NOW,
        "updated_at": _NOW,
    }
    row.update(overrides)
    return row


def _strategist_row(posting_id: int) -> dict[str, Any]:
    return {
        "id": posting_id,
        "group_id": uuid.uuid7(),
        "platform": "saramin",
        "company_name": "Career OS",
        "job_title": "Backend Engineer",
        "experience_req": "3 years+",
        "deadline": "2026-06-30",
        "location": "Seoul",
        "employment_type": "Full-time",
        "salary": None,
        "tech_stack": ["Python"],
        "job_category": None,
        "industry": None,
        "application_status": "saved",
        "status_updated_at": None,
        "scraped_at": _NOW,
        "qualifications": "FastAPI 경험",
        "preferred_points": None,
        "responsibilities": None,
    }


# ── get_career_profile ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_profile_impl_returns_exists_false_when_missing() -> None:
    cursor = FakeCursor()  # fetchone defaults to None
    context = _make_context(uuid.uuid7(), [cursor])

    out = await _get_career_profile_impl(context)

    assert json.loads(out) == {"exists": False}


@pytest.mark.asyncio
async def test_profile_impl_scopes_by_user_and_omits_identifiers() -> None:
    user_id = uuid.uuid7()
    cursor = FakeCursor(fetchone=[_profile_row()])
    context = _make_context(user_id, [cursor])

    out = await _get_career_profile_impl(context)

    payload = json.loads(out)
    assert payload["exists"] is True
    assert payload["headline"] == "백엔드 엔지니어"
    assert payload["skills"] == ["Python", "FastAPI"]
    # Account identifiers must never enter model context.
    assert "user_id" not in payload
    assert "email" not in payload
    sql, params = cursor.executed[0]
    assert "user_id = %s" in sql
    assert params == (user_id,)


# ── list_postings_with_status ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_impl_scopes_by_user_and_projects_rows() -> None:
    user_id = uuid.uuid7()
    cursor = FakeCursor(fetchall=[[_strategist_row(1), _strategist_row(2)]])
    context = _make_context(user_id, [cursor])

    out = await _list_postings_with_status_impl(context, status=None, limit=20)

    payload = json.loads(out)
    assert payload["count"] == 2
    assert [item["id"] for item in payload["items"]] == [1, 2]
    sql, params = cursor.executed[0]
    assert "user_id = %(user_id)s" in sql
    assert params["user_id"] == user_id
    assert params["group_id"] is None
    assert params["status"] is None
    assert params["limit"] == 20


@pytest.mark.asyncio
async def test_list_impl_scopes_to_context_target_group() -> None:
    # The group scope comes only from the server-set context — the model has no
    # group argument to widen or change it.
    target_group_id = uuid.uuid7()
    cursor = FakeCursor(fetchall=[[]])
    context = _make_context(uuid.uuid7(), [cursor], target_group_id=target_group_id)

    out = await _list_postings_with_status_impl(context, status=None, limit=20)

    _, params = cursor.executed[0]
    assert params["group_id"] == target_group_id
    assert json.loads(out)["group_id"] == str(target_group_id)


@pytest.mark.asyncio
async def test_list_impl_invalid_status_returns_error_without_query() -> None:
    cursor = FakeCursor()
    context = _make_context(uuid.uuid7(), [cursor])

    out = await _list_postings_with_status_impl(context, status="bogus", limit=20)

    assert json.loads(out) == {"error": "invalid_status"}
    assert cursor.executed == []


@pytest.mark.asyncio
async def test_list_impl_valid_status_passes_through() -> None:
    target_group_id = uuid.uuid7()
    cursor = FakeCursor(fetchall=[[]])
    context = _make_context(uuid.uuid7(), [cursor], target_group_id=target_group_id)

    await _list_postings_with_status_impl(context, status="applied", limit=10)

    _, params = cursor.executed[0]
    assert params["group_id"] == target_group_id
    assert params["status"] == "applied"


@pytest.mark.asyncio
async def test_list_impl_clamps_limit_to_configured_maximum() -> None:
    cursor = FakeCursor(fetchall=[[]])
    context = _make_context(uuid.uuid7(), [cursor])

    await _list_postings_with_status_impl(context, status=None, limit=999)

    _, params = cursor.executed[0]
    assert params["limit"] == app_settings.strategist_plan_posting_limit


@pytest.mark.asyncio
async def test_list_impl_clamps_limit_to_minimum() -> None:
    cursor = FakeCursor(fetchall=[[]])
    context = _make_context(uuid.uuid7(), [cursor])

    await _list_postings_with_status_impl(context, status=None, limit=0)

    _, params = cursor.executed[0]
    assert params["limit"] == 1


# ── SQL shape (trim + PII omission) ───────────────────────────────────────────


def test_strategist_list_sql_trims_heavy_fields_and_omits_contact_person() -> None:
    # Heavy text fields are trimmed via LEFT() with the bound field_chars param.
    for field in ("qualifications", "preferred_points", "responsibilities"):
        assert f"LEFT({field}, %(field_chars)s)" in _STRATEGIST_LIST_SQL
    # contact_person (PII) must never be selected into model context.
    assert "contact_person" not in _STRATEGIST_LIST_SQL
    # Tenant scoping is mandatory.
    assert "user_id = %(user_id)s" in _STRATEGIST_LIST_SQL


@pytest.mark.asyncio
async def test_list_impl_binds_trim_length_param() -> None:
    cursor = FakeCursor(fetchall=[[]])
    context = _make_context(uuid.uuid7(), [cursor])

    await _list_postings_with_status_impl(context, status=None, limit=5)

    _, params = cursor.executed[0]
    assert params["field_chars"] == _MAX_STRATEGIST_FIELD_CHARS
