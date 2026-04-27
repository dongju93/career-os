from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from career_os_api.auth.jwt import decode_access_token
from career_os_api.database.retry import run_database_operation
from career_os_api.database.users import UserRow, find_user_by_id

_bearer_scheme = HTTPBearer(auto_error=False)
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
    # JWT iat is second-precision (floor); truncate revoked_at to seconds so a
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


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),  # noqa: B008
):
    # Session cookie first, but only for explicit API clients. This keeps
    # ambient cross-site cookie requests from being accepted as authenticated.
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

    # Bearer token fallback
    token = credentials.credentials if credentials is not None else None
    if token is not None:
        payload = decode_access_token(token)
        if payload is not None:
            sub = payload.get("sub")
            if sub is not None:
                try:
                    user_id = UUID(sub)
                except ValueError:
                    pass
                else:
                    user = await _find_current_user(request, user_id)
                    iat = payload.get("iat")
                    issued_at = iat if isinstance(iat, int) else None
                    if _is_current_user_session(user, issued_at):
                        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
