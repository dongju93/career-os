"""인증 사용자의 저장 공고를 모델에 노출하는 Agents SDK function tool (read-only).

모든 조회는 ctx.context.request_context.user_id로 scope된다. 모델은 user 신원을 인자로 줄 수
없다. job_id / group_id / query / limit은 untrusted input으로 취급한다.
"""

import json
from typing import Annotated, Any
from uuid import UUID

from agents import RunContextWrapper, function_tool
from chatkit.agents import AgentContext

from career_os_api.chatkit.context import ChatKitRequestContext
from career_os_api.database.job_postings import (
    JobPostingChatDetailRow,
    get_job_posting_for_chat_context,
    search_job_postings_for_chat_context,
)
from career_os_api.database.retry import run_database_operation

_DEFAULT_SEARCH_LIMIT = 5
_MAX_SEARCH_LIMIT = 8
_MAX_QUERY_CHARS = 120
_MAX_DETAIL_FIELD_CHARS = 1_500
_MAX_DETAIL_TOTAL_CHARS = 8_000

ToolRunContext = RunContextWrapper[AgentContext[ChatKitRequestContext]]

_SUMMARY_FIELDS = (
    "id",
    "company_name",
    "job_title",
    "platform",
    "deadline",
    "location",
    "experience_req",
    "employment_type",
    "salary",
    "tech_stack",
    "job_category",
    "industry",
    "scraped_at",
)

# 상세 응답에서 길이 예산 초과 시 순서대로 줄일 heavy text 필드.
_DETAIL_HEAVY_FIELDS = (
    "job_description",
    "responsibilities",
    "qualifications",
    "preferred_points",
    "benefits",
    "hiring_process",
)


def _trim_chat_field(value: str | None, limit: int) -> str | None:
    if value is None or len(value) <= limit:
        return value
    return value[:limit]


def _build_chat_detail_payload(row: JobPostingChatDetailRow) -> dict[str, Any]:
    posting: dict[str, Any] = {
        "id": row["id"],
        "platform": row["platform"],
        "company_name": row["company_name"],
        "job_title": row["job_title"],
        "posting_url": row["posting_url"],
        "experience_req": row["experience_req"],
        "deadline": row["deadline"],
        "location": row["location"],
        "employment_type": row["employment_type"],
        "salary": row["salary"],
        "tech_stack": row["tech_stack"],
        "job_description": _trim_chat_field(
            row["job_description"], _MAX_DETAIL_FIELD_CHARS
        ),
        "responsibilities": _trim_chat_field(
            row["responsibilities"], _MAX_DETAIL_FIELD_CHARS
        ),
        "qualifications": _trim_chat_field(
            row["qualifications"], _MAX_DETAIL_FIELD_CHARS
        ),
        "preferred_points": _trim_chat_field(
            row["preferred_points"], _MAX_DETAIL_FIELD_CHARS
        ),
        "benefits": _trim_chat_field(row["benefits"], _MAX_DETAIL_FIELD_CHARS),
        "hiring_process": _trim_chat_field(
            row["hiring_process"], _MAX_DETAIL_FIELD_CHARS
        ),
        "education_req": row["education_req"],
        "application_method": row["application_method"],
        "homepage": row["homepage"],
        "job_category": row["job_category"],
        "industry": row["industry"],
        "scraped_at": row["scraped_at"],
    }
    _enforce_chat_detail_budget(posting)
    return posting


def _enforce_chat_detail_budget(posting: dict[str, Any]) -> None:
    """전체 JSON 길이가 _MAX_DETAIL_TOTAL_CHARS를 넘으면 heavy field를 순서대로 줄인다."""

    def total() -> int:
        return len(json.dumps(posting, ensure_ascii=False, default=str))

    for field in _DETAIL_HEAVY_FIELDS:
        if total() <= _MAX_DETAIL_TOTAL_CHARS:
            return
        value = posting.get(field)
        if not value:
            continue
        overflow = total() - _MAX_DETAIL_TOTAL_CHARS
        posting[field] = value[: max(0, len(value) - overflow)]


async def _search_saved_job_postings_impl(
    request_context: ChatKitRequestContext,
    *,
    query: str | None,
    group_id: str | None,
    limit: int,
) -> str:
    normalized_query = (query.strip()[:_MAX_QUERY_CHARS] or None) if query else None
    clamped_limit = max(1, min(limit, _MAX_SEARCH_LIMIT))

    parsed_group_id: UUID | None = None
    if group_id:
        try:
            parsed_group_id = UUID(group_id)
        except ValueError:
            return json.dumps({"error": "invalid_group_id"}, ensure_ascii=False)

    async def operation(conn: Any) -> list[Any]:
        return await search_job_postings_for_chat_context(
            conn,
            user_id=request_context.user_id,
            query=normalized_query,
            group_id=parsed_group_id,
            limit=clamped_limit,
        )

    rows = await run_database_operation(
        request_context.pool, operation, label="chatkit.search_saved_job_postings"
    )

    items = [{field: row.get(field) for field in _SUMMARY_FIELDS} for row in rows]
    payload = {
        "items": items,
        "count": len(items),
        "truncated": len(items) >= clamped_limit,
        "query": normalized_query,
        "group_id": str(parsed_group_id) if parsed_group_id else None,
    }
    return json.dumps(payload, ensure_ascii=False, default=str)


async def _get_saved_job_posting_detail_impl(
    request_context: ChatKitRequestContext,
    *,
    job_id: int,
) -> str:
    if job_id <= 0:
        return json.dumps({"error": "invalid_job_id"}, ensure_ascii=False)

    async def operation(conn: Any) -> JobPostingChatDetailRow | None:
        return await get_job_posting_for_chat_context(
            conn, user_id=request_context.user_id, job_id=job_id
        )

    row = await run_database_operation(
        request_context.pool, operation, label="chatkit.get_saved_job_posting_detail"
    )
    if row is None:
        return json.dumps({"found": False}, ensure_ascii=False)
    return json.dumps(
        {"found": True, "posting": _build_chat_detail_payload(row)},
        ensure_ascii=False,
        default=str,
    )


@function_tool(
    name_override="search_saved_job_postings",
    description_override=(
        "Search the authenticated user's saved job postings in Career OS. "
        "Use this when the user asks about saved postings, recent postings, "
        "postings by company/title/skill/location, or comparing stored postings."
    ),
)
async def search_saved_job_postings(
    ctx: ToolRunContext,
    query: Annotated[
        str | None, "Optional company, title, skill, location, or keyword"
    ] = None,
    group_id: Annotated[str | None, "Optional job search group UUID"] = None,
    limit: Annotated[
        int, "Maximum number of postings to return, 1 to 8"
    ] = _DEFAULT_SEARCH_LIMIT,
) -> str:
    return await _search_saved_job_postings_impl(
        ctx.context.request_context, query=query, group_id=group_id, limit=limit
    )


@function_tool(
    name_override="get_saved_job_posting_detail",
    description_override=(
        "Read one saved job posting owned by the authenticated user. "
        "Use this after search_saved_job_postings returns a relevant id, "
        "or when the user explicitly refers to a saved posting id."
    ),
)
async def get_saved_job_posting_detail(
    ctx: ToolRunContext,
    job_id: Annotated[int, "Saved job posting id from Career OS"],
) -> str:
    return await _get_saved_job_posting_detail_impl(
        ctx.context.request_context, job_id=job_id
    )
