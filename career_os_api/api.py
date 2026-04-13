from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse

from career_os_api.constants import API_V1
from career_os_api.database.job_postings import (
    get_job_posting,
    get_job_postings,
    upsert_job_posting,
)
from career_os_api.service.job_posting.extractor import extract_job_posting
from career_os_api.service.job_posting.fetch import fetch_url_content
from career_os_api.service.job_posting.schema import (
    JobPostingExtracted,
    JobPostingListItem,
    JobPostingPage,
    JobPostingStored,
)

v1_router = APIRouter(prefix=f"/{API_V1}")


@v1_router.get("/")
def main() -> JSONResponse:
    return JSONResponse(
        content={"message": "Hello, World!"},
        status_code=status.HTTP_200_OK,
    )


@v1_router.get("/job-postings")
async def list_job_postings(
    request: Request,
    offset: Annotated[int, Query(ge=0, description="Number of records to skip")] = 0,
    limit: Annotated[
        int, Query(ge=1, le=100, description="Max records to return")
    ] = 20,
) -> JobPostingPage:
    async with request.app.state.pool.connection() as conn:
        rows, total = await get_job_postings(conn, limit=limit, offset=offset)
    return JobPostingPage(
        items=[JobPostingListItem(**row) for row in rows],
        total=total,
        offset=offset,
        limit=limit,
    )


@v1_router.get(
    "/job-postings/extraction",
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
) -> JobPostingExtracted:
    content, _ = await fetch_url_content(url)
    return await extract_job_posting(html_content=content, source_url=url)


@v1_router.post(
    "/job-postings",
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
) -> JobPostingStored:
    async with request.app.state.pool.connection() as conn:
        row = await upsert_job_posting(conn, data)
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
    responses={404: {"description": "Job posting not found"}},
)
async def get_job_posting_detail(
    job_id: int,
    request: Request,
) -> JobPostingStored:
    async with request.app.state.pool.connection() as conn:
        row = await get_job_posting(conn, job_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job posting {job_id} not found",
        )
    return JobPostingStored(**row)


@v1_router.get("/health/db")
async def db_health(request: Request) -> JSONResponse:
    async with request.app.state.pool.connection() as conn:
        result = await conn.execute("SELECT 1")
        row = await result.fetchone()
    return JSONResponse(
        content={"database": "connected", "result": row[0]},
        status_code=status.HTTP_200_OK,
    )
