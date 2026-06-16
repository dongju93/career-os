from datetime import datetime
from typing import TypedDict, cast
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.schemas import JobPostingExtracted


class UpsertResult(TypedDict):
    id: int
    group_id: UUID
    application_status: str
    status_updated_at: datetime | None
    memo: str | None
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime
    inserted: bool


class JobPostingListRow(TypedDict):
    id: int
    group_id: UUID
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
    application_status: str
    status_updated_at: datetime | None
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
    memo: str | None


_UPSERT_SQL = """
INSERT INTO job_postings (
    user_id, group_id,
    platform, posting_id, posting_url,
    company_name, job_title, experience_req, deadline, location,
    employment_type, job_description, responsibilities, qualifications,
    preferred_points, benefits, hiring_process,
    education_req, salary, tech_stack, tags,
    application_method, application_form, contact_person,
    homepage, job_category, industry
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
)
ON CONFLICT (group_id, platform, posting_id) DO UPDATE SET
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
RETURNING
    id, group_id, application_status, status_updated_at, memo,
    scraped_at, created_at, updated_at, (xmax = 0) AS inserted
"""

# Selects only summary-level columns — heavy text fields are intentionally omitted.
_LIST_BY_USER_SQL = """
SELECT
    id, group_id, platform, posting_id, posting_url,
    company_name, job_title, experience_req, deadline, location,
    employment_type, salary, tech_stack, tags,
    job_category, industry, application_status, status_updated_at,
    scraped_at, created_at, updated_at
FROM job_postings
WHERE user_id = %s
ORDER BY scraped_at DESC
LIMIT %s OFFSET %s
"""

_COUNT_BY_USER_SQL = """
SELECT COUNT(*) AS total
FROM job_postings
WHERE user_id = %s
"""

_LIST_BY_GROUP_SQL = """
SELECT
    id, group_id, platform, posting_id, posting_url,
    company_name, job_title, experience_req, deadline, location,
    employment_type, salary, tech_stack, tags,
    job_category, industry, application_status, status_updated_at,
    scraped_at, created_at, updated_at
FROM job_postings
WHERE group_id = %s
ORDER BY scraped_at DESC
LIMIT %s OFFSET %s
"""

_COUNT_BY_GROUP_SQL = """
SELECT COUNT(*) AS total
FROM job_postings
WHERE group_id = %s
"""

# Shared by the detail SELECT and the update RETURNING so both always project the
# full JobPostingDetailRow shape and cannot drift apart when columns are added.
_DETAIL_COLUMNS = """
    id, group_id, platform, posting_id, posting_url,
    company_name, job_title, experience_req, deadline, location,
    employment_type, job_description, responsibilities, qualifications,
    preferred_points, benefits, hiring_process,
    education_req, salary, tech_stack, tags,
    application_method, application_form, contact_person,
    homepage, job_category, industry,
    application_status, status_updated_at, memo,
    scraped_at, created_at, updated_at
"""

_DETAIL_SQL = f"""
SELECT {_DETAIL_COLUMNS}
FROM job_postings
WHERE id = %s
  AND user_id = %s
"""

# Existence-by-ownership check for a PATCH group move. Scoped by user_id so a group
# that exists but belongs to someone else returns no row (the FK on the UPDATE only
# enforces that the group exists, never that the caller owns it).
_GROUP_OWNED_BY_USER_SQL = """
SELECT 1
FROM job_search_groups
WHERE id = %s AND user_id = %s
"""


class TargetGroupNotFoundError(Exception):
    """A PATCH tried to move a posting into a group the caller does not own.

    Raised by update_job_posting_fields so the route can map it to 404 distinctly
    from a missing posting (which surfaces as a None return)."""


async def upsert_job_posting(
    conn: AsyncConnection,
    data: JobPostingExtracted,
    user_id: UUID,
    group_id: UUID,
) -> UpsertResult:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _UPSERT_SQL,
            (
                user_id,
                group_id,
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
    group_id: UUID | None = None,
) -> tuple[list[JobPostingListRow], int]:
    async with conn.cursor(row_factory=dict_row) as cur:
        if group_id is not None:
            await cur.execute(_LIST_BY_GROUP_SQL, (group_id, limit, offset))
            rows = await cur.fetchall()
            await cur.execute(_COUNT_BY_GROUP_SQL, (group_id,))
        else:
            await cur.execute(_LIST_BY_USER_SQL, (user_id, limit, offset))
            rows = await cur.fetchall()
            await cur.execute(_COUNT_BY_USER_SQL, (user_id,))
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


