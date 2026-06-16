"""API-level tests for POST /v1/agent/artifact.

Same FakePool + Bearer-JWT pattern as test_strategist_plan.py. get_job_posting,
get_user_profile, and the run_strategist_artifact wrapper are monkeypatched on the
strategist routes module, so neither a real database nor an OpenAI/Agents-SDK call
is made.
"""

import uuid
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from agents.exceptions import AgentsException
from fastapi.testclient import TestClient

import career_os_api.strategist.strategist_routes as routes_module
import main as main_module
from career_os_api.auth.jwt import create_access_token
from career_os_api.constants import API_V1
from career_os_api.schemas import ApplicationArtifact, ArtifactType

API_PREFIX = f"/{API_V1}"
ARTIFACT_URL = f"{API_PREFIX}/agent/artifact"


def make_current_user() -> dict:
    return {
        "id": uuid.uuid7(),
        "google_id": "google-user-1",
        "email": "user@example.com",
        "name": "Career OS User",
        "picture": None,
        "is_active": True,
    }


def make_profile() -> dict:
    return {
        "headline": "백엔드 엔지니어",
        "years_experience": 5,
        "target_roles": ["Backend Engineer"],
        "skills": ["Python", "FastAPI"],
        "locations": ["Seoul"],
        "salary_expectation": None,
        "summary": None,
    }


def make_posting(job_id: int = 101) -> dict:
    """A posting dict carrying every key compose_artifact_input reads (it runs in the
    handler before the monkeypatched model wrapper)."""
    return {
        "id": job_id,
        "company_name": "Career OS",
        "job_title": "Backend Engineer",
        "employment_type": "정규직",
        "experience_req": "3년 이상",
        "education_req": "무관",
        "location": "Seoul",
        "deadline": "2026-06-30",
        "tech_stack": ["Python", "FastAPI"],
        "job_category": "개발",
        "industry": "IT",
        "job_description": "직무 설명",
        "responsibilities": "API 설계 및 운영",
        "qualifications": "Python 숙련",
        "preferred_points": "클라우드 경험",
        "benefits": "유연근무",
        "contact_person": "홍길동 채용담당자",
    }


def make_artifact(
    *, job_id: int, artifact_type: ArtifactType = "resume_bullets"
) -> ApplicationArtifact:
    return ApplicationArtifact(
        artifact_type=artifact_type,
        job_id=job_id,
        title="이력서 불릿",
        content_markdown="- Python 백엔드 5년 경험",
    )


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


@pytest.fixture
def enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Turn the feature flag on for tests that need the route to run."""
    monkeypatch.setattr(routes_module.settings, "strategist_agent_enabled", True)


# ── feature flag ──────────────────────────────────────────────────────────────


def test_artifact_returns_404_when_disabled(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        ARTIFACT_URL,
        json={"job_id": 101, "artifact_type": "resume_bullets"},
        headers=auth_headers,
    )

    assert response.status_code == 404


def test_artifact_returns_404_unauthenticated_when_disabled(client: TestClient) -> None:
    # 404, not 401 — the disabled route must not leak its existence.
    response = client.post(
        ARTIFACT_URL, json={"job_id": 101, "artifact_type": "resume_bullets"}
    )

    assert response.status_code == 404


# ── auth ──────────────────────────────────────────────────────────────────────


def test_artifact_requires_authentication(client: TestClient, enabled: None) -> None:
    response = client.post(
        ARTIFACT_URL, json={"job_id": 101, "artifact_type": "resume_bullets"}
    )

    assert response.status_code == 401


# ── precondition failures ─────────────────────────────────────────────────────


def test_artifact_returns_404_when_posting_missing(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(routes_module, "get_job_posting", AsyncMock(return_value=None))
    run = AsyncMock()
    monkeypatch.setattr(routes_module, "run_strategist_artifact", run)

    response = client.post(
        ARTIFACT_URL,
        json={"job_id": 999, "artifact_type": "resume_bullets"},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Job posting 999 not found"
    assert run.await_count == 0


def test_artifact_returns_409_when_no_profile(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_job_posting", AsyncMock(return_value=make_posting())
    )
    monkeypatch.setattr(routes_module, "get_user_profile", AsyncMock(return_value=None))
    run = AsyncMock()
    monkeypatch.setattr(routes_module, "run_strategist_artifact", run)

    response = client.post(
        ARTIFACT_URL,
        json={"job_id": 101, "artifact_type": "resume_bullets"},
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert (
        response.json()["detail"]
        == "지원 자료를 생성하려면 먼저 프로필을 작성해주세요."
    )
    assert run.await_count == 0


def test_artifact_returns_422_on_missing_fields(
    client: TestClient, auth_headers: dict[str, str], enabled: None
) -> None:
    # job_id and artifact_type are both required.
    response = client.post(ARTIFACT_URL, json={"job_id": 101}, headers=auth_headers)

    assert response.status_code == 422


# ── happy path + output pinning ───────────────────────────────────────────────


def test_artifact_happy_path_pins_job_id_and_type(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_job_posting", AsyncMock(return_value=make_posting())
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    # The model echoes a wrong job_id (999) and a wrong artifact_type; the route must
    # pin both back to the verified request values.
    monkeypatch.setattr(
        routes_module,
        "run_strategist_artifact",
        AsyncMock(
            return_value=make_artifact(job_id=999, artifact_type="interview_prep")
        ),
    )

    response = client.post(
        ARTIFACT_URL,
        json={"job_id": 101, "artifact_type": "resume_bullets", "focus": "기술 중심"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "지원 자료가 생성되었습니다."
    assert body["data"]["job_id"] == 101
    assert body["data"]["artifact_type"] == "resume_bullets"
    assert body["data"]["content_markdown"]


def test_artifact_returns_502_on_agent_failure(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_job_posting", AsyncMock(return_value=make_posting())
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    monkeypatch.setattr(
        routes_module,
        "run_strategist_artifact",
        AsyncMock(side_effect=AgentsException("model exploded")),
    )

    response = client.post(
        ARTIFACT_URL,
        json={"job_id": 101, "artifact_type": "cover_letter"},
        headers=auth_headers,
    )

    assert response.status_code == 502
    assert (
        response.json()["detail"]
        == "지원 자료 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
    )
