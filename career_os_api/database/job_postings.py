from datetime import datetime
from typing import TypedDict, cast
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.schemas import JobPostingExtracted


class UpsertResult(TypedDict):
    id: int
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime
    inserted: bool


class JobPostingListRow(TypedDict):
    id: int
    platform: str
    posting_id: str
    posting_url: str
    company_name: str
    job_title: str
    experience_req: str | None
    deadline: str | None
    location: str | None
    employment_type: str | None
    salary: str | None
    tech_stack: list[str] | None
    tags: list[str] | None
    job_category: str | None
    industry: str | None
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime


class JobPostingDetailRow(JobPostingListRow):
    job_description: str | None
    responsibilities: str | None
    qualifications: str | None
    preferred_points: str | None
    benefits: str | None
    hiring_process: str | None
    education_req: str | None
    application_method: str | None
    application_form: str | None
    contact_person: str | None
    homepage: str | None


_UPSERT_SQL = """
INSERT INTO job_postings (
    user_id,
    platform, posting_id, posting_url,
    company_name, job_title, experience_req, deadline, location,
    employment_type, job_description, responsibilities, qualifications,
    preferred_points, benefits, hiring_process,
    education_req, salary, tech_stack, tags,
    application_method, application_form, contact_person,
    homepage, job_category, industry
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
)
ON CONFLICT (user_id, platform, posting_id) DO UPDATE SET
    posting_url        = EXCLUDED.posting_url,
    company_name       = EXCLUDED.company_name,
    job_title          = EXCLUDED.job_title,
    experience_req     = EXCLUDED.experience_req,
    deadline           = EXCLUDED.deadline,
    location           = EXCLUDED.location,
    employment_type    = EXCLUDED.employment_type,
    job_description    = EXCLUDED.job_description,
    responsibilities   = EXCLUDED.responsibilities,
    qualifications     = EXCLUDED.qualifications,
    preferred_points   = EXCLUDED.preferred_points,
    benefits           = EXCLUDED.benefits,
    hiring_process     = EXCLUDED.hiring_process,
    education_req      = EXCLUDED.education_req,
    salary             = EXCLUDED.salary,
    tech_stack         = EXCLUDED.tech_stack,
    tags               = EXCLUDED.tags,
    application_method = EXCLUDED.application_method,
    application_form   = EXCLUDED.application_form,
    contact_person     = EXCLUDED.contact_person,
    homepage           = EXCLUDED.homepage,
    job_category       = EXCLUDED.job_category,
    industry           = EXCLUDED.industry,
    scraped_at         = NOW(),
    updated_at         = NOW()
RETURNING id, scraped_at, created_at, updated_at, (xmax = 0) AS inserted
"""

# Selects only summary-level columns — heavy text fields are intentionally omitted.
_LIST_SQL = """
SELECT
    id, platform, posting_id, posting_url,
    company_name, job_title, experience_req, deadline, location,
    employment_type, salary, tech_stack, tags,
    job_category, industry, scraped_at, created_at, updated_at
FROM job_postings
WHERE user_id = %s
ORDER BY scraped_at DESC
LIMIT %s OFFSET %s
"""

_COUNT_SQL = """
SELECT COUNT(*) AS total
FROM job_postings
WHERE user_id = %s
"""

_DETAIL_SQL = """
SELECT
    id, platform, posting_id, posting_url,
    company_name, job_title, experience_req, deadline, location,
    employment_type, job_description, responsibilities, qualifications,
    preferred_points, benefits, hiring_process,
    education_req, salary, tech_stack, tags,
    application_method, application_form, contact_person,
    homepage, job_category, industry,
    scraped_at, created_at, updated_at
FROM job_postings
WHERE id = %s
  AND user_id = %s
"""


async def upsert_job_posting(
    conn: AsyncConnection,
    data: JobPostingExtracted,
    user_id: UUID,
) -> UpsertResult:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _UPSERT_SQL,
            (
                user_id,
                str(data.platform),
                data.posting_id,
                data.posting_url,
                data.company_name,
                data.job_title,
                data.experience_req,
                data.deadline,
                data.location,
                data.employment_type,
                data.job_description,
                data.responsibilities,
                data.qualifications,
                data.preferred_points,
                data.benefits,
                data.hiring_process,
                data.education_req,
                data.salary,
                data.tech_stack,
                data.tags,
                data.application_method,
                data.application_form,
                data.contact_person,
                data.homepage,
                data.job_category,
                data.industry,
            ),
        )
        row = await cur.fetchone()
    assert row is not None  # RETURNING always yields a row on successful DML
    return cast(UpsertResult, row)


async def get_job_postings(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    limit: int,
    offset: int,
    with_total: bool = True,
) -> tuple[list[JobPostingListRow], int | None]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_LIST_SQL, (user_id, limit, offset))
        rows = await cur.fetchall()
        if not with_total:
            return cast(list[JobPostingListRow], rows), None
        await cur.execute(_COUNT_SQL, (user_id,))
        count_row = await cur.fetchone()
    assert count_row is not None  # COUNT(*) always returns exactly one row
    return cast(list[JobPostingListRow], rows), count_row["total"]


async def get_job_posting(
    conn: AsyncConnection,
    job_id: int,
    *,
    user_id: UUID,
) -> JobPostingDetailRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_DETAIL_SQL, (job_id, user_id))
        return cast("JobPostingDetailRow | None", await cur.fetchone())