async def update_job_posting_fields(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    job_id: int,
    fields: dict[str, object],
) -> JobPostingDetailRow | None:
    """Update only the columns present in `fields`, returning the full detail row.

    Builds a dynamic SET like update_job_search_group. When application_status is
    among the updated fields, status_updated_at is stamped in the same statement.
    The WHERE is scoped by user_id, so a foreign or unknown id matches no row and
    yields None (the route maps that to 404).

    A group move (group_id in fields) first verifies — on this same connection, so
    within one transaction — that the target group belongs to the caller; a foreign
    or unknown group raises TargetGroupNotFoundError. A move that would duplicate a
    posting in the target group (the uq_job_postings_group_id unique index) surfaces
    as psycopg's UniqueViolation, which the route maps to 409.
    """
    if not fields:
        return await get_job_posting(conn, job_id, user_id=user_id)

    if "group_id" in fields:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_GROUP_OWNED_BY_USER_SQL, (fields["group_id"], user_id))
            if await cur.fetchone() is None:
                raise TargetGroupNotFoundError

    set_clauses = [f"{key} = %s" for key in fields]
    values = list(fields.values())
    if "application_status" in fields:
        set_clauses.append("status_updated_at = NOW()")
    set_sql = ", ".join(set_clauses)
    sql = f"""
UPDATE job_postings
SET {set_sql}, updated_at = NOW()
WHERE id = %s AND user_id = %s
RETURNING {_DETAIL_COLUMNS}
"""
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, (*values, job_id, user_id))  # type: ignore[arg-type]
        return cast("JobPostingDetailRow | None", await cur.fetchone())


class JobPostingChatSummaryRow(TypedDict):
    id: int
    group_id: UUID
    platform: str
    company_name: str
    job_title: str
    experience_req: str | None
    deadline: str | None
    location: str | None
    employment_type: str | None
    salary: str | None
    tech_stack: list[str] | None
    job_category: str | None
    industry: str | None
    scraped_at: datetime


class JobPostingChatDetailRow(JobPostingChatSummaryRow):
    posting_url: str
    job_description: str | None
    responsibilities: str | None
    qualifications: str | None
    preferred_points: str | None
    benefits: str | None
    hiring_process: str | None
    education_req: str | None
    application_method: str | None
    homepage: str | None


# Chat-context queries run with untrusted, model-chosen filters, so user_id
# scoping is mandatory in every WHERE — ownership is never delegated to callers.
_CHAT_SEARCH_SQL = """
SELECT
    id, group_id, platform, company_name, job_title, experience_req, deadline,
    location, employment_type, salary, tech_stack, job_category, industry, scraped_at
FROM job_postings
WHERE user_id = %(user_id)s
  AND (%(group_id)s::uuid IS NULL OR group_id = %(group_id)s)
  AND (
      %(query)s::text IS NULL
      OR company_name ILIKE %(pattern)s
      OR job_title ILIKE %(pattern)s
      OR experience_req ILIKE %(pattern)s
      OR location ILIKE %(pattern)s
      OR employment_type ILIKE %(pattern)s
      OR salary ILIKE %(pattern)s
      OR job_category ILIKE %(pattern)s
      OR industry ILIKE %(pattern)s
      OR array_to_string(tech_stack, ' ') ILIKE %(pattern)s
  )
ORDER BY scraped_at DESC, id DESC
LIMIT %(limit)s
"""

# contact_person is intentionally not selected — personal data must not enter
# model context automatically.
_CHAT_DETAIL_SQL = """
SELECT
    id, group_id, platform, company_name, job_title, experience_req, deadline,
    location, employment_type, salary, tech_stack, job_category, industry, scraped_at,
    posting_url, job_description, responsibilities, qualifications,
    preferred_points, benefits, hiring_process, education_req,
    application_method, homepage
FROM job_postings
WHERE id = %(job_id)s AND user_id = %(user_id)s
"""


def _escape_chat_like_pattern(query: str) -> str:
    """LIKE/ILIKE 와일드카드(%, _)와 escape 문자(\\)를 literal로 검색되도록 이스케이프한다."""
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def search_job_postings_for_chat_context(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    query: str | None,
    group_id: UUID | None,
    limit: int,
) -> list[JobPostingChatSummaryRow]:
    pattern = f"%{_escape_chat_like_pattern(query)}%" if query else None
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _CHAT_SEARCH_SQL,
            {
                "user_id": user_id,
                "group_id": group_id,
                "query": query,
                "pattern": pattern,
                "limit": limit,
            },
        )
        rows = await cur.fetchall()
    return cast(list[JobPostingChatSummaryRow], rows)


