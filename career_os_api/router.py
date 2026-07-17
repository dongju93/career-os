import logging
import time
from datetime import UTC, date, datetime
from typing import Annotated, Literal
from urllib.parse import parse_qsl, urlencode, urlparse
from uuid import UUID

from authlib.integrations.base_client import MismatchingStateError
from authlib.integrations.starlette_client import OAuth
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Request,
    Response,
    status,
)
from fastapi.responses import JSONResponse, RedirectResponse
from psycopg.errors import UniqueViolation

from career_os_api.auth.dependencies import get_current_user
from career_os_api.auth.jwt import create_access_token
from career_os_api.auth.risc import (
    SUPPORTED_EVENT_TYPES,
    RiscVerificationError,
    RiscVerificationUnavailableError,
    verify_risc_set,
)
from career_os_api.auth.risc_handlers import apply_risc_event
from career_os_api.chatkit.routes import router as chatkit_router
from career_os_api.config import settings
from career_os_api.constants import API_V1
from career_os_api.database.auth_exchange import (
    create_exchange_code,
    redeem_exchange_code,
)
from career_os_api.database.job_postings import (
    TargetGroupNotFoundError,
    get_job_posting,
    get_job_postings,
    update_job_posting_fields,
    upsert_job_posting,
)
from career_os_api.database.job_search_groups import (
    create_initial_group,
    create_job_search_group,
    delete_job_search_group,
    get_current_group_id,
    get_job_search_group,
    get_job_search_groups,
    get_user_group_ids_for_update,
    has_any_group,
    update_job_search_group,
)
from career_os_api.database.retry import run_database_operation
from career_os_api.database.user_profiles import get_user_profile, upsert_user_profile
from career_os_api.database.users import update_user_name, upsert_user
from career_os_api.rate_limit import quota, rate_limit
from career_os_api.responses import (
    AUTHENTICATION_ERROR_RESPONSE,
    BAD_REQUEST_ERROR_RESPONSE,
    CONFLICT_ERROR_RESPONSE,
    FORBIDDEN_ERROR_RESPONSE,
    NOT_FOUND_ERROR_RESPONSE,
    PAYLOAD_TOO_LARGE_ERROR_RESPONSE,
    SERVICE_UNAVAILABLE_ERROR_RESPONSE,
    UNSUPPORTED_MEDIA_TYPE_ERROR_RESPONSE,
    UPSTREAM_ERROR_RESPONSE,
    VALIDATION_ERROR_RESPONSE,
    ApiResponse,
)
from career_os_api.schemas import (
    AccessTokenResponse,
    CurrentUserResponse,
    JobPostingCreateRequest,
    JobPostingExtracted,
    JobPostingListItem,
    JobPostingPage,
    JobPostingStored,
    JobPostingUpdateRequest,
    JobSearchGroup,
    JobSearchGroupCreate,
    JobSearchGroupItem,
    JobSearchGroupPage,
    JobSearchGroupUpdate,
    LoginCodeExchangeRequest,
    UpdateCurrentUserRequest,
    UserProfile,
    UserProfileUpsertRequest,
)
from career_os_api.service.job_posting.extractor import extract_job_posting
from career_os_api.service.job_posting.fetch import fetch_url_content
from career_os_api.strategist.strategist_routes import router as strategist_router

v1_router = APIRouter(prefix=f"/{API_V1}")

_logger = logging.getLogger(__name__)

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

_CurrentUser = Annotated[dict, Depends(get_current_user)]

# ChatKit routes live in their own module; mount them under the same /v1 prefix.
# The runtime dependency on the router also guards against runtime flag changes.
if settings.chatkit_enabled:
    v1_router.include_router(chatkit_router)

# Strategist routes are always mounted; the router's _require_strategist_enabled
# dependency returns 404 at request time while the flag is off. Mounting
# unconditionally (unlike chatkit) lets tests toggle the flag at runtime, since the
# default is off and a conditional include would otherwise never register the route.
v1_router.include_router(strategist_router)


def _resolve_callback_url(
    callback_url: str, allowed_origins: list[str], frontend_url: str
) -> str | None:
    """Return a safe redirect URL or None when callback_url fails validation.

    Accepts:
    - path-only inputs (e.g. "/dashboard") — prefixed with frontend_url
    - full URLs whose origin is explicitly listed in allowed_origins

    Rejects everything else (foreign hosts, relative paths without a leading
    slash) so the OAuth access token cannot be leaked to an attacker's domain.
    """
    parsed = urlparse(callback_url)
    if not parsed.scheme and not parsed.netloc:
        if parsed.path.startswith("/"):
            return frontend_url.rstrip("/") + callback_url
        return None
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin in allowed_origins:
        return callback_url
    return None


