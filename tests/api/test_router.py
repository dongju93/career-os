from collections.abc import AsyncIterator, Generator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import ANY, AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from psycopg import OperationalError

import career_os_api.database.retry as retry_module
import career_os_api.router as app_module
import main as main_module
from career_os_api.auth.jwt import create_access_token
from career_os_api.auth.risc import (
    EVENT_ACCOUNT_DISABLED,
    RiscEvent,
    RiscVerificationError,
    RiscVerificationUnavailableError,
)
from career_os_api.constants import API_V1

API_PREFIX = f"/{API_V1}"


def to_api_datetime(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def make_stored_row(sample_job_posting, *, job_id: int = 1) -> dict:
    timestamp = datetime(2026, 4, 13, 9, 0, tzinfo=UTC)
    return {
        "id": job_id,
        **sample_job_posting.model_dump(),
        "scraped_at": timestamp,
        "created_at": timestamp,
        "updated_at": timestamp,
    }


def make_list_row(sample_job_posting, *, job_id: int = 1) -> dict:
    stored = make_stored_row(sample_job_posting, job_id=job_id)
    return {
        "id": stored["id"],
        "platform": stored["platform"],
        "posting_id": stored["posting_id"],
        "posting_url": stored["posting_url"],
        "company_name": stored["company_name"],
        "job_title": stored["job_title"],
        "experience_req": stored["experience_req"],
        "deadline": stored["deadline"],
        "location": stored["location"],
        "employment_type": stored["employment_type"],
        "salary": stored["salary"],
        "tech_stack": stored["tech_stack"],
        "tags": stored["tags"],
        "job_category": stored["job_category"],
        "industry": stored["industry"],
        "scraped_at": stored["scraped_at"],
        "created_at": stored["created_at"],
        "updated_at": stored["updated_at"],
    }


def make_current_user() -> dict:
    return {
        "id": uuid4(),
        "google_id": "google-user-1",
        "email": "user@example.com",
        "name": "Career OS User",
        "picture": None,
        "is_active": True,
    }


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
        self.executed_queries: list[str] = []

    async def execute(self, query: str) -> FakeResult:  # NOSONAR
        self.executed_queries.append(query)
        return FakeResult()

    def cursor(self, **kwargs) -> FakeCursor:
        return FakeCursor(self.user_row)


class FakePool:
    def __init__(self, *, user_row: dict | None) -> None:
        self.connection_obj = FakeConnection(user_row=user_row)
        self.connection_attempts = 0
        self.connection_failures_remaining = 0

    @asynccontextmanager
    async def connection(self) -> AsyncIterator[FakeConnection]:
        self.connection_attempts += 1
        if self.connection_failures_remaining > 0:
            self.connection_failures_remaining -= 1
            raise OperationalError("temporary database connection failure")
        yield self.connection_obj

    def reset_connection_tracking(self) -> None:
        self.connection_attempts = 0
        self.connection_failures_remaining = 0


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
    async def fake_create_postgres_pool() -> AsyncIterator[FakePool]:
        yield fake_pool

    monkeypatch.setattr(main_module, "create_postgres_pool", fake_create_postgres_pool)

    with TestClient(main_module.career_os) as test_client:
        yield test_client


def test_root_endpoint_returns_hello_world(client: TestClient) -> None:
    response = client.get(f"{API_PREFIX}/")

    assert response.status_code == 200
    assert response.json() == {"status": 200, "message": "Hello, World!", "data": None}


def test_google_callback_does_not_include_token_in_redirect_url(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = uuid4()
    mock_token = {
        "userinfo": {
            "sub": "google-sub-123",
            "email": "user@example.com",
            "name": "Test User",
            "picture": None,
        }
    }
    fake_user = {
        "id": user_id,
        "google_id": "google-sub-123",
        "email": "user@example.com",
        "name": "Test User",
        "picture": None,
        "is_active": True,
        "auth_session_revoked_at": None,
    }

    monkeypatch.setattr(
        app_module.oauth.google,
        "authorize_access_token",
        AsyncMock(return_value=mock_token),
    )
    monkeypatch.setattr(app_module, "upsert_user", AsyncMock(return_value=fake_user))

    response = client.get(
        f"{API_PREFIX}/auth/google/callback",
        follow_redirects=False,
    )

    assert response.status_code in (302, 307)
    assert "access_token" not in response.headers["location"]


def test_list_job_postings_endpoint_returns_paginated_results(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    rows = [make_list_row(sample_job_posting, job_id=7)]
    get_job_postings = AsyncMock(return_value=(rows, 1))

    monkeypatch.setattr(app_module, "get_job_postings", get_job_postings)

    response = client.get(
        f"{API_PREFIX}/job-postings",
        params={"offset": 5, "limit": 10},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": 200,
        "message": "채용공고 목록을 조회했습니다.",
        "data": {
            "items": [
                {
                    "id": 7,
                    "platform": "saramin",
                    "posting_id": sample_job_posting.posting_id,
                    "posting_url": sample_job_posting.posting_url,
                    "company_name": sample_job_posting.company_name,
                    "job_title": sample_job_posting.job_title,
                    "experience_req": sample_job_posting.experience_req,
                    "deadline": sample_job_posting.deadline,
                    "location": sample_job_posting.location,
                    "employment_type": sample_job_posting.employment_type,
                    "salary": sample_job_posting.salary,
                    "tech_stack": sample_job_posting.tech_stack,
                    "tags": sample_job_posting.tags,
                    "job_category": sample_job_posting.job_category,
                    "industry": sample_job_posting.industry,
                    "scraped_at": to_api_datetime(rows[0]["scraped_at"]),
                    "created_at": to_api_datetime(rows[0]["created_at"]),
                    "updated_at": to_api_datetime(rows[0]["updated_at"]),
                }
            ],
            "total": 1,
            "offset": 5,
            "limit": 10,
        },
    }
    get_job_postings.assert_awaited_once_with(
        fake_pool.connection_obj,
        user_id=current_user["id"],
        limit=10,
        offset=5,
        with_total=True,
    )


def test_job_posting_extraction_endpoint_returns_extracted_payload(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    fetch_url_content = AsyncMock(
        return_value=(b"<html><body>Backend Engineer</body></html>", "text/html")
    )
    extract_job_posting = AsyncMock(return_value=sample_job_posting)

    monkeypatch.setattr(app_module, "fetch_url_content", fetch_url_content)
    monkeypatch.setattr(app_module, "extract_job_posting", extract_job_posting)

    response = client.get(
        f"{API_PREFIX}/job-postings/extraction",
        params={"url": sample_job_posting.posting_url},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["posting_id"] == sample_job_posting.posting_id
    assert response.json()["data"]["company_name"] == sample_job_posting.company_name
    fetch_url_content.assert_awaited_once_with(sample_job_posting.posting_url, ANY)
    extract_job_posting.assert_awaited_once_with(
        html_content=b"<html><body>Backend Engineer</body></html>",
        source_url=sample_job_posting.posting_url,
        image_client=ANY,
        openai_client=ANY,
    )


def test_job_posting_extraction_endpoint_requires_url_query(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.get(f"{API_PREFIX}/job-postings/extraction", headers=auth_headers)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("method", "path", "kwargs"),
    [
        ("get", f"{API_PREFIX}/job-postings", {}),
        (
            "get",
            f"{API_PREFIX}/job-postings/extraction",
            {"params": {"url": "https://example.com"}},
        ),
        (
            "post",
            f"{API_PREFIX}/job-postings",
            {"json": {"platform": "saramin", "posting_id": "4930"}},
        ),
        ("get", f"{API_PREFIX}/job-postings/19", {}),
    ],
)
def test_job_posting_routes_require_authentication(
    client: TestClient,
    method: str,
    path: str,
    kwargs: dict,
) -> None:
    response = getattr(client, method)(path, **kwargs)

    assert response.status_code == 401


def test_create_job_posting_endpoint_returns_created_record(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    stored = make_stored_row(sample_job_posting, job_id=11)
    upsert_job_posting = AsyncMock(
        return_value={
            "id": stored["id"],
            "scraped_at": stored["scraped_at"],
            "created_at": stored["created_at"],
            "updated_at": stored["updated_at"],
            "inserted": True,
        }
    )
    monkeypatch.setattr(app_module, "upsert_job_posting", upsert_job_posting)

    response = client.post(
        f"{API_PREFIX}/job-postings",
        json=sample_job_posting.model_dump(mode="json"),
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json() == {
        "status": 201,
        "message": "채용공고가 저장되었습니다.",
        "data": {
            "id": 11,
            **sample_job_posting.model_dump(mode="json"),
            "scraped_at": to_api_datetime(stored["scraped_at"]),
            "created_at": to_api_datetime(stored["created_at"]),
            "updated_at": to_api_datetime(stored["updated_at"]),
        },
    }
    assert upsert_job_posting.await_count == 1
    await_args = upsert_job_posting.await_args
    assert await_args is not None
    assert await_args.args[0] is fake_pool.connection_obj
    assert await_args.args[1].model_dump() == sample_job_posting.model_dump()
    assert await_args.kwargs == {"user_id": current_user["id"]}


def test_create_job_posting_endpoint_returns_200_for_updates(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    stored = make_stored_row(sample_job_posting, job_id=11)
    monkeypatch.setattr(
        app_module,
        "upsert_job_posting",
        AsyncMock(
            return_value={
                "id": stored["id"],
                "scraped_at": stored["scraped_at"],
                "created_at": stored["created_at"],
                "updated_at": stored["updated_at"],
                "inserted": False,
            }
        ),
    )

    response = client.post(
        f"{API_PREFIX}/job-postings",
        json=sample_job_posting.model_dump(mode="json"),
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["id"] == 11


def test_create_job_posting_endpoint_rejects_blank_posting_id(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    upsert_job_posting = AsyncMock()
    monkeypatch.setattr(app_module, "upsert_job_posting", upsert_job_posting)

    payload = sample_job_posting.model_dump(mode="json")
    payload["posting_id"] = ""

    response = client.post(
        f"{API_PREFIX}/job-postings",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["loc"] == ["body", "posting_id"]
    assert upsert_job_posting.await_count == 0


def test_get_job_posting_detail_endpoint_returns_stored_record(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    stored = make_stored_row(sample_job_posting, job_id=19)
    get_job_posting = AsyncMock(return_value=stored)

    monkeypatch.setattr(app_module, "get_job_posting", get_job_posting)

    response = client.get(f"{API_PREFIX}/job-postings/19", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {
        "status": 200,
        "message": "채용공고 정보를 조회했습니다.",
        "data": {
            "id": 19,
            **sample_job_posting.model_dump(mode="json"),
            "scraped_at": to_api_datetime(stored["scraped_at"]),
            "created_at": to_api_datetime(stored["created_at"]),
            "updated_at": to_api_datetime(stored["updated_at"]),
        },
    }
    get_job_posting.assert_awaited_once_with(
        fake_pool.connection_obj,
        19,
        user_id=current_user["id"],
    )


def test_get_job_posting_detail_endpoint_returns_404_when_missing(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        app_module,
        "get_job_posting",
        AsyncMock(return_value=None),
    )

    response = client.get(f"{API_PREFIX}/job-postings/404", headers=auth_headers)

    assert response.status_code == 404
    assert response.json() == {
        "type": "about:blank",
        "title": "Not Found",
        "status": 404,
        "detail": "Job posting 404 not found",
        "instance": f"{API_PREFIX}/job-postings/404",
    }


def test_read_current_user_returns_user_info(
    client: TestClient,
    current_user: dict,
    auth_headers: dict[str, str],
) -> None:
    response = client.get(f"{API_PREFIX}/auth/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {
        "status": 200,
        "message": "사용자 정보를 조회했습니다.",
        "data": {
            "user_id": str(current_user["id"]),
            "email": current_user["email"],
            "name": current_user["name"],
            "picture": current_user["picture"],
        },
    }


def test_read_current_user_retries_transient_database_connection_failures(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleep = AsyncMock()
    monkeypatch.setattr(retry_module.asyncio, "sleep", sleep)
    fake_pool.reset_connection_tracking()
    fake_pool.connection_failures_remaining = 4

    response = client.get(f"{API_PREFIX}/auth/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["data"]["user_id"] == str(current_user["id"])
    assert fake_pool.connection_attempts == 5
    assert sleep.await_count == 4


def test_read_current_user_returns_structured_database_error_after_retries(
    client: TestClient,
    fake_pool: FakePool,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleep = AsyncMock()
    monkeypatch.setattr(retry_module.asyncio, "sleep", sleep)
    fake_pool.reset_connection_tracking()
    fake_pool.connection_failures_remaining = 5

    response = client.get(f"{API_PREFIX}/auth/me", headers=auth_headers)

    assert response.status_code == 503
    assert response.json() == {
        "type": "about:blank",
        "title": "Service Unavailable",
        "status": 503,
        "detail": "데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.",
        "instance": f"{API_PREFIX}/auth/me",
    }
    assert "Internal Server Error" not in response.text
    assert fake_pool.connection_attempts == 5
    assert sleep.await_count == 4


def test_read_current_user_requires_auth(client: TestClient) -> None:
    response = client.get(f"{API_PREFIX}/auth/me")

    assert response.status_code == 401


def test_update_current_user_returns_updated_name(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    updated_user = {**current_user, "name": "New Name"}
    update_user_name_mock = AsyncMock(return_value=updated_user)
    monkeypatch.setattr(app_module, "update_user_name", update_user_name_mock)

    response = client.patch(
        f"{API_PREFIX}/auth/me",
        json={"name": "New Name"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["name"] == "New Name"
    update_user_name_mock.assert_awaited_once_with(
        fake_pool.connection_obj,
        current_user["id"],
        "New Name",
    )


def test_update_current_user_returns_404_when_user_disappears(
    client: TestClient,
    fake_pool: FakePool,
    current_user: dict,
    auth_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update_user_name_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(app_module, "update_user_name", update_user_name_mock)

    response = client.patch(
        f"{API_PREFIX}/auth/me",
        json={"name": "New Name"},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json() == {
        "type": "about:blank",
        "title": "Not Found",
        "status": 404,
        "detail": "사용자를 찾을 수 없습니다",
        "instance": f"{API_PREFIX}/auth/me",
    }
    update_user_name_mock.assert_awaited_once_with(
        fake_pool.connection_obj,
        current_user["id"],
        "New Name",
    )


def test_update_current_user_rejects_empty_name(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.patch(
        f"{API_PREFIX}/auth/me",
        json={"name": ""},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_update_current_user_rejects_whitespace_only_name(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.patch(
        f"{API_PREFIX}/auth/me",
        json={"name": "   "},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_update_current_user_rejects_name_exceeding_max_length(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.patch(
        f"{API_PREFIX}/auth/me",
        json={"name": "x" * 101},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_update_current_user_requires_auth(client: TestClient) -> None:
    response = client.patch(f"{API_PREFIX}/auth/me", json={"name": "New Name"})

    assert response.status_code == 401


def test_logout_returns_200_with_message(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(f"{API_PREFIX}/auth/logout", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {
        "status": 200,
        "message": "세션이 종료되었습니다. 토큰은 클라이언트에서 삭제해 주세요.",
        "data": None,
    }


def test_logout_requires_auth(client: TestClient) -> None:
    response = client.post(f"{API_PREFIX}/auth/logout")

    assert response.status_code == 401


def test_db_health_endpoint_uses_app_pool(
    client: TestClient,
    fake_pool: FakePool,
) -> None:
    response = client.get(f"{API_PREFIX}/health/db")

    assert response.status_code == 200
    assert response.json() == {
        "status": 200,
        "message": "DB connected",
        "data": {"database": "connected", "result": 1},
    }
    # init_schema also runs at startup through the same FakeConnection, so
    # verify the health endpoint's query is present rather than exclusive.
    assert "SELECT 1" in fake_pool.connection_obj.executed_queries


def test_db_health_endpoint_retries_transient_database_connection_failures(
    client: TestClient,
    fake_pool: FakePool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleep = AsyncMock()
    monkeypatch.setattr(retry_module.asyncio, "sleep", sleep)
    fake_pool.reset_connection_tracking()
    fake_pool.connection_failures_remaining = 4

    response = client.get(f"{API_PREFIX}/health/db")

    assert response.status_code == 200
    assert response.json() == {
        "status": 200,
        "message": "DB connected",
        "data": {"database": "connected", "result": 1},
    }
    assert fake_pool.connection_attempts == 5
    assert sleep.await_count == 4


# ── Google RISC receiver ─────────────────────────────────────────────────────


def _risc_event(
    *,
    event_type: str = EVENT_ACCOUNT_DISABLED,
    google_id: str | None = "google-user-1",
) -> RiscEvent:
    return RiscEvent(
        jti="jti-1",
        event_type=event_type,
        issued_at=1_700_000_000,
        google_id=google_id,
        reason=None,
        state=None,
        raw_payload={"jti": "jti-1", "events": {event_type: {}}},
    )


def test_risc_endpoint_accepts_valid_event_and_returns_202(
    client: TestClient,
    fake_pool: FakePool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    event = _risc_event()
    verify = AsyncMock(return_value=event)
    apply = AsyncMock(return_value=None)
    monkeypatch.setattr(app_module, "verify_risc_set", verify)
    monkeypatch.setattr(app_module, "apply_risc_event", apply)

    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content=b"header.payload.signature",
        headers={"Content-Type": "application/secevent+jwt"},
    )

    assert response.status_code == 202
    assert response.content == b""
    verify.assert_awaited_once_with("header.payload.signature", ANY)
    apply.assert_awaited_once_with(fake_pool.connection_obj, event)


def test_risc_endpoint_returns_401_for_invalid_signature(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verify = AsyncMock(side_effect=RiscVerificationError("bad sig"))
    apply = AsyncMock()
    monkeypatch.setattr(app_module, "verify_risc_set", verify)
    monkeypatch.setattr(app_module, "apply_risc_event", apply)

    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content=b"broken.jwt.token",
        headers={"Content-Type": "application/secevent+jwt"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "bad sig"
    apply.assert_not_awaited()


def test_risc_endpoint_returns_503_when_verification_is_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verify = AsyncMock(
        side_effect=RiscVerificationUnavailableError("Failed to fetch JWKS")
    )
    apply = AsyncMock()
    monkeypatch.setattr(app_module, "verify_risc_set", verify)
    monkeypatch.setattr(app_module, "apply_risc_event", apply)

    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content=b"header.payload.signature",
        headers={"Content-Type": "application/secevent+jwt"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "RISC verification is temporarily unavailable"
    apply.assert_not_awaited()


def test_risc_endpoint_rejects_empty_body(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verify = AsyncMock()
    monkeypatch.setattr(app_module, "verify_risc_set", verify)

    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content=b"",
        headers={"Content-Type": "application/secevent+jwt"},
    )

    assert response.status_code == 400
    verify.assert_not_awaited()


def test_risc_endpoint_rejects_non_ascii_body(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verify = AsyncMock()
    monkeypatch.setattr(app_module, "verify_risc_set", verify)

    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content="héader.payload.sig".encode(),
        headers={"Content-Type": "application/secevent+jwt"},
    )

    assert response.status_code == 400
    verify.assert_not_awaited()


@pytest.mark.parametrize(
    "content_type",
    [
        "application/json",
        "text/plain",
        "",
    ],
)
def test_risc_endpoint_rejects_wrong_content_type(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    content_type: str,
) -> None:
    verify = AsyncMock()
    monkeypatch.setattr(app_module, "verify_risc_set", verify)

    headers = {"Content-Type": content_type} if content_type else {}
    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content=b"header.payload.signature",
        headers=headers,
    )

    assert response.status_code == 415
    verify.assert_not_awaited()


def test_risc_endpoint_rejects_unsupported_event_type(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    event = _risc_event(event_type="https://example.com/custom-event")
    verify = AsyncMock(return_value=event)
    apply = AsyncMock()
    monkeypatch.setattr(app_module, "verify_risc_set", verify)
    monkeypatch.setattr(app_module, "apply_risc_event", apply)

    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content=b"header.payload.signature",
        headers={"Content-Type": "application/secevent+jwt"},
    )

    assert response.status_code == 400
    assert "Unsupported event type" in response.json()["detail"]
    apply.assert_not_awaited()


def test_risc_endpoint_is_not_authenticated(client: TestClient) -> None:
    # Google posts SETs without Bearer auth; absence of a token must not
    # trigger the 401 that protected endpoints return.
    response = client.post(
        f"{API_PREFIX}/auth/google/risc",
        content=b"",
        headers={"Content-Type": "application/secevent+jwt"},
    )

    # Empty body returns 400 (not 401), proving auth is not required.
    assert response.status_code == 400
