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


async def test_get_current_user_valid_token():
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
    request = type("Request", (), {"app": _FakeApp(row)})()
    user = await get_current_user(request, token)
    assert user["id"] == user_id
    assert user["email"] == "test@example.com"


async def test_get_current_user_invalid_token():
    request = type("Request", (), {"app": _FakeApp(None)})()
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, "bad-token")
    assert exc_info.value.status_code == 401


async def test_get_current_user_user_not_found():
    token = create_access_token(data={"sub": str(uuid4())})
    request = type("Request", (), {"app": _FakeApp(None)})()
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, token)
    assert exc_info.value.status_code == 401
