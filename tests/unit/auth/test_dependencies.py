from uuid import uuid4

import pytest
from fastapi import HTTPException

from career_os_api.auth.dependencies import get_current_user
from career_os_api.auth.jwt import create_access_token


class _FakeCursor:
    def __init__(self, row):
        self._row = row

    async def execute(self, sql, params=None):
        pass

    async def fetchone(self):
        return self._row

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class _FakeConn:
    def __init__(self, row):
        self._row = row

    def cursor(self, **kwargs):
        return _FakeCursor(self._row)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class _FakePool:
    def __init__(self, row):
        self._row = row

    def connection(self):
        return _FakeConn(self._row)


class _FakeApp:
    def __init__(self, row):
        self.state = type("State", (), {"pool": _FakePool(row)})()


def _make_request(row, *, session=None):
    return type("Request", (), {"app": _FakeApp(row), "session": session or {}})()


async def test_get_current_user_bearer_token():
    user_id = uuid4()
    token = create_access_token(data={"sub": str(user_id)})
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "test@example.com",
        "name": "Test",
        "picture": None,
        "is_active": True,
    }
    user = await get_current_user(_make_request(row), token)
    assert user["id"] == user_id
    assert user["email"] == "test@example.com"


async def test_get_current_user_session_cookie():
    user_id = uuid4()
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "test@example.com",
        "name": "Test",
        "picture": None,
        "is_active": True,
    }
    request = _make_request(row, session={"user_id": str(user_id)})
    user = await get_current_user(request, None)
    assert user["id"] == user_id


async def test_get_current_user_session_takes_precedence_over_bearer():
    session_user_id = uuid4()
    row = {
        "id": session_user_id,
        "google_id": "g-123",
        "email": "session@example.com",
        "name": "Session User",
        "picture": None,
        "is_active": True,
    }
    token = create_access_token(data={"sub": str(uuid4())})
    request = _make_request(row, session={"user_id": str(session_user_id)})
    user = await get_current_user(request, token)
    assert user["id"] == session_user_id


async def test_get_current_user_invalid_token():
    request = _make_request(None)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, "bad-token")
    assert exc_info.value.status_code == 401


async def test_get_current_user_user_not_found():
    token = create_access_token(data={"sub": str(uuid4())})
    request = _make_request(None)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, token)
    assert exc_info.value.status_code == 401


async def test_get_current_user_no_auth_raises_401():
    request = _make_request(None)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, None)
    assert exc_info.value.status_code == 401
