from datetime import UTC, datetime, timedelta
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
        "auth_session_revoked_at": None,
    }
    user = await get_current_user(_make_request(row), token)
    assert user is not None
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
        "auth_session_revoked_at": None,
    }
    request = _make_request(
        row,
        session={
            "user_id": str(user_id),
            "issued_at": int(datetime.now(UTC).timestamp()),
        },
    )
    user = await get_current_user(request, None)
    assert user is not None
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
        "auth_session_revoked_at": None,
    }
    token = create_access_token(data={"sub": str(uuid4())})
    request = _make_request(
        row,
        session={
            "user_id": str(session_user_id),
            "issued_at": int(datetime.now(UTC).timestamp()),
        },
    )
    user = await get_current_user(request, token)
    assert user is not None
    assert user["id"] == session_user_id


async def test_get_current_user_invalid_session_id_falls_back_to_bearer():
    bearer_user_id = uuid4()
    token = create_access_token(data={"sub": str(bearer_user_id)})
    row = {
        "id": bearer_user_id,
        "google_id": "g-123",
        "email": "bearer@example.com",
        "name": "Bearer User",
        "picture": None,
        "is_active": True,
        "auth_session_revoked_at": None,
    }
    request = _make_request(row, session={"user_id": "not-a-uuid"})
    user = await get_current_user(request, token)
    assert user is not None
    assert user["id"] == bearer_user_id


async def test_get_current_user_invalid_token():
    request = _make_request(None)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, "bad-token")
    assert exc_info.value.status_code == 401


async def test_get_current_user_token_with_invalid_subject():
    token = create_access_token(data={"sub": "not-a-uuid"})
    request = _make_request(None)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, token)
    assert exc_info.value.status_code == 401


async def test_get_current_user_inactive_user():
    user_id = uuid4()
    token = create_access_token(data={"sub": str(user_id)})
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "inactive@example.com",
        "name": "Inactive User",
        "picture": None,
        "is_active": False,
        "auth_session_revoked_at": None,
    }
    request = _make_request(row)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, token)
    assert exc_info.value.status_code == 401


async def test_get_current_user_rejects_token_issued_before_session_revocation():
    user_id = uuid4()
    token = create_access_token(data={"sub": str(user_id)})
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "revoked@example.com",
        "name": "Revoked User",
        "picture": None,
        "is_active": True,
        "auth_session_revoked_at": datetime.now(UTC) + timedelta(seconds=1),
    }
    request = _make_request(row)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, token)
    assert exc_info.value.status_code == 401


async def test_get_current_user_rejects_session_without_issue_time_after_revocation():
    user_id = uuid4()
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "revoked@example.com",
        "name": "Revoked User",
        "picture": None,
        "is_active": True,
        "auth_session_revoked_at": datetime.now(UTC),
    }
    request = _make_request(row, session={"user_id": str(user_id)})
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, None)
    assert exc_info.value.status_code == 401


async def test_get_current_user_accepts_session_issued_after_revocation():
    user_id = uuid4()
    issued_at = int(datetime.now(UTC).timestamp())
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "active@example.com",
        "name": "Active User",
        "picture": None,
        "is_active": True,
        "auth_session_revoked_at": datetime.fromtimestamp(issued_at - 10, UTC),
    }
    request = _make_request(
        row,
        session={"user_id": str(user_id), "issued_at": issued_at},
    )
    user = await get_current_user(request, None)
    assert user is not None
    assert user["id"] == user_id


async def test_get_current_user_accepts_session_issued_in_same_second_as_revocation():
    # JWT iat is second-precision. A session issued at T+0.800 after a revocation
    # at T+0.500 gets iat=T (floor). Without truncating revoked_at to seconds the
    # comparison T.000 > T.500 is false and the valid session is wrongly rejected.
    user_id = uuid4()
    issued_at = int(datetime.now(UTC).timestamp())
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "active@example.com",
        "name": "Active User",
        "picture": None,
        "is_active": True,
        # revoked_at has sub-second precision within the same second as issued_at
        "auth_session_revoked_at": datetime.fromtimestamp(issued_at, UTC).replace(
            microsecond=500_000
        ),
    }
    request = _make_request(
        row,
        session={"user_id": str(user_id), "issued_at": issued_at},
    )
    user = await get_current_user(request, None)
    assert user is not None
    assert user["id"] == user_id


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
