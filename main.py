from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import APIRouter, FastAPI, Query, Request, status
from fastapi.responses import JSONResponse

from career_os_api.config import settings
from career_os_api.database.connection import create_postgres_pool
from career_os_api.service.job_posting.extractor import extract_job_posting
from career_os_api.service.job_posting.fetch import fetch_url_content
from career_os_api.service.job_posting.schema import JobPostingExtracted


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with create_postgres_pool() as pool:
        app.state.pool = pool
        yield


API_V1: str = settings.api_v1
API_V2: str = settings.api_v2

career_os = FastAPI(
    lifespan=lifespan,
    title="Career OS API",
    docs_url=f"/{API_V1}/docs",
    redoc_url=f"/{API_V1}/redoc",
)

v1_router = APIRouter(prefix=f"/{API_V1}")


@v1_router.get("/")
def main() -> JSONResponse:
    return JSONResponse(
        content={"message": "Hello, World!"},
        status_code=status.HTTP_200_OK,
    )


@v1_router.get("/job-postings/extraction")
async def get_job_posting_extraction(
    url: Annotated[str, Query(description="Job posting URL")],
) -> JobPostingExtracted:
    content, _ = await fetch_url_content(url)
    return await extract_job_posting(html_content=content, source_url=url)


@v1_router.get("/health/db")
async def db_health(request: Request) -> JSONResponse:
    async with request.app.state.pool.connection() as conn:
        result = await conn.execute("SELECT 1")
        row = await result.fetchone()
    return JSONResponse(
        content={"database": "connected", "result": row[0]},
        status_code=status.HTTP_200_OK,
    )


career_os.include_router(v1_router)
