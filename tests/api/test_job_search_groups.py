"""API-level tests for job search group endpoints."""

import uuid
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

import career_os_api.router as app_module
import main as main_module
from career_os_api.auth.jwt import create_access_token
from career_os_api.constants import API_V1

API_PREFIX = f"/{API_V1}"


def to_api_datetime(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def make_current_user() -> dict:
    return {
        "id": uuid.uuid7(),
        "google_id": "google-user-1",
        "email": "user@example.com",
        "name": "Career OS User",
        "picture": None,
        "is_active": True,
    }


def make_group_row(
    *,
    user_id,
    group_id=None,
    name: str = "2026 상반기",
    started_at: date = date(2026, 1, 1),
    ended_at: date | None = None,
    memo: str | None = None,
) -> dict:
    now = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
    return {
        "id": group_id or uuid.uuid7(),
        "user_id": user_id,
        "name": name,
        "started_at": started_at,
        "ended_at": ended_at,
        "memo": memo,
        "created_at": now,
        "updated_at": now,
    }


def make_group_list_row(
    *, user_id, group_id=None, posting_count: int = 0, **kwargs
) -> dict:
    row = make_group_row(user_id=user_id, group_id=group_id, **kwargs)
    row.pop("user_id")
    row["posting_count"] = posting_count
    return row


class FakeResult:
    async def fetchone(self) -> tuple[int]:  # NOSONAR
        return (1,)


class FakeCursor:
    def __init__(self, row: dict | None) -> None:
        self._row = row

    async def execute(self, sql: str, params=None) -> None:  # NOSONAR
        return None

    async def fetchone(self):  # NOSONAR
        return self._row

    async def __aenter__(self) -> FakeCursor:
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


class FakeConnection:
    def __init__(self, *, user_row: dict | None) -> None:
        self.user_row = user_row

    async def execute(self, query: str) -> FakeResult:  # NOSONAR
        return FakeResult()

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


# ── GET /job-search-groups ────────────────────────────────────────────────────


def test_list_groups_returns_paginated_result(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group = make_group_list_row(user_id=current_user["id"], posting_count=3)
    monkeypatch.setattr(
        app_module,
        "get_job_search_groups",
        AsyncMock(return_value=([group], 1)),
    )

    response = client.get(f"{API_PREFIX}/job-search-groups", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["name"] == group["name"]
    assert body["data"]["items"][0]["posting_count"] == 3


def test_list_groups_requires_authentication(client: TestClient) -> None:
    response = client.get(f"{API_PREFIX}/job-search-groups")
    assert response.status_code == 401


def test_list_groups_passes_status_filter(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock = AsyncMock(return_value=([], 0))
    monkeypatch.setattr(app_module, "get_job_search_groups", mock)

    client.get(
        f"{API_PREFIX}/job-search-groups",
        params={"status": "active"},
        headers=auth_headers,
    )

    mock.assert_awaited_once()
    assert mock.await_args is not None
    _, kwargs = mock.await_args
    assert kwargs["status"] == "active"


# ── POST /job-search-groups ───────────────────────────────────────────────────


def test_create_group_returns_201(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = make_group_row(user_id=current_user["id"], name="스타트업 집중")
    monkeypatch.setattr(
        app_module, "create_job_search_group", AsyncMock(return_value=row)
    )

    response = client.post(
        f"{API_PREFIX}/job-search-groups",
        json={"name": "스타트업 집중"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["data"]["name"] == "스타트업 집중"


def test_create_group_rejects_invalid_date_order(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        f"{API_PREFIX}/job-search-groups",
        json={
            "name": "잘못된 날짜",
            "started_at": "2026-06-01",
            "ended_at": "2026-05-01",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_create_group_rejects_empty_name(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        f"{API_PREFIX}/job-search-groups",
        json={"name": ""},
        headers=auth_headers,
    )
    assert response.status_code == 422


# ── GET /job-search-groups/{id} ───────────────────────────────────────────────


def test_get_group_returns_200_for_owner(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group_id = uuid.uuid7()
    row = make_group_row(user_id=current_user["id"], group_id=group_id)
    monkeypatch.setattr(app_module, "get_job_search_group", AsyncMock(return_value=row))

    response = client.get(
        f"{API_PREFIX}/job-search-groups/{group_id}", headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["data"]["id"] == str(group_id)


def test_get_group_returns_404_when_not_found(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        app_module, "get_job_search_group", AsyncMock(return_value=None)
    )

    response = client.get(
        f"{API_PREFIX}/job-search-groups/{uuid.uuid7()}", headers=auth_headers
    )

    assert response.status_code == 404


def test_get_group_returns_403_for_wrong_owner(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    other_user_id = uuid.uuid7()
    group_id = uuid.uuid7()
    row = make_group_row(user_id=other_user_id, group_id=group_id)
    monkeypatch.setattr(app_module, "get_job_search_group", AsyncMock(return_value=row))

    response = client.get(
        f"{API_PREFIX}/job-search-groups/{group_id}", headers=auth_headers
    )

    assert response.status_code == 403


# ── PATCH /job-search-groups/{id} ────────────────────────────────────────────


def test_patch_group_updates_name(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group_id = uuid.uuid7()
    existing = make_group_row(user_id=current_user["id"], group_id=group_id)
    updated = {**existing, "name": "새 이름"}
    monkeypatch.setattr(
        app_module, "get_job_search_group", AsyncMock(return_value=existing)
    )
    monkeypatch.setattr(
        app_module, "update_job_search_group", AsyncMock(return_value=updated)
    )

    response = client.patch(
        f"{API_PREFIX}/job-search-groups/{group_id}",
        json={"name": "새 이름"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["name"] == "새 이름"


def test_patch_group_rejects_null_name(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group_id = uuid.uuid7()
    existing = make_group_row(user_id=current_user["id"], group_id=group_id)
    monkeypatch.setattr(
        app_module, "get_job_search_group", AsyncMock(return_value=existing)
    )

    response = client.patch(
        f"{API_PREFIX}/job-search-groups/{group_id}",
        json={"name": None},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_patch_group_rejects_invalid_date_range(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group_id = uuid.uuid7()
    existing = make_group_row(
        user_id=current_user["id"], group_id=group_id, started_at=date(2026, 1, 1)
    )
    monkeypatch.setattr(
        app_module, "get_job_search_group", AsyncMock(return_value=existing)
    )

    response = client.patch(
        f"{API_PREFIX}/job-search-groups/{group_id}",
        json={"ended_at": "2025-12-31"},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_patch_group_returns_403_for_wrong_owner(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group_id = uuid.uuid7()
    row = make_group_row(user_id=uuid.uuid7(), group_id=group_id)
    monkeypatch.setattr(app_module, "get_job_search_group", AsyncMock(return_value=row))

    response = client.patch(
        f"{API_PREFIX}/job-search-groups/{group_id}",
        json={"name": "hacked"},
        headers=auth_headers,
    )

    assert response.status_code == 403


# ── DELETE /job-search-groups/{id} ───────────────────────────────────────────


def test_delete_group_returns_204(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group_id = uuid.uuid7()
    other_group_id = uuid.uuid7()
    monkeypatch.setattr(
        app_module,
        "get_user_group_ids_for_update",
        AsyncMock(return_value=[group_id, other_group_id]),
    )
    monkeypatch.setattr(
        app_module, "delete_job_search_group", AsyncMock(return_value=True)
    )

    response = client.delete(
        f"{API_PREFIX}/job-search-groups/{group_id}", headers=auth_headers
    )

    assert response.status_code == 204


def test_delete_last_group_returns_409(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    group_id = uuid.uuid7()
    monkeypatch.setattr(
        app_module,
        "get_user_group_ids_for_update",
        AsyncMock(return_value=[group_id]),
    )

    response = client.delete(
        f"{API_PREFIX}/job-search-groups/{group_id}", headers=auth_headers
    )

    assert response.status_code == 409
    assert "마지막" in response.json()["detail"]


def test_delete_returns_404_for_unknown_group(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        app_module,
        "get_user_group_ids_for_update",
        AsyncMock(return_value=[uuid.uuid7()]),
    )

    response = client.delete(
        f"{API_PREFIX}/job-search-groups/{uuid.uuid7()}", headers=auth_headers
    )

    assert response.status_code == 404


# ── GET /job-postings?group_id= ──────────────────────────────────────────────


def test_list_postings_with_group_id_returns_403_for_wrong_owner(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    other_group_id = uuid.uuid7()
    row = make_group_row(user_id=uuid.uuid7(), group_id=other_group_id)
    monkeypatch.setattr(app_module, "get_job_search_group", AsyncMock(return_value=row))

    response = client.get(
        f"{API_PREFIX}/job-postings",
        params={"group_id": str(other_group_id)},
        headers=auth_headers,
    )

    assert response.status_code == 403


def test_list_postings_with_group_id_returns_403_for_nonexistent(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        app_module, "get_job_search_group", AsyncMock(return_value=None)
    )

    response = client.get(
        f"{API_PREFIX}/job-postings",
        params={"group_id": str(uuid.uuid7())},
        headers=auth_headers,
    )

    assert response.status_code == 403
