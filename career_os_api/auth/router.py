from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request, status

from career_os_api.auth.jwt import create_access_token
from career_os_api.auth.schema import GoogleLoginResponse
from career_os_api.config import settings
from career_os_api.database.users import create_user, find_user_by_google_id

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/google")
async def google_login(request: Request):
    redirect_uri = settings.redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get(
    "/google/callback",
    response_model=GoogleLoginResponse,
    responses={400: {"description": "Google 로그인 실패"}},
)
async def google_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google 토큰 교환 실패: {exc}",
        ) from exc

    user_info = token.get("userinfo")
    if not user_info or not user_info.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google 사용자 정보를 가져올 수 없습니다",
        )

    google_id: str = user_info["sub"]
    email: str = user_info["email"]
    name: str | None = user_info.get("name")
    picture: str | None = user_info.get("picture")

    async with request.app.state.pool.connection() as conn:
        existing = await find_user_by_google_id(conn, google_id)

        if existing:
            user = existing
        else:
            user = await create_user(conn, google_id, email, name, picture)

    access_token = create_access_token(data={"sub": str(user["id"])})

    return GoogleLoginResponse(
        message="Google 로그인 성공",
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        picture=user["picture"],
        access_token=access_token,
    )
