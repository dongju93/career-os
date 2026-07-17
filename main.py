import logging
from contextlib import asynccontextmanager

import httpx2
import sentry_sdk
from agents import set_default_openai_client, set_tracing_disabled
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from openai import AsyncOpenAI
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.types import Event, Hint
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from career_os_api.chatkit.server import CareerOsChatKitServer
from career_os_api.chatkit.store import PostgresChatKitStore
from career_os_api.config import settings
from career_os_api.constants import API_V1
from career_os_api.database.ddl import init_schema
from career_os_api.database.pool import create_postgres_pool
from career_os_api.database.retry import DatabaseUnavailableError
from career_os_api.middleware import (
    RequestIdFilter,
    RequestIdMiddleware,
    SecurityHeadersMiddleware,
)
from career_os_api.rate_limit.client import create_redis_client
from career_os_api.responses import api_error_response, api_validation_error_response
from career_os_api.router import v1_router


def _before_send_sentry_event(event: Event, hint: Hint) -> Event | None:
    exc_info = hint.get("exc_info")
    if isinstance(exc_info, tuple) and len(exc_info) >= 2:
        exc = exc_info[1]
        if isinstance(exc, StarletteHTTPException) and (
            400 <= exc.status_code < 500
            or exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        ):
            return None
    return event


if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[
            FastApiIntegration(),
            LoggingIntegration(
                level=logging.WARNING,
                event_level=logging.ERROR,
            ),
        ],
        send_default_pii=False,
        before_send=_before_send_sentry_event,
    )

_log_handler = logging.StreamHandler()
_log_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s %(levelname)s [req:%(request_id)s] %(name)s %(message)s"
    )
)
_log_handler.addFilter(RequestIdFilter())
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    handlers=[_log_handler],
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_client = create_redis_client()
    try:
        async with (
            create_postgres_pool() as pool,
            httpx2.AsyncClient(
                follow_redirects=True, timeout=settings.http_fetch_timeout
            ) as http_client,
            httpx2.AsyncClient(
                follow_redirects=True, timeout=settings.http_image_timeout
            ) as image_http_client,
            httpx2.AsyncClient(
                timeout=settings.google_risc_http_timeout_seconds
            ) as risc_http_client,
            AsyncOpenAI(api_key=settings.openai_api_key) as openai_client,
        ):
            await init_schema(pool)
            app.state.pool = pool
            app.state.redis = redis_client
            app.state.http_client = http_client
            app.state.image_http_client = image_http_client
            app.state.risc_http_client = risc_http_client
            app.state.openai_client = openai_client
            # The Agents SDK keeps a module-global OpenAI client and tracing flag
            # rather than accepting them per `Runner` call. Bind them once, here,
            # to the app's shared client before constructing the ChatKit server —
            # this keeps the rebind explicit and out of `CareerOsChatKitServer.__init__`.
            set_default_openai_client(openai_client, use_for_tracing=False)
            set_tracing_disabled(True)
            # ChatKit server depends on the pool + OpenAI client, so build it last.
            store = PostgresChatKitStore(pool)
            app.state.chatkit_server = CareerOsChatKitServer(
                store,
                model=settings.chatkit_model or settings.openai_model,
            )
            yield
    finally:
        if redis_client is not None:
            await redis_client.aclose()


_production_servers = (
    [{"url": "https://career-os.fastapicloud.dev"}]
    if settings.environment == "production"
    else None
)

_API_DESCRIPTION = """
Career OS의 구직 활동 관리 및 지원 전략 생성 API입니다.

## 인증

보호된 API는 `Authorization: Bearer <JWT>` 헤더 또는 웹 클라이언트용 세션 쿠키와
`X-Career-OS-Client: web` 헤더로 인증합니다. OAuth 로그인은 `/v1/auth/google`에서
시작하고, 쿠키를 사용할 수 없는 브라우저는 callback의 `login_code`를
`/v1/auth/token`으로 교환할 수 있습니다.

## 응답 형식

성공 응답은 `status`, `message`, `data`를 포함하는 공통 envelope를 사용합니다.
오류 응답은 RFC 7807 `application/problem+json` 형식입니다.

## 페이지네이션

목록 API는 `offset`과 `limit` 기반 페이지네이션을 사용하며, 응답의 `data` 안에
`items`, `total`, `offset`, `limit`을 제공합니다.

## 주의사항

`/v1/chatkit`은 ChatKit 프로토콜에 따라 스트리밍 또는 JSON 응답을 반환합니다.
`/v1/agent/*`는 기능 플래그가 활성화된 환경에서만 사용할 수 있으며,
생성된 지원 전략이나 지원 자료는 참고용으로 검토 후 사용해야 합니다.
"""

