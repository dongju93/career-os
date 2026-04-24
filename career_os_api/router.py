from datetime import UTC, datetime
from typing import Annotated
from urllib.parse import urlencode

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse

from career_os_api.auth.dependencies import get_current_user
from career_os_api.auth.jwt import create_access_token
from career_os_api.auth.risc import (
    SUPPORTED_EVENT_TYPES,
    RiscVerificationError,
    RiscVerificationUnavailableError,
    verify_risc_set,
)
from career_os_api.auth.risc_handlers import apply_risc_event
from career_os_api.config import settings
from career_os_api.constants import API_V1
from career_os_api.database.job_postings import (
    get_job_posting,
    get_job_postings,
    upsert_job_posting,
)
from career_os_api.database.retry import (
    DatabaseUnavailableError,
    run_database_operation,
)
from career_os_api.database.users import update_user_name, upsert_user
from career_os_api.responses import api_response
from career_os_api.schemas import (
    CurrentUserResponse,
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
    return api_response(status_code=status.HTTP_200_OK, message="Hello, World!")


@v1_router.get("/health/db", tags=["system"])
async def db_health(request: Request) -> JSONResponse:
    async def operation(conn):
        result = await conn.execute("SELECT 1")
        row = await result.fetchone()
        return row[0]

    result = await run_database_operation(request.app.state.pool, operation)
    return api_response(
        status_code=status.HTTP_200_OK, database="connected", result=result
    )


# ── Auth ──────────────────────────────────────────────────────────────────────


@v1_router.get("/auth/google", tags=["auth"])
async def google_login(
    request: Request,
    callback_url: Annotated[str | None, Query()] = None,
):
    if callback_url:
        request.session["callback_url"] = callback_url
    return await oauth.google.authorize_redirect(request, settings.redirect_uri)


@v1_router.get(
    "/auth/google/callback",
    tags=["auth"],
    responses={400: {"description": "Google 로그인 실패"}},
)
async def google_callback(request: Request) -> RedirectResponse:
    # Always redirect back to the frontend. Returning JSON here caused mobile
    # browsers to download the response as `callback.txt` when the session
    # cookie carrying `callback_url` was dropped during the cross-site OAuth
    # round trip.
    target = request.session.get("callback_url") or settings.frontend_url

    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as exc:
        request.session.clear()
        return RedirectResponse(
            f"{target}?{urlencode({'error': f'Google 토큰 교환 실패: {exc}'})}"
        )

    user_info = token.get("userinfo")
    if not user_info or not user_info.get("sub"):
        request.session.clear()
        return RedirectResponse(
            f"{target}?{urlencode({'error': 'Google 사용자 정보를 가져올 수 없습니다'})}"
        )

    google_id: str = user_info["sub"]
    email: str = user_info["email"]
    name: str | None = user_info.get("name")
    picture: str | None = user_info.get("picture")

    async def operation(conn):
        return await upsert_user(conn, google_id, email, name, picture)

    try:
        user = await run_database_operation(request.app.state.pool, operation)
    except DatabaseUnavailableError:
        return RedirectResponse(
            f"{target}?{urlencode({'error': '데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.'})}"
        )

    request.session.clear()
    request.session["user_id"] = str(user["id"])
    request.session["issued_at"] = int(datetime.now(UTC).timestamp())
    access_token = create_access_token(data={"sub": str(user["id"])})

    return RedirectResponse(f"{target}?{urlencode({'access_token': access_token})}")


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
    responses={
        401: {"description": "인증 실패"},
        404: {"description": "사용자를 찾을 수 없습니다"},
    },
)
async def update_current_user(
    data: UpdateCurrentUserRequest,
    request: Request,
    current_user: _CurrentUser,
) -> CurrentUserResponse:
    async def operation(conn):
        return await update_user_name(conn, current_user["id"], data.name)

    user = await run_database_operation(request.app.state.pool, operation)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )
    return CurrentUserResponse(
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        picture=user["picture"],
    )


@v1_router.post("/auth/logout", tags=["auth"])
async def logout_current_user(
    request: Request, current_user: _CurrentUser
) -> JSONResponse:
    request.session.clear()
    return api_response(
        status_code=status.HTTP_200_OK,
        message="세션이 종료되었습니다. 토큰은 클라이언트에서 삭제해 주세요.",
    )


_MAX_RISC_BODY_BYTES = 65_536


@v1_router.post(
    "/auth/google/risc",
    tags=["auth"],
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        202: {"description": "Security Event Token accepted"},
        400: {"description": "Malformed or unsupported Security Event Token"},
        401: {"description": "Signature or claim verification failed"},
        413: {"description": "Request body too large"},
        503: {"description": "RISC verification temporarily unavailable"},
    },
)
async def receive_google_risc_event(request: Request) -> Response:
    # Google posts Security Event Tokens as a raw compact-serialized JWT with
    # Content-Type `application/secevent+jwt`. The body is the token itself
    # — not JSON — so stream it with a hard size cap to prevent DoS on this
    # unauthenticated endpoint.
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > _MAX_RISC_BODY_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Request body exceeds maximum allowed size",
            )
        chunks.append(chunk)
    raw = b"".join(chunks)
    try:
        token = raw.decode("ascii").strip()
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must be ASCII-encoded JWT",
        ) from exc

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty request body",
        )

    try:
        event = await verify_risc_set(token)
    except RiscVerificationUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RISC verification is temporarily unavailable",
        ) from exc
    except RiscVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    if event.event_type not in SUPPORTED_EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported event type: {event.event_type}",
        )

    async def operation(conn):
        await apply_risc_event(conn, event)

    await run_database_operation(request.app.state.pool, operation)
    return Response(status_code=status.HTTP_202_ACCEPTED)


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
    async def operation(conn):
        return await get_job_postings(
            conn,
            user_id=current_user["id"],
            limit=limit,
            offset=offset,
        )

    rows, total = await run_database_operation(request.app.state.pool, operation)
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
    async def operation(conn):
        return await upsert_job_posting(conn, data, user_id=current_user["id"])

    row = await run_database_operation(request.app.state.pool, operation)
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
    async def operation(conn):
        return await get_job_posting(conn, job_id, user_id=current_user["id"])

    row = await run_database_operation(request.app.state.pool, operation)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job posting {job_id} not found",
        )
    return JobPostingStored(**row)
