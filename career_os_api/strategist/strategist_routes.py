"""Application Strategist HTTP entry point.

`POST /agent/plan` resolves the target group, prechecks the profile, short-circuits
empty groups without a model call, then runs the agent and re-verifies every
model-emitted job_id against the caller's own postings before returning. Mirrors the
chatkit/routes.py structure: feature-flag router dependency, project rate-limit/quota
dependencies, and identity sourced only from `get_current_user`.
"""

import logging
from datetime import date
from typing import Annotated, Any

from agents import Agent, Runner
from agents.exceptions import AgentsException
from fastapi import APIRouter, Depends, HTTPException, Request, status

from career_os_api.auth.dependencies import get_current_user
from career_os_api.config import settings
from career_os_api.database.job_postings import (
    count_job_postings_for_strategist,
    filter_owned_job_posting_ids,
)
from career_os_api.database.job_search_groups import (
    get_current_group_id,
    get_job_search_group,
)
from career_os_api.database.retry import run_database_operation
from career_os_api.database.user_profiles import get_user_profile
from career_os_api.middleware import get_request_id
from career_os_api.rate_limit import quota, rate_limit
from career_os_api.responses import ApiResponse
from career_os_api.schemas import ApplicationPlan, ApplicationPlanRequest
from career_os_api.strategist.strategist_agent import build_strategist_agent
from career_os_api.strategist.strategist_context import StrategistRunContext

_logger = logging.getLogger(__name__)

_EMPTY_PLAN_SUMMARY = "분석할 저장 공고가 없습니다. 먼저 채용 공고를 저장해주세요."


def _require_strategist_enabled() -> None:
    if not settings.strategist_agent_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


router = APIRouter(dependencies=[Depends(_require_strategist_enabled)])

_CurrentUser = Annotated[dict, Depends(get_current_user)]


async def run_strategist_plan(
    agent: Agent[StrategistRunContext],
    input_text: str,
    context: StrategistRunContext,
) -> ApplicationPlan:
    """Thin SDK seam so API tests can monkeypatch the model run wholesale."""
    result = await Runner.run(agent, input_text, context=context, max_turns=8)
    return result.final_output_as(ApplicationPlan)


@router.post(
    "/agent/plan",
    tags=["agent"],
    dependencies=[rate_limit(5, per="minute"), quota(30, per="day")],
    responses={
        401: {"description": "인증 실패"},
        404: {"description": "그룹을 찾을 수 없음"},
        409: {"description": "프로필 또는 구직 활동 그룹이 없음"},
        502: {"description": "플랜 생성(에이전트 실행) 실패"},
    },
)
async def create_application_plan(
    data: ApplicationPlanRequest,
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[ApplicationPlan]:
    user_id = current_user["id"]
    pool = request.app.state.pool

    # Steps 1–3: resolve group ownership, precheck profile, count postings. All
    # reads, so they share one retryable operation. HTTPExceptions raised here
    # pass through run_database_operation untouched (it only catches DB errors).
    async def resolve(conn: Any) -> tuple[Any, int]:
        if data.group_id is not None:
            group = await get_job_search_group(conn, data.group_id)
            if group is None or group["user_id"] != user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="구직 활동 그룹을 찾을 수 없습니다.",
                )
            group_id = data.group_id
        else:
            group_id = await get_current_group_id(conn, user_id)
            if group_id is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="구직 활동 그룹이 없습니다.",
                )

        profile = await get_user_profile(conn, user_id=user_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="플랜을 생성하려면 먼저 프로필을 작성해주세요.",
            )

        count = await count_job_postings_for_strategist(
            conn, user_id=user_id, group_id=group_id
        )
        return group_id, count

    group_id, posting_count = await run_database_operation(
        pool, resolve, label="strategist.plan.resolve"
    )

    # Step 3: empty group → deterministic empty plan, no model call.
    if posting_count == 0:
        return ApiResponse(
            status=status.HTTP_200_OK,
            message="저장된 공고가 없어 빈 플랜을 반환합니다.",
            data=ApplicationPlan(summary=_EMPTY_PLAN_SUMMARY, items=[]),
        )

    # Step 4: compose the run input. The model has no clock, so the date we inject
    # is what makes deadline_urgency computable.
    today = date.today().isoformat()
    input_lines = [f"오늘 날짜: {today}", f"대상 그룹 ID: {group_id}"]
    if data.focus:
        input_lines.append(f"사용자 요청: {data.focus}")
    input_lines.append("위 그룹의 저장 공고를 분석해 지원 전략 플랜을 생성하세요.")
    input_text = "\n".join(input_lines)

    context = StrategistRunContext(
        user_id=user_id, pool=pool, request_id=get_request_id()
    )
    agent = build_strategist_agent(settings.strategist_model or settings.openai_model)

    # Step 5: run the agent through the monkeypatchable wrapper.
    try:
        plan = await run_strategist_plan(agent, input_text, context)
    except AgentsException as exc:
        _logger.warning(
            "strategist.plan.run_failed user_id=%s request_id=%s error=%s",
            user_id,
            get_request_id(),
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="플랜 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
        ) from exc

    # Step 6: model output is untrusted — drop any item whose job_id is not one of
    # the caller's own postings (hallucinated or cross-tenant).
    plan = await _drop_unowned_plan_items(pool, user_id, plan)

    # Step 7.
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="지원 전략 플랜이 생성되었습니다.",
        data=plan,
    )


async def _drop_unowned_plan_items(
    pool: Any, user_id: Any, plan: ApplicationPlan
) -> ApplicationPlan:
    """Last line of defense against hallucinated / cross-tenant ids reaching the
    client. One scoped query; items with unverified job_ids are dropped."""
    job_ids = [item.job_id for item in plan.items]

    async def operation(conn: Any) -> set[int]:
        return await filter_owned_job_posting_ids(
            conn, user_id=user_id, job_ids=job_ids
        )

    owned_ids = await run_database_operation(
        pool, operation, label="strategist.plan.verify_ids"
    )
    kept = [item for item in plan.items if item.job_id in owned_ids]
    dropped = len(plan.items) - len(kept)
    if dropped:
        _logger.warning(
            "strategist.plan.dropped_unowned_items user_id=%s dropped=%d",
            user_id,
            dropped,
        )
        return plan.model_copy(update={"items": kept})
    return plan
