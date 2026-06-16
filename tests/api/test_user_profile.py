"""API-level tests for the career profile endpoints (GET/PUT /v1/profile).

Reuses the FakePool + Bearer-JWT auth pattern from test_router.py. The profile DB
helpers are monkeypatched on the router module, so no real database is touched —
auth's find_user_by_id still resolves through the FakeConnection's user row.
"""

import uuid
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

import career_os_api.router as app_module
import main as main_module
from career_os_api.auth.jwt import create_access_token
from career_os_api.constants import API_V1

API_PREFIX = f"/{API_V1}"
PROFILE_URL = f"{API_PREFIX}/profile"

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


def make_profile_row(*, user_id, inserted: bool) -> dict:
    return {
        "user_id": user_id,
        "headline": "Backend Engineer",
        "years_experience": 5,
        "target_roles": ["Backend Engineer"],
        "skills": ["Python", "FastAPI"],
        "locations": ["Seoul"],
        "salary_expectation": "협의",
        "summary": "5년차 백엔드 개발자",
        "created_at": _TIMESTAMP,
        "updated_at": _TIMESTAMP,
        "inserted": inserted,
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


def test_get_profile_requires_authentication(client: TestClient) -> None:
    response = client.get(PROFILE_URL)

    assert response.status_code == 401


def test_get_profile_returns_404_when_absent(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(app_module, "get_user_profile", AsyncMock(return_value=None))

    response = client.get(PROFILE_URL, headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "프로필이 아직 없습니다."


def test_get_profile_returns_stored_profile(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = make_profile_row(user_id=current_user["id"], inserted=False)
    monkeypatch.setattr(app_module, "get_user_profile", AsyncMock(return_value=row))

    response = client.get(PROFILE_URL, headers=auth_headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["headline"] == "Backend Engineer"
    assert data["skills"] == ["Python", "FastAPI"]
    assert "user_id" not in data  # response shape must not leak account identity


def test_put_profile_returns_201_on_first_create(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = make_profile_row(user_id=current_user["id"], inserted=True)
    upsert = AsyncMock(return_value=row)
    monkeypatch.setattr(app_module, "upsert_user_profile", upsert)

    response = client.put(
        PROFILE_URL,
        json={"headline": "Backend Engineer", "years_experience": 5},
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["message"] == "프로필이 생성되었습니다."
    assert upsert.await_count == 1


def test_put_profile_returns_200_on_replace(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = make_profile_row(user_id=current_user["id"], inserted=False)
    monkeypatch.setattr(app_module, "upsert_user_profile", AsyncMock(return_value=row))

    response = client.put(
        PROFILE_URL,
        json={"headline": "Backend Engineer"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["message"] == "프로필이 수정되었습니다."


def test_put_profile_rejects_over_limit_fields(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    upsert = AsyncMock()
    monkeypatch.setattr(app_module, "upsert_user_profile", upsert)

    response = client.put(
        PROFILE_URL,
        json={"headline": "x" * 201, "years_experience": 99},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert upsert.await_count == 0


@pytest.mark.parametrize("field", ["target_roles", "skills", "locations"])
def test_put_profile_rejects_scalar_for_array_fields(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    field: str,
) -> None:
    """A JSON scalar for a list[str] field must 422, not be exploded into chars.

    Regression: the mode="before" validator iterated the raw value directly, so
    "Python" was cleaned into ['P', 'y', 't', 'h', 'o', 'n'] and stored as a
    bogus TEXT[] instead of failing type validation.
    """
    upsert = AsyncMock()
    monkeypatch.setattr(app_module, "upsert_user_profile", upsert)

    response = client.put(
        PROFILE_URL,
        json={field: "Python"},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert upsert.await_count == 0
