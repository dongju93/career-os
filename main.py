import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from career_os_api.config import settings
from career_os_api.constants import API_V1
from career_os_api.database.ddl import init_schema
from career_os_api.database.pool import create_postgres_pool
from career_os_api.database.retry import DatabaseUnavailableError
from career_os_api.responses import ApiErrorCode, api_error_response
from career_os_api.router import v1_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with create_postgres_pool() as pool:
        await init_schema(pool)
        app.state.pool = pool
        yield


career_os = FastAPI(
    lifespan=lifespan,
    title="Career OS API",
    docs_url=f"/{API_V1}/docs",
    redoc_url=f"/{API_V1}/redoc",
)

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


@career_os.exception_handler(DatabaseUnavailableError)
async def database_unavailable_exception_handler(
    _request: Request,
    _exc: DatabaseUnavailableError,
) -> JSONResponse:
    return api_error_response(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        code=ApiErrorCode.DATABASE_UNAVAILABLE,
        message="데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.",
    )


@career_os.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.error(
        "Unhandled API exception",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return api_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code=ApiErrorCode.INTERNAL_SERVER_ERROR,
        message="서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    )


career_os.include_router(v1_router)
