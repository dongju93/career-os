from typing import Annotated

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse

from career_os_api.auth.dependencies import get_current_user
from career_os_api.auth.jwt import create_access_token
from career_os_api.config import settings
from career_os_api.constants import API_V1
from career_os_api.database.job_postings import (
    get_job_posting,
    get_job_postings,
    upsert_job_posting,
)
from career_os_api.database.users import update_user_name, upsert_user
from career_os_api.schemas import (
    CurrentUserResponse,
    GoogleLoginResponse,
    JobPostingExtracted,
    JobPostingListItem,
    JobPostingPage,
    JobPostingStored,
    UpdateCurrentUserRequest,
)
from career_os_api.service.job_posting.extractor import extract_job_posting
from career_os_api.service.job_posting.fetch import fetch_url_content

v1_router = APIRouter(prefix=f"/{API_V1}")

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

_CurrentUser = Annotated[dict, Depends(get_current_user)]


# ── System ────────────────────────────────────────────────────────────────────


@v1_router.get("/", tags=["system"])
def root() -> JSONResponse:
    return JSONResponse(
        content={"message": "Hello, World!"},
        status_code=status.HTTP_200_OK,
    )


@v1_router.get("/health/db", tags=["system"])
async def db_health(request: Request) -> JSONResponse:
    async with request.app.state.pool.connection() as conn:
        result = await conn.execute("SELECT 1")
        row = await result.fetchone()
    return JSONResponse(
        content={"database": "connected", "result": row[0]},
        status_code=status.HTTP_200_OK,
    )


# ── Auth ──────────────────────────────────────────────────────────────────────


@v1_router.get("/auth/google", tags=["auth"])
async def google_login(request: Request):
    return await oauth.google.authorize_redirect(request, settings.redirect_uri)


@v1_router.get(
    "/auth/google/callback",
    tags=["auth"],
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
        user = await upsert_user(conn, google_id, email, name, picture)

    request.session["user_id"] = str(user["id"])
    access_token = create_access_token(data={"sub": str(user["id"])})
    return GoogleLoginResponse(
        message="Google 로그인 성공",
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        picture=user["picture"],
        access_token=access_token,
    )


@v1_router.get("/auth/me", tags=["auth"])
async def read_current_user(current_user: _CurrentUser) -> CurrentUserResponse:
    return CurrentUserResponse(
        user_id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        picture=current_user["picture"],
    )


@v1_router.patch(
    "/auth/me",
    tags=["auth"],
    responses={401: {"description": "인증 실패"}},
)
async def update_current_user(
    data: UpdateCurrentUserRequest,
    request: Request,
    current_user: _CurrentUser,
) -> CurrentUserResponse:
    async with request.app.state.pool.connection() as conn:
        user = await update_user_name(conn, current_user["id"], data.name)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다",
        )
    return CurrentUserResponse(
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        picture=user["picture"],
    )


@v1_router.post("/auth/logout", tags=["auth"], status_code=status.HTTP_204_NO_CONTENT)
async def logout_current_user(request: Request, current_user: _CurrentUser) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Job Postings ──────────────────────────────────────────────────────────────


@v1_router.get("/job-postings", tags=["job-postings"])
async def list_job_postings(
    request: Request,
    current_user: _CurrentUser,
    offset: Annotated[int, Query(ge=0, description="Number of records to skip")] = 0,
    limit: Annotated[
        int, Query(ge=1, le=100, description="Max records to return")
    ] = 20,
) -> JobPostingPage:
    async with request.app.state.pool.connection() as conn:
        rows, total = await get_job_postings(
            conn,
            user_id=current_user["id"],
            limit=limit,
            offset=offset,
        )
    return JobPostingPage(
        items=[JobPostingListItem(**row) for row in rows],
        total=total,
        offset=offset,
        limit=limit,
    )


@v1_router.get(
    "/job-postings/extraction",
    tags=["job-postings"],
    responses={
        400: {"description": "Invalid URL, unsupported domain, or missing posting ID"},
        404: {"description": "URL returned a 404 from the upstream server"},
        # 422 is intentionally omitted: FastAPI auto-generates the HTTPValidationError
        # schema for the missing `url` query parameter. Adding a custom 422 entry here
        # would replace that schema. Model-refusal errors also arrive as 422 at runtime;
        # their detail string distinguishes them from validation failures.
        502: {"description": "Upstream server unreachable"},
    },
)
async def get_job_posting_extraction(
    url: Annotated[str, Query(description="Job posting URL")],
    _current_user: _CurrentUser,
) -> JobPostingExtracted:
    content, _ = await fetch_url_content(url)
    return await extract_job_posting(html_content=content, source_url=url)


@v1_router.post(
    "/job-postings",
    tags=["job-postings"],
    status_code=status.HTTP_201_CREATED,
    responses={
        # "model" causes FastAPI to emit a full JSON Schema $ref for this status code,
        # matching the 201 body. Without it the 200 entry has no content schema and
        # generated clients treat successful updates as empty responses.
        200: {
            "model": JobPostingStored,
            "description": "Job posting updated (existing record)",
        },
        201: {"description": "Job posting created"},
    },
)
async def create_job_posting(
    data: JobPostingExtracted,
    request: Request,
    response: Response,
    current_user: _CurrentUser,
) -> JobPostingStored:
    async with request.app.state.pool.connection() as conn:
        row = await upsert_job_posting(conn, data, user_id=current_user["id"])
    if not row["inserted"]:
        response.status_code = status.HTTP_200_OK
    return JobPostingStored(
        id=row["id"],
        scraped_at=row["scraped_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        **data.model_dump(),
    )


@v1_router.get(
    "/job-postings/{job_id}",
    tags=["job-postings"],
    responses={404: {"description": "Job posting not found"}},
)
async def get_job_posting_detail(
    job_id: int,
    request: Request,
    current_user: _CurrentUser,
) -> JobPostingStored:
    async with request.app.state.pool.connection() as conn:
        row = await get_job_posting(conn, job_id, user_id=current_user["id"])
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job posting {job_id} not found",
        )
    return JobPostingStored(**row)
