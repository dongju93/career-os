"""API-level tests for POST /v1/agent/plan.

FakePool + Bearer-JWT pattern from test_job_posting_update.py. The DB helper
functions and the run_strategist_plan wrapper are monkeypatched on the strategist
routes module, so neither a real database nor an OpenAI/Agents-SDK call is made.
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
from career_os_api.schemas import ApplicationPlan, PlanItem, ProposedAction

API_PREFIX = f"/{API_V1}"
PLAN_URL = f"{API_PREFIX}/agent/plan"


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
        "user_id": uuid.uuid7(),
        "headline": "백엔드 엔지니어",
        "years_experience": 5,
        "target_roles": ["Backend Engineer"],
        "skills": ["Python", "FastAPI"],
        "locations": ["Seoul"],
        "salary_expectation": None,
        "summary": None,
    }


def make_plan(job_ids: list[int]) -> ApplicationPlan:
    items = [
        PlanItem(
            job_id=job_id,
            company_name="Career OS",
            job_title="Backend Engineer",
            fit_score=80,
            matched_skills=["Python"],
            missing_skills=["Kubernetes"],
            deadline_urgency="soon",
            recommended_action="이번 주 내 지원하세요.",
            rationale="스킬 적합도가 높습니다.",
        )
        for job_id in job_ids
    ]
    return ApplicationPlan(summary="요약", items=items)


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


def test_plan_returns_404_when_disabled(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    # Flag defaults to False; the router dependency short-circuits to 404.
    response = client.post(PLAN_URL, json={}, headers=auth_headers)

    assert response.status_code == 404


def test_plan_returns_404_unauthenticated_when_disabled(client: TestClient) -> None:
    # 404, not 401 — the disabled route must not leak its existence.
    response = client.post(PLAN_URL, json={})

    assert response.status_code == 404


# ── auth ──────────────────────────────────────────────────────────────────────


def test_plan_requires_authentication(client: TestClient, enabled: None) -> None:
    response = client.post(PLAN_URL, json={})

    assert response.status_code == 401


# ── precondition failures ─────────────────────────────────────────────────────


def test_plan_returns_409_when_no_profile(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_current_group_id", AsyncMock(return_value=uuid.uuid7())
    )
    monkeypatch.setattr(routes_module, "get_user_profile", AsyncMock(return_value=None))
    run = AsyncMock()
    monkeypatch.setattr(routes_module, "run_strategist_plan", run)

    response = client.post(PLAN_URL, json={}, headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "플랜을 생성하려면 먼저 프로필을 작성해주세요."
    assert run.await_count == 0


def test_plan_returns_409_when_no_groups(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_current_group_id", AsyncMock(return_value=None)
    )
    profile = AsyncMock()
    monkeypatch.setattr(routes_module, "get_user_profile", profile)

    response = client.post(PLAN_URL, json={}, headers=auth_headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "구직 활동 그룹이 없습니다."
    # Group resolution fails first; profile is never read.
    assert profile.await_count == 0


def test_plan_returns_404_for_foreign_group_id(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    foreign_group = {"id": uuid.uuid7(), "user_id": uuid.uuid7()}
    monkeypatch.setattr(
        routes_module, "get_job_search_group", AsyncMock(return_value=foreign_group)
    )

    response = client.post(
        PLAN_URL, json={"group_id": str(uuid.uuid7())}, headers=auth_headers
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "구직 활동 그룹을 찾을 수 없습니다."


# ── empty group short-circuit ─────────────────────────────────────────────────


def test_plan_empty_group_returns_empty_plan_without_model_call(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_current_group_id", AsyncMock(return_value=uuid.uuid7())
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    monkeypatch.setattr(
        routes_module, "count_job_postings_for_strategist", AsyncMock(return_value=0)
    )
    run = AsyncMock()
    monkeypatch.setattr(routes_module, "run_strategist_plan", run)

    response = client.post(PLAN_URL, json={}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["data"]["items"] == []
    assert run.await_count == 0  # no model call for an empty group


# ── happy path + output post-validation ───────────────────────────────────────


def test_plan_happy_path_returns_envelope(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_current_group_id", AsyncMock(return_value=uuid.uuid7())
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    monkeypatch.setattr(
        routes_module, "count_job_postings_for_strategist", AsyncMock(return_value=2)
    )
    monkeypatch.setattr(
        routes_module,
        "run_strategist_plan",
        AsyncMock(return_value=make_plan([101, 102])),
    )
    monkeypatch.setattr(
        routes_module,
        "filter_owned_job_posting_ids",
        AsyncMock(return_value={101, 102}),
    )

    response = client.post(
        PLAN_URL, json={"focus": "백엔드 위주로"}, headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "지원 전략 플랜이 생성되었습니다."
    assert [item["job_id"] for item in body["data"]["items"]] == [101, 102]


def test_plan_drops_hallucinated_job_ids(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_current_group_id", AsyncMock(return_value=uuid.uuid7())
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    monkeypatch.setattr(
        routes_module, "count_job_postings_for_strategist", AsyncMock(return_value=2)
    )
    # The model emits an owned id (101) and a hallucinated/foreign id (999).
    monkeypatch.setattr(
        routes_module,
        "run_strategist_plan",
        AsyncMock(return_value=make_plan([101, 999])),
    )
    # Only 101 belongs to the caller.
    monkeypatch.setattr(
        routes_module, "filter_owned_job_posting_ids", AsyncMock(return_value={101})
    )

    response = client.post(PLAN_URL, json={}, headers=auth_headers)

    assert response.status_code == 200
    assert [item["job_id"] for item in response.json()["data"]["items"]] == [101]


def test_plan_scopes_id_verification_to_target_group(
    client: TestClient,
    auth_headers: dict[str, str],
    current_user: dict,
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # An explicit, owned group is requested, so the route must verify model job_ids
    # against *that* group — not just the user — closing the cross-group leak.
    target_group = uuid.uuid7()
    monkeypatch.setattr(
        routes_module,
        "get_job_search_group",
        AsyncMock(return_value={"id": target_group, "user_id": current_user["id"]}),
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    monkeypatch.setattr(
        routes_module, "count_job_postings_for_strategist", AsyncMock(return_value=2)
    )
    # The model echoes an in-group id (101) and a real-but-other-group id (202).
    monkeypatch.setattr(
        routes_module,
        "run_strategist_plan",
        AsyncMock(return_value=make_plan([101, 202])),
    )
    # The group-scoped filter only returns the in-group id.
    owned_filter = AsyncMock(return_value={101})
    monkeypatch.setattr(routes_module, "filter_owned_job_posting_ids", owned_filter)

    response = client.post(
        PLAN_URL, json={"group_id": str(target_group)}, headers=auth_headers
    )

    assert response.status_code == 200
    assert [item["job_id"] for item in response.json()["data"]["items"]] == [101]
    # The resolved target group is threaded into the ownership check.
    await_args = owned_filter.await_args
    assert await_args is not None
    assert await_args.kwargs["group_id"] == target_group


# ── Phase 2: proposed-action post-validation ──────────────────────────────────


def test_plan_filters_unowned_proposed_actions(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owned_group = uuid.uuid7()
    foreign_group = uuid.uuid7()
    actions = [
        # kept: owned posting, status-only action
        ProposedAction(
            action_type="set_status",
            job_id=101,
            application_status="applied",
            reason="지원 완료 표시",
        ),
        # dropped: posting not owned by the caller
        ProposedAction(
            action_type="set_status",
            job_id=999,
            application_status="applied",
            reason="환각 id",
        ),
        # kept: owned posting moved into an owned group
        ProposedAction(
            action_type="assign_group",
            job_id=101,
            target_group_id=str(owned_group),
            reason="정리",
        ),
        # dropped: target group is not the caller's
        ProposedAction(
            action_type="assign_group",
            job_id=101,
            target_group_id=str(foreign_group),
            reason="잘못된 그룹",
        ),
        # dropped: target group is not even a valid UUID
        ProposedAction(
            action_type="assign_group",
            job_id=101,
            target_group_id="not-a-uuid",
            reason="깨진 그룹 id",
        ),
        # kept: owned posting, memo action
        ProposedAction(
            action_type="save_memo",
            job_id=101,
            memo="포트폴리오 업데이트",
            reason="준비",
        ),
    ]
    plan = ApplicationPlan(
        summary="요약", items=make_plan([101]).items, proposed_actions=actions
    )

    monkeypatch.setattr(
        routes_module, "get_current_group_id", AsyncMock(return_value=uuid.uuid7())
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    monkeypatch.setattr(
        routes_module, "count_job_postings_for_strategist", AsyncMock(return_value=1)
    )
    monkeypatch.setattr(
        routes_module, "run_strategist_plan", AsyncMock(return_value=plan)
    )
    monkeypatch.setattr(
        routes_module, "filter_owned_job_posting_ids", AsyncMock(return_value={101})
    )
    monkeypatch.setattr(
        routes_module, "filter_owned_group_ids", AsyncMock(return_value={owned_group})
    )

    response = client.post(PLAN_URL, json={}, headers=auth_headers)

    assert response.status_code == 200
    kept = response.json()["data"]["proposed_actions"]
    assert len(kept) == 3
    assert [a["action_type"] for a in kept] == [
        "set_status",
        "assign_group",
        "save_memo",
    ]
    # The only surviving assign_group points at the owned group.
    assign = next(a for a in kept if a["action_type"] == "assign_group")
    assert assign["target_group_id"] == str(owned_group)
    assert all(a["job_id"] == 101 for a in kept)


def test_plan_returns_502_on_agent_failure(
    client: TestClient,
    auth_headers: dict[str, str],
    enabled: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        routes_module, "get_current_group_id", AsyncMock(return_value=uuid.uuid7())
    )
    monkeypatch.setattr(
        routes_module, "get_user_profile", AsyncMock(return_value=make_profile())
    )
    monkeypatch.setattr(
        routes_module, "count_job_postings_for_strategist", AsyncMock(return_value=1)
    )
    monkeypatch.setattr(
        routes_module,
        "run_strategist_plan",
        AsyncMock(side_effect=AgentsException("model exploded")),
    )

    response = client.post(PLAN_URL, json={}, headers=auth_headers)

    assert response.status_code == 502
    assert (
        response.json()["detail"]
        == "플랜 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
    )