_OPENAPI_TAGS = [
    {
        "name": "system",
        "description": "서비스 상태와 데이터베이스 연결 상태를 확인하는 공개 API",
    },
    {
        "name": "auth",
        "description": "Google OAuth 로그인, 토큰 교환, 세션 및 사용자 계정 API",
    },
    {
        "name": "job-postings",
        "description": "채용 공고 추출, 저장, 조회 및 지원 상태 관리 API",
    },
    {
        "name": "job-search-groups",
        "description": "구직 활동 단위의 생성, 조회, 수정 및 삭제 API",
    },
    {
        "name": "profile",
        "description": "지원 전략에 사용하는 사용자의 커리어 프로필 API",
    },
    {
        "name": "chatkit",
        "description": "저장된 채용 공고를 조회하는 ChatKit 기반 대화 API",
    },
    {
        "name": "agent",
        "description": "커리어 프로필과 저장 공고를 바탕으로 지원 전략을 생성하는 API",
    },
]

career_os = FastAPI(
    lifespan=lifespan,
    title="Career OS API",
    summary="구직 활동 관리와 맞춤형 지원 전략을 제공하는 백엔드 API",
    description=_API_DESCRIPTION,
    version="0.1.0",
    contact={
        "name": "Career OS Engineering",
        "url": "https://github.com/dongju93/career-os",
    },
    openapi_tags=_OPENAPI_TAGS,
    docs_url=f"/{API_V1}/docs",
    redoc_url=f"/{API_V1}/redoc",
    servers=_production_servers,
)

career_os.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# The session cookie's only load-bearing job is the OAuth `state` round-trip
# across the top-level `/auth/google` → Google → `/auth/google/callback`
# navigations. It must NOT carry the CHIPS `Partitioned` attribute: a
# partitioned cookie is keyed by the top-level site at set-time, but the
# callback request is issued while the top-level site is accounts.google.com,
# so Chrome omits the cookie and authlib raises MismatchingStateError (login
# fails, especially on mobile). Partitioning also can't help authenticated
# cross-site XHR here — the SPA and API are different registrable domains, so
# the login cookie lands in one partition while every SPA fetch reads another.
# Cross-site auth is instead carried by the Bearer token minted via
# login_code → POST /auth/token. Keep `SameSite=None; Secure` (unpartitioned).
career_os.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    https_only=True,
    same_site="none",
    max_age=settings.jwt_expire_minutes * 60,
)
career_os.add_middleware(RequestIdMiddleware)
career_os.add_middleware(GZipMiddleware, minimum_size=1000)
if settings.environment == "production" and settings.enable_security_headers:
    career_os.add_middleware(SecurityHeadersMiddleware)
if settings.trusted_hosts:
    career_os.add_middleware(
        TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts
    )


@career_os.get("/health", include_in_schema=False)
def liveness_probe() -> dict[str, str]:
    return {"status": "ok"}


@career_os.get("/", include_in_schema=False)
def redirect_root_to_docs() -> RedirectResponse:
    return RedirectResponse(
        url=f"/{API_V1}/docs",
        status_code=status.HTTP_302_FOUND,
    )


@career_os.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    return api_error_response(
        status_code=exc.status_code,
        detail=exc.detail,
        instance=request.url.path,
        headers=dict(exc.headers) if exc.headers else None,
    )


@career_os.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return api_validation_error_response(
        errors=exc.errors(),
        instance=request.url.path,
    )


@career_os.exception_handler(DatabaseUnavailableError)
async def database_unavailable_exception_handler(
    request: Request,
    _exc: DatabaseUnavailableError,
) -> JSONResponse:
    return api_error_response(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.",
        instance=request.url.path,
    )


@career_os.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    sentry_sdk.capture_exception(exc)
    logger.error(
        "Unhandled API exception",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return api_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        instance=request.url.path,
    )


career_os.include_router(v1_router)