def _oauth_failure_redirect(request: Request, target: str) -> RedirectResponse:
    """Drop the half-finished OAuth session and bounce back to the frontend.

    Shared by every failure path in the callback so the client-visible contract
    (`?error=oauth_token_exchange_failed`) stays identical regardless of why the
    exchange failed.
    """
    request.session.clear()
    return RedirectResponse(
        _append_query_params(target, {"error": "oauth_token_exchange_failed"}),
        status_code=status.HTTP_303_SEE_OTHER,
    )


def _append_query_params(url: str, params: dict[str, str]) -> str:
    parsed = urlparse(url)
    existing_params = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key not in params
    ]
    query = urlencode([*existing_params, *params.items()])
    return parsed._replace(query=query).geturl()


# ── System ────────────────────────────────────────────────────────────────────


@v1_router.get(
    "/",
    tags=["system"],
    summary="API 기본 상태 확인",
    description="Career OS API가 요청을 처리할 수 있는지 확인하는 간단한 liveness API입니다.",
    operation_id="get_api_status",
    response_description="API가 정상적으로 실행 중임을 나타내는 상태 envelope",
)
def root() -> ApiResponse[None]:
    return ApiResponse(status=status.HTTP_200_OK, message="Hello, World!")


@v1_router.get(
    "/health/db",
    tags=["system"],
    summary="데이터베이스 연결 상태 확인",
    description="API가 사용하는 PostgreSQL 연결 풀에서 간단한 쿼리를 실행해 연결 상태를 확인합니다.",
    operation_id="check_database_health",
    response_description="데이터베이스 연결 상태",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: SERVICE_UNAVAILABLE_ERROR_RESPONSE},
)
async def db_health(request: Request) -> JSONResponse:
    async def operation(conn):
        result = await conn.execute("SELECT 1")
        row = await result.fetchone()
        return row[0]

    result = await run_database_operation(request.app.state.pool, operation)
    return JSONResponse(
        content={
            "status": status.HTTP_200_OK,
            "message": "DB connected",
            "data": {"database": "connected", "result": result},
        },
        status_code=status.HTTP_200_OK,
    )


# ── Auth ──────────────────────────────────────────────────────────────────────