async def get_job_posting_for_chat_context(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    job_id: int,
) -> JobPostingChatDetailRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_CHAT_DETAIL_SQL, {"job_id": job_id, "user_id": user_id})
        return cast("JobPostingChatDetailRow | None", await cur.fetchone())


# Per-field character cap for the heavy text columns fed to the Strategist agent.
# Fit/gap analysis needs qualifications/preferred_points/responsibilities, but the
# full TEXT would balloon the model context (and the DB→app transfer), so LEFT()
# trims each in the query: ~20 postings × ~1.2 KB worst case.
_MAX_STRATEGIST_FIELD_CHARS = 400


class JobPostingStrategistRow(TypedDict):
    id: int
    group_id: UUID
    platform: str
    company_name: str
    job_title: str
    experience_req: str | None
    deadline: str | None
    location: str | None
    employment_type: str | None
    salary: str | None
    tech_stack: list[str] | None
    job_category: str | None
    industry: str | None
    application_status: str
    status_updated_at: datetime | None
    scraped_at: datetime
    # Trimmed to _MAX_STRATEGIST_FIELD_CHARS by LEFT() in the query.
    qualifications: str | None
    preferred_points: str | None
    responsibilities: str | None


# contact_person is intentionally never selected — personal data must not enter
# model context automatically (same posture as the chat-context queries). The
# untrusted, model-chosen group_id/status filters and the trim length are bound as
# params (keeping this a LiteralString) and the user_id scope is mandatory.
_STRATEGIST_LIST_SQL = """
SELECT
    id, group_id, platform, company_name, job_title, experience_req, deadline,
    location, employment_type, salary, tech_stack, job_category, industry,
    application_status, status_updated_at, scraped_at,
    LEFT(qualifications, %(field_chars)s)   AS qualifications,
    LEFT(preferred_points, %(field_chars)s) AS preferred_points,
    LEFT(responsibilities, %(field_chars)s) AS responsibilities
FROM job_postings
WHERE user_id = %(user_id)s
  AND (%(group_id)s::uuid IS NULL OR group_id = %(group_id)s)
  AND (%(status)s::text IS NULL OR application_status = %(status)s)
ORDER BY scraped_at DESC, id DESC
LIMIT %(limit)s
"""

_STRATEGIST_COUNT_SQL = """
SELECT COUNT(*) AS total
FROM job_postings
WHERE user_id = %(user_id)s AND group_id = %(group_id)s
"""

# Re-verifies model-emitted plan ids against the caller's own postings. ANY(array)
# lets us validate the whole batch in one round trip; the user_id scope means a
# hallucinated or cross-tenant id simply does not come back. The optional group_id
# clause additionally drops any id outside the plan's target group, so a model that
# references a real-but-other-group posting cannot pollute a group-scoped plan.
_STRATEGIST_OWNED_IDS_SQL = """
SELECT id
FROM job_postings
WHERE user_id = %(user_id)s
  AND (%(group_id)s::uuid IS NULL OR group_id = %(group_id)s)
  AND id = ANY(%(ids)s)
"""


async def list_job_postings_for_strategist(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    group_id: UUID | None,
    status: str | None,
    limit: int,
) -> list[JobPostingStrategistRow]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _STRATEGIST_LIST_SQL,
            {
                "user_id": user_id,
                "group_id": group_id,
                "status": status,
                "limit": limit,
                "field_chars": _MAX_STRATEGIST_FIELD_CHARS,
            },
        )
        rows = await cur.fetchall()
    return cast(list[JobPostingStrategistRow], rows)


async def count_job_postings_for_strategist(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    group_id: UUID,
) -> int:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _STRATEGIST_COUNT_SQL, {"user_id": user_id, "group_id": group_id}
        )
        row = await cur.fetchone()
    assert row is not None  # COUNT(*) always returns exactly one row
    return row["total"]


async def filter_owned_job_posting_ids(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    job_ids: list[int],
    group_id: UUID | None = None,
) -> set[int]:
    """Return the subset of job_ids that actually belong to user_id.

    Used to drop hallucinated / cross-tenant ids from model output before it
    reaches the client. When group_id is given, the result is further restricted
    to postings in that group, so a group-scoped plan cannot keep an id that names
    a real posting in one of the user's other groups. An empty input short-circuits
    without a query.
    """
    if not job_ids:
        return set()
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _STRATEGIST_OWNED_IDS_SQL,
            {"user_id": user_id, "ids": job_ids, "group_id": group_id},
        )
        rows = await cur.fetchall()
    return {row["id"] for row in rows}
