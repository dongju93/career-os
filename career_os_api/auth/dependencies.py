from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from career_os_api.auth.jwt import decode_access_token
from career_os_api.database.users import find_user_by_id

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


async def get_current_user(
    request: Request,
    token: str | None = Depends(_oauth2_scheme),
):
    # Session cookie first
    session_uid = request.session.get("user_id")
    if session_uid:
        try:
            user_id = UUID(session_uid)
        except ValueError:
            pass
        else:
            async with request.app.state.pool.connection() as conn:
                user = await find_user_by_id(conn, user_id)
            if user and user["is_active"]:
                return user

    # Bearer token fallback
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
                    async with request.app.state.pool.connection() as conn:
                        user = await find_user_by_id(conn, user_id)
                    if user and user["is_active"]:
                        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
