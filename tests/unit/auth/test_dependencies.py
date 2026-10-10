import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from career_os_api.auth.dependencies import get_current_user

SESSION_CLIENT_HEADERS = {"x-career-os-client": "web"}


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


def _make_request(row, *, session=None, headers=None):
    return type(
        "Request",
        (),
        {
            "app": _FakeApp(row),
            "session": session or {},
            "headers": headers or {},
        },
    )()


async def test_get_current_user_session_cookie():
    user_id = uuid.uuid7()
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
        headers=SESSION_CLIENT_HEADERS,
    )
    user = await get_current_user(request)
    assert user is not None
    assert user["id"] == user_id


async def test_get_current_user_session_requires_client_header():
    user_id = uuid.uuid7()
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
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


async def test_get_current_user_rejects_invalid_session_user_id():
    request = _make_request(
        None,
        session={
            "user_id": "not-a-uuid",
            "issued_at": int(datetime.now(UTC).timestamp()),
        },
        headers=SESSION_CLIENT_HEADERS,
    )
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


async def test_get_current_user_rejects_unknown_user():
    user_id = uuid.uuid7()
    request = _make_request(
        None,
        session={
            "user_id": str(user_id),
            "issued_at": int(datetime.now(UTC).timestamp()),
        },
        headers=SESSION_CLIENT_HEADERS,
    )
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


async def test_get_current_user_rejects_inactive_user():
    user_id = uuid.uuid7()
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "inactive@example.com",
        "name": "Inactive User",
        "picture": None,
        "is_active": False,
        "auth_session_revoked_at": None,
    }
    request = _make_request(
        row,
        session={
            "user_id": str(user_id),
            "issued_at": int(datetime.now(UTC).timestamp()),
        },
        headers=SESSION_CLIENT_HEADERS,
    )
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


async def test_get_current_user_rejects_session_issued_before_revocation():
    user_id = uuid.uuid7()
    issued_at = int(datetime.now(UTC).timestamp())
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "revoked@example.com",
        "name": "Revoked User",
        "picture": None,
        "is_active": True,
        "auth_session_revoked_at": datetime.fromtimestamp(issued_at, UTC)
        + timedelta(seconds=1),
    }
    request = _make_request(
        row,
        session={"user_id": str(user_id), "issued_at": issued_at},
        headers=SESSION_CLIENT_HEADERS,
    )
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


async def test_get_current_user_rejects_session_without_issue_time_after_revocation():
    user_id = uuid.uuid7()
    row = {
        "id": user_id,
        "google_id": "g-123",
        "email": "revoked@example.com",
        "name": "Revoked User",
        "picture": None,
        "is_active": True,
        "auth_session_revoked_at": datetime.now(UTC),
    }
    request = _make_request(
        row,
        session={"user_id": str(user_id)},
        headers=SESSION_CLIENT_HEADERS,
    )
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


async def test_get_current_user_accepts_session_issued_after_revocation():
    user_id = uuid.uuid7()
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
        headers=SESSION_CLIENT_HEADERS,
    )
    user = await get_current_user(request)
    assert user is not None
    assert user["id"] == user_id


async def test_get_current_user_accepts_session_issued_in_same_second_as_revocation():
    # Session issued_at is second-precision (floor). A session issued at T+0.800 after
    # a revocation at T+0.500 gets issued_at=T. Without truncating revoked_at to
    # seconds the comparison T.000 > T.500 is false and the valid session is rejected.
    user_id = uuid.uuid7()
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
        headers=SESSION_CLIENT_HEADERS,
    )
    user = await get_current_user(request)
    assert user is not None
    assert user["id"] == user_id


async def test_get_current_user_no_auth_raises_401():
    request = _make_request(None)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401