@v1_router.get(
    "/auth/google",
    tags=["auth"],
    summary="Google OAuth 로그인 시작",
    description=(
        "Google OAuth 인증 화면으로 리다이렉트합니다. `callback_url`은 허용된 프론트엔드 "
        "origin 또는 `/`로 시작하는 경로만 사용할 수 있습니다."
    ),
    operation_id="start_google_login",
    response_class=RedirectResponse,
    status_code=status.HTTP_302_FOUND,
    responses={
        status.HTTP_302_FOUND: {"description": "Google OAuth 인증 화면으로 리다이렉트"},
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def google_login(
    request: Request,
    callback_url: Annotated[
        str | None,
        Query(
            description="로그인 완료 후 돌아갈 허용된 프론트엔드 경로 또는 URL",
            examples=["/auth/callback"],
        ),
    ] = None,
):
    if callback_url:
        safe_url = _resolve_callback_url(
            callback_url, settings.allowed_origins, settings.frontend_url
        )
        if safe_url:
            request.session["callback_url"] = safe_url
    return await oauth.google.authorize_redirect(request, settings.redirect_uri)


@v1_router.get(
    "/auth/google/callback",
    tags=["auth"],
    summary="Google OAuth callback 처리",
    description=(
        "Google authorization code를 검증하고 서버 세션과 일회용 `login_code`를 발급한 뒤 "
        "프론트엔드 callback URL로 리다이렉트합니다. 세션 쿠키를 사용할 수 없는 브라우저는 "
        "login code를 `/v1/auth/token`으로 교환할 수 있습니다."
    ),
    operation_id="complete_google_login",
    response_class=RedirectResponse,
    status_code=status.HTTP_302_FOUND,
    response_description="로그인 성공 후 프론트엔드 callback으로 리다이렉트",
    responses={
        status.HTTP_302_FOUND: {
            "description": "로그인 성공 후 프론트엔드 callback으로 리다이렉트"
        },
        status.HTTP_303_SEE_OTHER: {
            "description": "OAuth 처리 실패 후 오류 정보와 함께 리다이렉트"
        },
    },
)
async def google_callback(request: Request) -> RedirectResponse:
    # Always redirect back to the frontend. Returning JSON here caused mobile
    # browsers to download the response as `callback.txt` when the session
    # cookie carrying `callback_url` was dropped during the cross-site OAuth
    # round trip. Falls back to /auth/callback (not bare frontend_url) since
    # that's the only route that reads `login_code`/`error` query params —
    # landing on `/` would send login_code straight to ProtectedRoute, which
    # never looks at it.
    target = (
        request.session.get("callback_url")
        or f"{settings.frontend_url.rstrip('/')}/auth/callback"
    )

    try:
        token = await oauth.google.authorize_access_token(request)
    except MismatchingStateError:
        # Authlib raises this both for a state that disagrees with the session
        # and for a callback with no stored state at all (`state_data is None`),
        # so crawlers probing the callback URL, replayed links, and users whose
        # session cookie was dropped mid-flow all land here. None of these are
        # server faults: log at warning without a traceback so they stop being
        # reported as errors, and still send the user back to the frontend.
        _logger.warning(
            "OAuth callback rejected: request state has no matching session state "
            "(user_agent=%s)",
            request.headers.get("user-agent", "-"),
        )
        return _oauth_failure_redirect(request, target)
    except Exception as exc:
        _logger.exception("OAuth token exchange failed: %s", exc)
        return _oauth_failure_redirect(request, target)

    user_info = token.get("userinfo")
    if not user_info or not user_info.get("sub"):
        request.session.clear()
        return RedirectResponse(
            _append_query_params(
                target,
                {"error": "Google 사용자 정보를 가져올 수 없습니다"},
            ),
            status_code=status.HTTP_303_SEE_OTHER,
        )

    google_id: str = user_info["sub"]
    email: str = user_info["email"]
    name: str | None = user_info.get("name")
    picture: str | None = user_info.get("picture")

    async def operation(conn):
        async with conn.transaction():
            user = await upsert_user(conn, google_id, email, name, picture)
            if not await has_any_group(conn, user["id"]):
                await create_initial_group(conn, user["id"])
            # Minted alongside the session so browsers that drop the
            # cross-site session cookie (Safari ITP, Chrome third-party
            # cookie blocking) can still complete login via /auth/token.
            login_code = await create_exchange_code(conn, user["id"])
            return user, login_code

    user, login_code = await run_database_operation(request.app.state.pool, operation)

    request.session.clear()
    request.session["user_id"] = str(user["id"])
    request.session["issued_at"] = int(datetime.now(UTC).timestamp())

    return RedirectResponse(
        _append_query_params(target, {"login_code": login_code}),
        status_code=status.HTTP_302_FOUND,
    )


@v1_router.get(
    "/auth/me",
    tags=["auth"],
    summary="현재 사용자 조회",
    description="Bearer JWT 또는 웹 세션으로 인증된 현재 사용자의 기본 계정 정보를 조회합니다.",
    operation_id="get_current_user",
    response_description="현재 사용자 정보",
    dependencies=[rate_limit(20, per="minute")],
    responses={status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE},
)
async def read_current_user(
    current_user: _CurrentUser,
) -> ApiResponse[CurrentUserResponse]:
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="사용자 정보를 조회했습니다.",
        data=CurrentUserResponse(
            user_id=current_user["id"],
            email=current_user["email"],
            name=current_user["name"],
            picture=current_user["picture"],
        ),
    )


@v1_router.post(
    "/auth/token",
    tags=["auth"],
    summary="OAuth login code를 access token으로 교환",
    description=(
        "OAuth callback URL에 포함된 일회용 `login_code`를 검증하고 Bearer access token을 "
        "발급합니다. login code는 한 번만 사용할 수 있고 짧은 시간 동안만 유효합니다."
    ),
    operation_id="exchange_oauth_login_code",
    response_description="발급된 Bearer access token",
    # No rate_limit() dependency: this endpoint is intentionally
    # unauthenticated (it is how a client becomes authenticated), and
    # rate_limit() keys its bucket on current_user, which doesn't exist yet
    # here. The code itself (32 random bytes, 60s TTL, single-use) is the
    # security control against guessing.
    responses={
        status.HTTP_400_BAD_REQUEST: {
            **BAD_REQUEST_ERROR_RESPONSE,
            "description": "login code가 유효하지 않거나 만료되었습니다.",
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def exchange_login_code(
    data: LoginCodeExchangeRequest,
    request: Request,
) -> ApiResponse[AccessTokenResponse]:
    async def operation(conn):
        return await redeem_exchange_code(conn, data.login_code)

    user_id = await run_database_operation(
        request.app.state.pool,
        operation,
        idempotent=False,
        label="redeem_exchange_code",
    )
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="코드가 유효하지 않거나 만료되었습니다.",
        )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="로그인 토큰을 발급했습니다.",
        data=AccessTokenResponse(
            access_token=create_access_token({"sub": str(user_id)})
        ),
    )


@v1_router.patch(
    "/auth/me",
    tags=["auth"],
    summary="현재 사용자 이름 수정",
    description="인증된 사용자의 표시 이름을 수정합니다. 이메일과 Google 프로필 사진은 변경하지 않습니다.",
    operation_id="update_current_user",
    response_description="수정된 사용자 정보",
    dependencies=[rate_limit(10, per="minute"), quota(50, per="day")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def update_current_user(
    data: UpdateCurrentUserRequest,
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[CurrentUserResponse]:
    async def operation(conn):
        return await update_user_name(conn, current_user["id"], data.name)

    user = await run_database_operation(request.app.state.pool, operation)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="사용자 정보를 수정했습니다.",
        data=CurrentUserResponse(
            user_id=user["id"],
            email=user["email"],
            name=user["name"],
            picture=user["picture"],
        ),
    )


@v1_router.post(
    "/auth/logout",
    tags=["auth"],
    summary="현재 세션 종료",
    description="서버 세션을 삭제합니다. Bearer JWT를 사용하는 클라이언트는 보관 중인 토큰도 직접 삭제해야 합니다.",
    operation_id="logout_current_user",
    response_description="세션 종료 결과",
    dependencies=[rate_limit(20, per="minute")],
    responses={status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE},
)
async def logout_current_user(
    request: Request, current_user: _CurrentUser
) -> ApiResponse[None]:
    request.session.clear()
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="세션이 종료되었습니다. 토큰은 클라이언트에서 삭제해 주세요.",
    )


_MAX_RISC_BODY_BYTES = 65_536


@v1_router.post(
    "/auth/google/risc",
    tags=["auth"],
    summary="Google RISC 보안 이벤트 수신",
    description=(
        "Google Cross-Account Protection의 Security Event Token(SET)을 검증하고 계정 비활성화, "
        "세션 폐기 등의 보안 이벤트를 반영합니다. 요청 본문은 JSON이 아닌 compact JWT입니다."
    ),
    operation_id="receive_google_risc_event",
    status_code=status.HTTP_202_ACCEPTED,
    response_description="RISC 이벤트 수락 결과",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/secevent+jwt": {
                    "schema": {
                        "type": "string",
                        "format": "jwt",
                        "description": "Google이 서명한 RFC 8417 Security Event Token",
                    }
                }
            },
        }
    },
    responses={
        status.HTTP_202_ACCEPTED: {
            "description": "Security Event Token을 수락하고 이벤트를 반영했습니다."
        },
        status.HTTP_400_BAD_REQUEST: BAD_REQUEST_ERROR_RESPONSE,
        status.HTTP_401_UNAUTHORIZED: {
            **AUTHENTICATION_ERROR_RESPONSE,
            "description": "Security Event Token 서명 또는 claim 검증에 실패했습니다.",
        },
        status.HTTP_413_CONTENT_TOO_LARGE: PAYLOAD_TOO_LARGE_ERROR_RESPONSE,
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: UNSUPPORTED_MEDIA_TYPE_ERROR_RESPONSE,
        status.HTTP_503_SERVICE_UNAVAILABLE: SERVICE_UNAVAILABLE_ERROR_RESPONSE,
    },
)
async def receive_google_risc_event(request: Request) -> Response:
    # Google posts Security Event Tokens as a raw compact-serialized JWT with
    # Content-Type `application/secevent+jwt`. The body is the token itself
    # — not JSON — so stream it with a hard size cap to prevent DoS on this
    # unauthenticated endpoint.
    content_type = request.headers.get("content-type", "")
    if content_type.split(";")[0].strip() != "application/secevent+jwt":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Content-Type must be application/secevent+jwt",
        )

    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > _MAX_RISC_BODY_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
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
        event = await verify_risc_set(token, request.app.state.risc_http_client)
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


