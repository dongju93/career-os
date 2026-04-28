import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI
from starlette.middleware.sessions import SessionMiddleware

from career_os_api.config import settings
from career_os_api.constants import API_V1
from career_os_api.database.ddl import init_schema
from career_os_api.database.pool import create_postgres_pool
from career_os_api.database.retry import DatabaseUnavailableError
from career_os_api.middleware import RequestIdFilter, RequestIdMiddleware
from career_os_api.responses import api_error_response, api_validation_error_response
from career_os_api.router import v1_router

_log_handler = logging.StreamHandler()
_log_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s %(levelname)s [req:%(request_id)s] %(name)s %(message)s"
    )
)
_log_handler.addFilter(RequestIdFilter())
logging.basicConfig(level=logging.INFO, handlers=[_log_handler])

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with (
        create_postgres_pool() as pool,
        httpx.AsyncClient(
            follow_redirects=True, timeout=settings.http_fetch_timeout
        ) as http_client,
        httpx.AsyncClient(
            follow_redirects=True, timeout=settings.http_image_timeout
        ) as image_http_client,
        httpx.AsyncClient(
            timeout=settings.google_risc_http_timeout_seconds
        ) as risc_http_client,
        AsyncOpenAI(api_key=settings.openai_api_key) as openai_client,
    ):
        await init_schema(pool)
        app.state.pool = pool
        app.state.http_client = http_client
        app.state.image_http_client = image_http_client
        app.state.risc_http_client = risc_http_client
        app.state.openai_client = openai_client
        yield


career_os = FastAPI(
    lifespan=lifespan,
    title="Career OS API",
    docs_url=f"/{API_V1}/docs",
    redoc_url=f"/{API_V1}/redoc",
)

career_os.add_middleware(RequestIdMiddleware)
career_os.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
career_os.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    https_only=True,
    same_site="none",
    max_age=settings.jwt_expire_minutes * 60,
)


@career_os.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    return api_error_response(
        status_code=exc.status_code,
        detail=str(exc.detail),
        instance=str(request.url.path),
    )


@career_os.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return api_validation_error_response(
        errors=exc.errors(),
        instance=str(request.url.path),
    )


@career_os.exception_handler(DatabaseUnavailableError)
async def database_unavailable_exception_handler(
    request: Request,
    _exc: DatabaseUnavailableError,
) -> JSONResponse:
    return api_error_response(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.",
        instance=str(request.url.path),
    )


@career_os.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.error(
        "Unhandled API exception",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return api_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        instance=str(request.url.path),
    )


career_os.include_router(v1_router)
