"""API-level tests for PATCH /v1/job-postings/{job_id} (application status).

FakePool + Bearer-JWT pattern from test_router.py; update_job_posting_fields is
monkeypatched on the router module so no real database is touched.
"""

import uuid
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from psycopg.errors import UniqueViolation

import career_os_api.router as app_module
import main as main_module
from career_os_api.auth.jwt import create_access_token
from career_os_api.constants import API_V1
from career_os_api.database.job_postings import TargetGroupNotFoundError

API_PREFIX = f"/{API_V1}"

_TIMESTAMP = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)


def make_current_user() -> dict:
    return {
        "id": uuid.uuid7(),
        "google_id": "google-user-1",
        "email": "user@example.com",
        "name": "Career OS User",
        "picture": None,
        "is_active": True,
    }


def make_detail_row(sample_job_posting, *, status: str, status_at) -> dict:
    return {
        "id": 7,
        "group_id": uuid.uuid7(),
        **sample_job_posting.model_dump(),
        "application_status": status,
        "status_updated_at": status_at,
        "scraped_at": _TIMESTAMP,
        "created_at": _TIMESTAMP,
        "updated_at": _TIMESTAMP,
    }


class FakeCursor:
    def __init__(self, row: dict | None) -> None:
        self._row = row

    async def execute(self, sql: str, params=None) -> None:  # NOSONAR
        return None

    async def fetchone(self):  # NOSONAR
        return self._row

    async def __aenter__(self) -> FakeCursor:
        return self

    async def __aexit__(self, *exc) -> None:
        return None


class FakeConnection:
    def __init__(self, *, user_row: dict | None) -> None:
        self.user_row = user_row

    async def execute(self, query: str) -> None:  # NOSONAR (DDL at startup)
        return None

    def cursor(self, **kwargs) -> FakeCursor:
        return FakeCursor(self.user_row)

    @asynccontextmanager
    async def transaction(self):  # NOSONAR
        yield


class FakePool:
    def __init__(self, *, user_row: dict | None) -> None:
        self.connection_obj = FakeConnection(user_row=user_row)

    @asynccontextmanager
    async def connection(self) -> AsyncGenerator[FakeConnection]:
        yield self.connection_obj


@pytest.fixture
def fake_pool() -> FakePool:
    return FakePool(user_row=make_current_user())


@pytest.fixture
def current_user(fake_pool: FakePool) -> dict:
    assert fake_pool.connection_obj.user_row is not None
    return fake_pool.connection_obj.user_row


@pytest.fixture
def auth_headers(current_user: dict) -> dict[str, str]:
    token = create_access_token(data={"sub": str(current_user["id"])})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(
    monkeypatch: pytest.MonkeyPatch, fake_pool: FakePool
) -> Generator[TestClient]:
    @asynccontextmanager
    async def fake_create_postgres_pool() -> AsyncGenerator[FakePool]:
        yield fake_pool

    monkeypatch.setattr(main_module, "create_postgres_pool", fake_create_postgres_pool)

    with TestClient(main_module.career_os) as test_client:
        yield test_client


def test_patch_requires_authentication(client: TestClient) -> None:
    response = client.patch(
        f"{API_PREFIX}/job-postings/7", json={"application_status": "applied"}
    )

    assert response.status_code == 401


def test_patch_updates_status_and_returns_updated_posting(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    row = make_detail_row(sample_job_posting, status="applied", status_at=_TIMESTAMP)
    update = AsyncMock(return_value=row)
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"application_status": "applied"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["application_status"] == "applied"
    assert data["status_updated_at"] is not None
    update.assert_awaited_once_with(
        fake_pool.connection_obj,
        user_id=current_user["id"],
        job_id=7,
        fields={"application_status": "applied"},
    )


def test_patch_returns_404_for_foreign_or_missing_id(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        app_module, "update_job_posting_fields", AsyncMock(return_value=None)
    )

    response = client.patch(
        f"{API_PREFIX}/job-postings/999",
        json={"application_status": "applied"},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Job posting 999 not found"


def test_patch_rejects_empty_body(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = AsyncMock()
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7", json={}, headers=auth_headers
    )

    assert response.status_code == 422
    assert update.await_count == 0


def test_patch_rejects_explicit_null_status(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = AsyncMock()
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"application_status": None},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert update.await_count == 0


def test_patch_rejects_invalid_status_value(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = AsyncMock()
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"application_status": "not-a-status"},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert update.await_count == 0


# ── Phase 2: memo set / clear ─────────────────────────────────────────────────


def test_patch_sets_memo(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    row = make_detail_row(sample_job_posting, status="saved", status_at=None)
    row["memo"] = "지원 전 포트폴리오 정리"
    update = AsyncMock(return_value=row)
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"memo": "지원 전 포트폴리오 정리"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["memo"] == "지원 전 포트폴리오 정리"
    update.assert_awaited_once_with(
        fake_pool.connection_obj,
        user_id=current_user["id"],
        job_id=7,
        fields={"memo": "지원 전 포트폴리오 정리"},
    )


def test_patch_clears_memo_with_explicit_null(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    # An explicit null memo is a valid "clear" — it must be written, not ignored.
    row = make_detail_row(sample_job_posting, status="saved", status_at=None)
    row["memo"] = None
    update = AsyncMock(return_value=row)
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"memo": None},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["memo"] is None
    update.assert_awaited_once_with(
        fake_pool.connection_obj,
        user_id=current_user["id"],
        job_id=7,
        fields={"memo": None},
    )


# ── Phase 2: group move ───────────────────────────────────────────────────────


def test_patch_moves_posting_to_another_group(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    target_group = uuid.uuid7()
    row = make_detail_row(sample_job_posting, status="saved", status_at=None)
    row["group_id"] = target_group
    update = AsyncMock(return_value=row)
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"group_id": str(target_group)},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["group_id"] == str(target_group)
    update.assert_awaited_once_with(
        fake_pool.connection_obj,
        user_id=current_user["id"],
        job_id=7,
        fields={"group_id": target_group},
    )


def test_patch_returns_404_for_foreign_target_group(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        app_module,
        "update_job_posting_fields",
        AsyncMock(side_effect=TargetGroupNotFoundError()),
    )

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"group_id": str(uuid.uuid7())},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "대상 구직 활동 그룹을 찾을 수 없습니다."


def test_patch_returns_409_when_target_group_already_has_posting(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # The uq_job_postings_group_id unique index collides on a cross-group move.
    monkeypatch.setattr(
        app_module,
        "update_job_posting_fields",
        AsyncMock(side_effect=UniqueViolation("duplicate posting in group")),
    )

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"group_id": str(uuid.uuid7())},
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert (
        response.json()["detail"] == "이미 대상 그룹에 같은 공고가 저장되어 있습니다."
    )


def test_patch_rejects_explicit_null_group_id(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # group_id maps to a NOT NULL column — explicit null is rejected at the schema.
    update = AsyncMock()
    monkeypatch.setattr(app_module, "update_job_posting_fields", update)

    response = client.patch(
        f"{API_PREFIX}/job-postings/7",
        json={"group_id": None},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert update.await_count == 0