@v1_router.get(
    "/job-postings",
    tags=["job-postings"],
    summary="저장된 채용 공고 목록 조회",
    description=(
        "현재 사용자가 저장한 채용 공고를 offset pagination으로 조회합니다. `group_id`를 지정하면 "
        "해당 사용자의 구직 활동 그룹에 속한 공고만 반환합니다. 목록 응답은 본문 전문을 제외한 "
        "경량 projection입니다."
    ),
    operation_id="list_saved_job_postings",
    response_description="페이지네이션된 저장 채용 공고 목록",
    dependencies=[rate_limit(60, per="minute")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_403_FORBIDDEN: FORBIDDEN_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def list_job_postings(
    request: Request,
    current_user: _CurrentUser,
    offset: Annotated[
        int,
        Query(
            ge=0,
            description="건너뛸 레코드 수",
            examples=[0],
        ),
    ] = 0,
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
            description="한 번에 반환할 최대 레코드 수",
            examples=[20],
        ),
    ] = 20,
    group_id: Annotated[
        UUID | None,
        Query(
            description="특정 구직 활동 그룹으로 필터링할 UUID",
            examples=["0196f4e8-3f2f-7c1f-b1a4-0d37d6b9a001"],
        ),
    ] = None,
) -> ApiResponse[JobPostingPage]:
    async def operation(conn):
        if group_id is not None:
            grp = await get_job_search_group(conn, group_id)
            if grp is None or grp["user_id"] != current_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="다른 사용자의 그룹에 접근할 수 없습니다.",
                )
        return await get_job_postings(
            conn,
            user_id=current_user["id"],
            limit=limit,
            offset=offset,
            group_id=group_id,
        )

    rows, total = await run_database_operation(request.app.state.pool, operation)
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="채용공고 목록을 조회했습니다.",
        data=JobPostingPage(
            items=[JobPostingListItem(**row) for row in rows],
            total=total,
            offset=offset,
            limit=limit,
        ),
    )


