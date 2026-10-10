from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, Request, status

from career_os_api.database.retry import run_database_operation
from career_os_api.database.users import UserRow, find_user_by_id

_SESSION_CLIENT_HEADER = "x-career-os-client"
_SESSION_CLIENT_HEADER_VALUE = "web"


async def _find_current_user(request: Request, user_id: UUID):
    async def operation(conn):
        return await find_user_by_id(conn, user_id)

    return await run_database_operation(request.app.state.pool, operation)


def _issued_after_revocation(user: UserRow, issued_at: int | None) -> bool:
    revoked_at = user.get("auth_session_revoked_at")
    if revoked_at is None:
        return True
    if issued_at is None:
        return False
    if revoked_at.tzinfo is None:
        revoked_at = revoked_at.replace(tzinfo=UTC)
    # Session issued_at is second-precision (floor); truncate revoked_at to seconds so a
    # session issued within the same second as revocation is not wrongly rejected.
    return datetime.fromtimestamp(issued_at, UTC) >= revoked_at.replace(microsecond=0)


def _is_current_user_session(user: UserRow | None, issued_at: int | None) -> bool:
    return bool(
        user and user["is_active"] and _issued_after_revocation(user, issued_at)
    )


def _session_issued_at(request: Request) -> int | None:
    issued_at = request.session.get("issued_at")
    return issued_at if isinstance(issued_at, int) else None


def _has_session_client_header(request: Request) -> bool:
    return request.headers.get(_SESSION_CLIENT_HEADER) == _SESSION_CLIENT_HEADER_VALUE


async def get_current_user(request: Request):
    # The HttpOnly session cookie is the only credential: the web client is
    # served same-origin through a proxy, so no token is ever handed to
    # JavaScript. The explicit client header keeps ambient cookie requests
    # (forms, navigations) from being accepted as authenticated.
    session_uid = request.session.get("user_id")
    if session_uid and _has_session_client_header(request):
        try:
            user_id = UUID(session_uid)
        except ValueError:
            pass
        else:
            user = await _find_current_user(request, user_id)
            if _is_current_user_session(user, _session_issued_at(request)):
                return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다",
    )
