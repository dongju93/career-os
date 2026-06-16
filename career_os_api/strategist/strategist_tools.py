"""지원 전략 에이전트의 read-only Agents SDK function tool.

모든 조회는 ctx.context.user_id로 scope된다. 모델은 user 신원을 인자로 줄 수 없다.
그룹 스코프도 마찬가지로 서버가 정한다: list 도구는 ctx.context.target_group_id만
사용하고, 모델이 그룹을 고를 수 없게 해 분석 대상 그룹이 다른 그룹으로 새는 것을 막는다.
status / limit은 untrusted input으로 취급해 파싱·검증·clamp한다. 두 도구 모두 별도로
테스트 가능한 `_impl` 함수에 위임한다(chatkit/job_posting_tools.py 패턴).
"""

import json
from typing import Annotated, Any

from agents import RunContextWrapper, function_tool

from career_os_api.config import settings
from career_os_api.database.job_postings import list_job_postings_for_strategist
from career_os_api.database.retry import run_database_operation
from career_os_api.database.user_profiles import get_user_profile
from career_os_api.schemas import ApplicationStatus
from career_os_api.strategist.strategist_context import StrategistRunContext

StrategistToolContext = RunContextWrapper[StrategistRunContext]

_DEFAULT_LIST_LIMIT = 20


async def _get_career_profile_impl(context: StrategistRunContext) -> str:
    """현재 사용자의 커리어 프로필을 반환하거나, 없으면 {"exists": false}.

    이메일·계정 식별자는 user_profiles 테이블에 없고, 여기서도 절대 싣지 않는다.
    """

    async def operation(conn: Any) -> Any:
        return await get_user_profile(conn, user_id=context.user_id)

    row = await run_database_operation(
        context.pool, operation, label="strategist.get_career_profile"
    )
    if row is None:
        return json.dumps({"exists": False}, ensure_ascii=False)
    profile = {
        "exists": True,
        "headline": row["headline"],
        "years_experience": row["years_experience"],
        "target_roles": row["target_roles"],
        "skills": row["skills"],
        "locations": row["locations"],
        "salary_expectation": row["salary_expectation"],
        "summary": row["summary"],
    }
    return json.dumps(profile, ensure_ascii=False, default=str)


async def _list_postings_with_status_impl(
    context: StrategistRunContext,
    *,
    status: str | None,
    limit: int,
) -> str:
    # Group scope is server-pinned: the plan route resolves the target group and
    # stores it on the context, so the model cannot widen the analysis to another
    # group by omitting (or changing) a group argument.
    target_group_id = context.target_group_id

    clamped_limit = max(1, min(limit, settings.strategist_plan_posting_limit))

    normalized_status: str | None = None
    if status:
        try:
            normalized_status = ApplicationStatus(status).value
        except ValueError:
            return json.dumps({"error": "invalid_status"}, ensure_ascii=False)

    async def operation(conn: Any) -> Any:
        return await list_job_postings_for_strategist(
            conn,
            user_id=context.user_id,
            group_id=target_group_id,
            status=normalized_status,
            limit=clamped_limit,
        )

    rows = await run_database_operation(
        context.pool, operation, label="strategist.list_postings_with_status"
    )
    items = [dict(row) for row in rows]
    payload = {
        "items": items,
        "count": len(items),
        "group_id": str(target_group_id) if target_group_id else None,
        "status": normalized_status,
    }
    return json.dumps(payload, ensure_ascii=False, default=str)


@function_tool(
    name_override="get_career_profile",
    description_override=(
        "Read the authenticated user's saved career profile (headline, years of "
        "experience, target roles, skills, locations, salary expectation, summary). "
        'Returns {"exists": false} when no profile has been created yet. Call this '
        "first to ground fit scoring."
    ),
)
async def get_career_profile(ctx: StrategistToolContext) -> str:
    return await _get_career_profile_impl(ctx.context)


@function_tool(
    name_override="list_postings_with_status",
    description_override=(
        "List the authenticated user's saved job postings with their application "
        "status. The list is always scoped to the target job-search group for this "
        "plan run (you cannot choose the group). Use this to pick which postings to "
        "analyze; optionally filter by application status."
    ),
)
async def list_postings_with_status(
    ctx: StrategistToolContext,
    status: Annotated[
        str | None,
        "Optional application status filter: saved/applied/interviewing/offer/rejected/withdrawn",
    ] = None,
    limit: Annotated[int, "Maximum number of postings to return"] = _DEFAULT_LIST_LIMIT,
) -> str:
    return await _list_postings_with_status_impl(
        ctx.context, status=status, limit=limit
    )