@v1_router.get(
    "/job-postings/extraction",
    tags=["job-postings"],
    summary="채용 공고 URL에서 정보 추출",
    description=(
        "지원되는 채용 플랫폼(Saramin 또는 Wanted)의 URL을 가져와 채용 공고 구조화 정보를 "
        "추출합니다. 이 API는 결과를 저장하지 않으며, 추출 결과를 저장하려면 `POST /v1/job-postings`를 "
        "호출해야 합니다."
    ),
    operation_id="extract_job_posting_from_url",
    response_description="추출된 채용 공고 정보",
    dependencies=[
        rate_limit(10, per="minute"),
        quota(100, per="day"),
        quota(500, per="month"),
    ],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_400_BAD_REQUEST: BAD_REQUEST_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: {
            **NOT_FOUND_ERROR_RESPONSE,
            "description": "외부 채용 공고 URL에서 리소스를 찾을 수 없습니다.",
        },
        # 422 is intentionally omitted: FastAPI auto-generates the HTTPValidationError
        # schema for the missing `url` query parameter. Adding a custom 422 entry here
        # would replace that schema. Model-refusal errors also arrive as 422 at runtime;
        # their detail string distinguishes them from validation failures.
        status.HTTP_502_BAD_GATEWAY: UPSTREAM_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def get_job_posting_extraction(
    url: Annotated[
        str,
        Query(
            description="추출할 Saramin 또는 Wanted 채용 공고 URL",
            examples=[
                "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
                "https://www.wanted.co.kr/wd/123456",
            ],
        ),
    ],
    request: Request,
    _current_user: _CurrentUser,
) -> ApiResponse[JobPostingExtracted]:
    t0 = time.perf_counter()
    content, _ = await fetch_url_content(url, request.app.state.http_client)
    upstream_ms = round((time.perf_counter() - t0) * 1000)
    _logger.info("fetch.done url=%s upstream_duration_ms=%d", url, upstream_ms)

    extracted = await extract_job_posting(
        html_content=content,
        source_url=url,
        image_client=request.app.state.image_http_client,
        openai_client=request.app.state.openai_client,
    )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="채용공고 정보를 추출했습니다.",
        data=extracted,
    )


