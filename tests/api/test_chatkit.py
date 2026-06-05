"""API-level tests for the ChatKit endpoint.

Reuses the FakePool + Bearer-JWT auth pattern from test_job_search_groups.py. The
streaming path is exercised by swapping app.state.chatkit_server for a stub whose
process() returns a real chatkit StreamingResult, so no OpenAI call is made.
"""

import base64
import json
import time
import uuid
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager

import itsdangerous
import pytest
from chatkit.server import StreamingResult
from fastapi.testclient import TestClient

import main as main_module
from career_os_api.auth.jwt import create_access_token
from career_os_api.chatkit import routes as routes_module
from career_os_api.config import settings as app_settings
from career_os_api.constants import API_V1

API_PREFIX = f"/{API_V1}"
CHATKIT_URL = f"{API_PREFIX}/chatkit"
WEB_HEADER = {"X-Career-OS-Client": "web"}


def make_current_user() -> dict:
    return {
        "id": uuid.uuid7(),
        "google_id": "google-user-1",
        "email": "user@example.com",
        "name": "Career OS User",
        "picture": None,
        "is_active": True,
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


class FakeStreamingServer:
    """Stand-in ChatKit server: returns a real StreamingResult without hitting OpenAI."""

    async def process(self, body: bytes, context) -> StreamingResult:  # NOSONAR
        async def _gen() -> AsyncGenerator[bytes]:
            yield b'data: {"type":"thread.item.done"}\n\n'

        return StreamingResult(_gen())


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


def _session_cookie(user_id: uuid.UUID) -> str:
    """Forge a Starlette SessionMiddleware cookie (same format the app issues)."""
    signer = itsdangerous.TimestampSigner(app_settings.secret_key)
    payload = {"user_id": str(user_id), "issued_at": int(time.time())}
    data = base64.b64encode(json.dumps(payload).encode())
    return signer.sign(data).decode()


# ── auth ──────────────────────────────────────────────────────────────────────


def test_chatkit_requires_authentication(client: TestClient) -> None:
    response = client.post(CHATKIT_URL, content=b"{}")
    assert response.status_code == 401


def test_chatkit_session_cookie_without_client_header_is_rejected(
    client: TestClient, current_user: dict
) -> None:
    client.cookies.set("session", _session_cookie(current_user["id"]))

    # Session cookie present but no X-Career-OS-Client header → session path skipped.
    response = client.post(CHATKIT_URL, content=b"{}")

    assert response.status_code == 401


# ── streaming ─────────────────────────────────────────────────────────────────


def test_chatkit_authenticated_returns_event_stream(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    main_module.career_os.state.chatkit_server = FakeStreamingServer()

    response = client.post(
        CHATKIT_URL,
        content=b'{"op":"threads.create"}',
        headers={**auth_headers, **WEB_HEADER},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert b"thread.item.done" in response.content


# ── feature flag ──────────────────────────────────────────────────────────────


def test_chatkit_returns_404_when_disabled(
    client: TestClient, auth_headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(routes_module.settings, "chatkit_enabled", False)

    response = client.post(CHATKIT_URL, content=b"{}", headers=auth_headers)

    assert response.status_code == 404