@v1_router.post(
    "/job-postings",
    tags=["job-postings"],
    summary="채용 공고 저장 또는 갱신",
    description=(
        "채용 공고 추출 결과를 사용자의 구직 활동 그룹에 upsert합니다. `group_id`를 생략하면 "
        "현재 사용자의 가장 최근 활성 그룹에 저장합니다. 동일 플랫폼의 동일 공고가 이미 있으면 "
        "기존 레코드를 갱신하고 200을 반환하며, 신규 저장이면 201을 반환합니다."
    ),
    operation_id="upsert_saved_job_posting",
    dependencies=[rate_limit(30, per="minute"), quota(500, per="day")],
    status_code=status.HTTP_201_CREATED,
    responses={
        # "model" causes FastAPI to emit a full JSON Schema $ref for this status code,
        # matching the 201 body. Without it the 200 entry has no content schema and
        # generated clients treat successful updates as empty responses.
        status.HTTP_200_OK: {
            "model": ApiResponse[JobPostingStored],
            "description": "기존 채용 공고를 갱신했습니다.",
        },
        status.HTTP_201_CREATED: {
            "model": ApiResponse[JobPostingStored],
            "description": "채용 공고를 새로 저장했습니다.",
        },
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_403_FORBIDDEN: FORBIDDEN_ERROR_RESPONSE,
        status.HTTP_409_CONFLICT: CONFLICT_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def create_job_posting(
    data: JobPostingCreateRequest,
    request: Request,
    response: Response,
    current_user: _CurrentUser,
) -> ApiResponse[JobPostingStored]:
    async def operation(conn):
        gid = data.group_id
        if gid is None:
            gid = await get_current_group_id(conn, current_user["id"])
            if gid is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="구직 활동 그룹이 없습니다. 먼저 그룹을 생성하세요.",
                )
        else:
            grp = await get_job_search_group(conn, gid)
            if grp is None or grp["user_id"] != current_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="다른 사용자의 그룹에 접근할 수 없습니다.",
                )
        return await upsert_job_posting(
            conn, data, user_id=current_user["id"], group_id=gid
        )

    row = await run_database_operation(request.app.state.pool, operation)
    stored = JobPostingStored(
        id=row["id"],
        group_id=row["group_id"],
        application_status=row["application_status"],
        status_updated_at=row["status_updated_at"],
        # memo is preserved across re-saves (omitted from DO UPDATE SET), so it must
        # come from the returned row — data is the write-path payload and has no memo.
        memo=row["memo"],
        scraped_at=row["scraped_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        **data.model_dump(exclude={"group_id"}),
    )
    http_status = status.HTTP_201_CREATED if row["inserted"] else status.HTTP_200_OK
    response.status_code = http_status
    message = (
        "채용공고가 저장되었습니다."
        if row["inserted"]
        else "채용공고가 업데이트되었습니다."
    )
    return ApiResponse(status=http_status, message=message, data=stored)


@v1_router.get(
    "/job-postings/{job_id}",
    tags=["job-postings"],
    summary="저장된 채용 공고 상세 조회",
    description="현재 사용자가 저장한 채용 공고 한 건을 상세 조회합니다. 다른 사용자의 공고는 조회할 수 없습니다.",
    operation_id="get_saved_job_posting",
    response_description="저장된 채용 공고 상세 정보",
    dependencies=[rate_limit(60, per="minute")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def get_job_posting_detail(
    job_id: Annotated[
        int,
        Path(ge=1, description="저장된 채용 공고 ID", examples=[101]),
    ],
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[JobPostingStored]:
    async def operation(conn):
        return await get_job_posting(conn, job_id, user_id=current_user["id"])

    row = await run_database_operation(request.app.state.pool, operation)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job posting {job_id} not found",
        )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="채용공고 정보를 조회했습니다.",
        data=JobPostingStored(**row),
    )


@v1_router.patch(
    "/job-postings/{job_id}",
    tags=["job-postings"],
    summary="저장된 채용 공고 부분 수정",
    description=(
        "저장된 채용 공고의 지원 상태, 구직 활동 그룹 또는 메모만 부분 수정합니다. `memo: null`은 "
        "기존 메모를 삭제한다는 의미이며, `application_status`와 `group_id`는 null일 수 없습니다."
    ),
    operation_id="update_saved_job_posting",
    response_description="수정된 저장 채용 공고",
    dependencies=[rate_limit(30, per="minute")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
        status.HTTP_409_CONFLICT: CONFLICT_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def update_job_posting(
    job_id: Annotated[
        int,
        Path(ge=1, description="수정할 저장 채용 공고 ID", examples=[101]),
    ],
    data: JobPostingUpdateRequest,
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[JobPostingStored]:
    # Only the fields the client actually sent are written. The schema validator
    # already rejected an empty body and explicit nulls on NOT NULL columns.
    # memo is the one nullable column, so an explicit null must still be written
    # (it clears the memo) — hence the model_fields_set check rather than `is not None`.
    update_fields: dict[str, object] = {}
    if data.application_status is not None:
        update_fields["application_status"] = data.application_status.value
    if data.group_id is not None:
        update_fields["group_id"] = data.group_id
    if "memo" in data.model_fields_set:
        update_fields["memo"] = data.memo

    async def operation(conn):
        return await update_job_posting_fields(
            conn,
            user_id=current_user["id"],
            job_id=job_id,
            fields=update_fields,
        )

    try:
        # Non-idempotent write: the UPDATE stamps updated_at/status_updated_at = NOW()
        # and may move group_id, so a retry after the DB applied the change would
        # re-stamp timestamps or re-attempt the move. Only retry pool-acquisition
        # failures (operation provably never ran); fail fast as 503 otherwise.
        row = await run_database_operation(
            request.app.state.pool,
            operation,
            idempotent=False,
            label="update_job_posting",
        )
    except TargetGroupNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="대상 구직 활동 그룹을 찾을 수 없습니다.",
        ) from exc
    except UniqueViolation as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 대상 그룹에 같은 공고가 저장되어 있습니다.",
        ) from exc

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job posting {job_id} not found",
        )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="채용공고가 수정되었습니다.",
        data=JobPostingStored(**row),
    )


# ── Job Search Groups ─────────────────────────────────────────────────────────


@v1_router.get(
    "/job-search-groups",
    tags=["job-search-groups"],
    summary="구직 활동 그룹 목록 조회",
    description=(
        "현재 사용자의 구직 활동 그룹을 조회합니다. `status=active` 또는 `status=ended`로 상태를 "
        "필터링할 수 있으며, 각 목록 항목에는 해당 그룹에 저장된 공고 수가 포함됩니다."
    ),
    operation_id="list_job_search_groups",
    response_description="페이지네이션된 구직 활동 그룹 목록",
    dependencies=[rate_limit(60, per="minute")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def list_job_search_groups(
    request: Request,
    current_user: _CurrentUser,
    status_filter: Annotated[
        Literal["active", "ended"] | None,
        Query(
            alias="status",
            description="구직 활동 그룹 상태 필터",
            examples=["active"],
        ),
    ] = None,
    offset: Annotated[int, Query(ge=0, description="건너뛸 그룹 수", examples=[0])] = 0,
    limit: Annotated[
        int,
        Query(ge=1, le=100, description="반환할 최대 그룹 수", examples=[20]),
    ] = 20,
) -> ApiResponse[JobSearchGroupPage]:
    async def operation(conn):
        return await get_job_search_groups(
            conn,
            user_id=current_user["id"],
            status=status_filter,
            limit=limit,
            offset=offset,
        )

    rows, total = await run_database_operation(request.app.state.pool, operation)
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="구직 활동 그룹 목록을 조회했습니다.",
        data=JobSearchGroupPage(
            items=[JobSearchGroupItem(**row) for row in rows],
            total=total,
            offset=offset,
            limit=limit,
        ),
    )


@v1_router.post(
    "/job-search-groups",
    tags=["job-search-groups"],
    summary="구직 활동 그룹 생성",
    description=(
        "채용 공고를 묶어 관리할 새로운 구직 활동 그룹을 생성합니다. `started_at`을 생략하면 "
        "오늘 날짜가 사용됩니다. 사용자는 항상 하나 이상의 그룹을 보유해야 합니다."
    ),
    operation_id="create_job_search_group",
    response_description="생성된 구직 활동 그룹",
    dependencies=[rate_limit(10, per="minute"), quota(50, per="day")],
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def create_job_search_group_handler(
    data: JobSearchGroupCreate,
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[JobSearchGroup]:
    started_at = data.started_at or date.today()

    async def operation(conn):
        return await create_job_search_group(
            conn,
            user_id=current_user["id"],
            name=data.name,
            started_at=started_at,
            ended_at=data.ended_at,
            memo=data.memo,
        )

    row = await run_database_operation(
        request.app.state.pool,
        operation,
        idempotent=False,
        label="create_job_search_group",
    )
    return ApiResponse(
        status=status.HTTP_201_CREATED,
        message="구직 활동 그룹이 생성되었습니다.",
        data=JobSearchGroup(**row),
    )


@v1_router.get(
    "/job-search-groups/{group_id}",
    tags=["job-search-groups"],
    summary="구직 활동 그룹 상세 조회",
    description="현재 사용자의 구직 활동 그룹 한 건을 UUID로 조회합니다.",
    operation_id="get_job_search_group",
    response_description="구직 활동 그룹 상세 정보",
    dependencies=[rate_limit(60, per="minute")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_403_FORBIDDEN: FORBIDDEN_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def get_job_search_group_handler(
    group_id: Annotated[
        UUID,
        Path(
            description="조회할 구직 활동 그룹 UUID",
            examples=["0196f4e8-3f2f-7c1f-b1a4-0d37d6b9a001"],
        ),
    ],
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[JobSearchGroup]:
    async def operation(conn):
        return await get_job_search_group(conn, group_id)

    row = await run_database_operation(request.app.state.pool, operation)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )
    if row["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="다른 사용자의 그룹에 접근할 수 없습니다.",
        )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="구직 활동 그룹 정보를 조회했습니다.",
        data=JobSearchGroup(**row),
    )


@v1_router.patch(
    "/job-search-groups/{group_id}",
    tags=["job-search-groups"],
    summary="구직 활동 그룹 수정",
    description=(
        "구직 활동 그룹의 이름, 시작일, 종료일 또는 메모를 부분 수정합니다. 시작일과 종료일의 "
        "순서는 서버에서 병합된 최종 상태 기준으로 검증합니다."
    ),
    operation_id="update_job_search_group",
    response_description="수정된 구직 활동 그룹",
    dependencies=[rate_limit(20, per="minute"), quota(100, per="day")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_403_FORBIDDEN: FORBIDDEN_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def update_job_search_group_handler(
    group_id: Annotated[
        UUID,
        Path(
            description="수정할 구직 활동 그룹 UUID",
            examples=["0196f4e8-3f2f-7c1f-b1a4-0d37d6b9a001"],
        ),
    ],
    data: JobSearchGroupUpdate,
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[JobSearchGroup]:
    # Reject explicit null for NOT NULL columns before hitting the DB.
    for field in ("name", "started_at"):
        if field in data.model_fields_set and getattr(data, field) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{field} cannot be null",
            )

    update_fields = {
        k: v for k, v in data.model_dump().items() if k in data.model_fields_set
    }

    async def operation(conn):
        existing = await get_job_search_group(conn, group_id)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Group {group_id} not found",
            )
        if existing["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="다른 사용자의 그룹에 접근할 수 없습니다.",
            )
        # Server-side date constraint: validate merged state.
        effective_started = update_fields.get("started_at", existing["started_at"])
        effective_ended = update_fields.get("ended_at", existing["ended_at"])
        if effective_ended is not None and effective_ended < effective_started:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="ended_at must be >= started_at",
            )
        return await update_job_search_group(
            conn, group_id, user_id=current_user["id"], fields=update_fields
        )

    row = await run_database_operation(
        request.app.state.pool,
        operation,
        idempotent=False,
        label="update_job_search_group",
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found",
        )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="구직 활동 그룹이 수정되었습니다.",
        data=JobSearchGroup(**row),
    )


@v1_router.delete(
    "/job-search-groups/{group_id}",
    tags=["job-search-groups"],
    summary="구직 활동 그룹 삭제",
    description=(
        "현재 사용자의 구직 활동 그룹을 삭제합니다. 사용자의 마지막 그룹은 구직 공고의 소속을 "
        "잃지 않도록 삭제할 수 없습니다."
    ),
    operation_id="delete_job_search_group",
    response_description="삭제 완료. 응답 본문은 없습니다.",
    dependencies=[rate_limit(10, per="minute")],
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
        status.HTTP_409_CONFLICT: CONFLICT_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def delete_job_search_group_handler(
    group_id: Annotated[
        UUID,
        Path(
            description="삭제할 구직 활동 그룹 UUID",
            examples=["0196f4e8-3f2f-7c1f-b1a4-0d37d6b9a001"],
        ),
    ],
    request: Request,
    current_user: _CurrentUser,
) -> Response:
    async def operation(conn):
        async with conn.transaction():
            # FOR UPDATE locks all user group rows, preventing concurrent deletes
            # from violating the "at least one group" invariant.
            group_ids = await get_user_group_ids_for_update(conn, current_user["id"])
            if group_id not in group_ids:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Group {group_id} not found",
                )
            if len(group_ids) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="마지막 구직 활동 그룹은 삭제할 수 없습니다.",
                )
            await delete_job_search_group(conn, group_id, user_id=current_user["id"])

    await run_database_operation(
        request.app.state.pool,
        operation,
        idempotent=False,
        label="delete_job_search_group",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Career Profile ────────────────────────────────────────────────────────────


@v1_router.get(
    "/profile",
    tags=["profile"],
    summary="커리어 프로필 조회",
    description=(
        "현재 사용자의 커리어 프로필을 조회합니다. 프로필이 아직 생성되지 않은 경우 404를 반환하며, "
        "지원 전략 생성 전에 프로필을 먼저 작성해야 합니다."
    ),
    operation_id="get_current_user_profile",
    response_description="현재 사용자의 커리어 프로필",
    dependencies=[rate_limit(60, per="minute")],
    responses={
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
    },
)
async def read_current_user_profile(
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[UserProfile]:
    async def operation(conn):
        return await get_user_profile(conn, user_id=current_user["id"])

    row = await run_database_operation(request.app.state.pool, operation)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로필이 아직 없습니다.",
        )
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="프로필을 조회했습니다.",
        data=UserProfile(**row),
    )


@v1_router.put(
    "/profile",
    tags=["profile"],
    summary="커리어 프로필 전체 교체",
    description=(
        "현재 사용자의 커리어 프로필을 전체 교체 방식으로 저장합니다. 처음 생성되면 201, 기존 프로필을 "
        "교체하면 200을 반환합니다. 요청에서 생략한 필드는 null로 저장됩니다."
    ),
    operation_id="replace_current_user_profile",
    response_description="저장된 커리어 프로필",
    dependencies=[rate_limit(20, per="minute")],
    responses={
        # "model" forces FastAPI to emit a body schema for the non-default 201,
        # so generated clients treat the create response as non-empty.
        status.HTTP_201_CREATED: {
            "model": ApiResponse[UserProfile],
            "description": "커리어 프로필을 새로 생성했습니다.",
        },
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_422_UNPROCESSABLE_CONTENT: VALIDATION_ERROR_RESPONSE,
    },
)
async def replace_current_user_profile(
    data: UserProfileUpsertRequest,
    request: Request,
    response: Response,
    current_user: _CurrentUser,
) -> ApiResponse[UserProfile]:
    async def operation(conn):
        return await upsert_user_profile(conn, user_id=current_user["id"], data=data)

    row = await run_database_operation(request.app.state.pool, operation)
    http_status = status.HTTP_201_CREATED if row["inserted"] else status.HTTP_200_OK
    response.status_code = http_status
    message = (
        "프로필이 생성되었습니다." if row["inserted"] else "프로필이 수정되었습니다."
    )
    return ApiResponse(status=http_status, message=message, data=UserProfile(**row))
