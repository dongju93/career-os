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
from uuid import UUID

from agents import Agent, Runner
from agents.exceptions import AgentsException
from fastapi import APIRouter, Depends, HTTPException, Request, status

from career_os_api.auth.dependencies import get_current_user
from career_os_api.config import settings
from career_os_api.database.job_postings import (
    count_job_postings_for_strategist,
    filter_owned_job_posting_ids,
    get_job_posting,
)
from career_os_api.database.job_search_groups import (
    filter_owned_group_ids,
    get_current_group_id,
    get_job_search_group,
)
from career_os_api.database.retry import run_database_operation
from career_os_api.database.user_profiles import get_user_profile
from career_os_api.middleware import get_request_id
from career_os_api.rate_limit import quota, rate_limit
from career_os_api.responses import ApiResponse
from career_os_api.schemas import (
    ApplicationArtifact,
    ApplicationPlan,
    ApplicationPlanRequest,
    ArtifactRequest,
    ProposedAction,
)
from career_os_api.strategist.strategist_agent import (
    build_artifact_agent,
    build_strategist_agent,
    compose_artifact_input,
)
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


async def run_strategist_artifact(
    agent: Agent[StrategistRunContext],
    input_text: str,
    context: StrategistRunContext,
) -> ApplicationArtifact:
    """Thin SDK seam for the artifact run (monkeypatched in API tests).

    The agent is tool-less, so a single structured-output turn suffices; max_turns=2
    leaves headroom without inviting open-ended loops.
    """
    result = await Runner.run(agent, input_text, context=context, max_turns=2)
    return result.final_output_as(ApplicationArtifact)


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
        user_id=user_id,
        pool=pool,
        request_id=get_request_id(),
        target_group_id=group_id,
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

    # Step 6: model output is untrusted — drop any item or proposed action whose
    # job_id is not the caller's own *and* in the analyzed group, or (for
    # assign_group) whose target group is not the caller's own.
    plan = await _filter_owned_plan_output(pool, user_id, group_id, plan)

    # Step 7.
    return ApiResponse(
        status=status.HTTP_200_OK,
        message="지원 전략 플랜이 생성되었습니다.",
        data=plan,
    )


def _is_proposed_action_owned(
    action: ProposedAction, owned_ids: set[int], owned_groups: set[UUID]
) -> bool:
    """An action survives only if its posting is owned, and — for assign_group — its
    target group is owned and is a parseable UUID."""
    if action.job_id not in owned_ids:
        return False
    if action.action_type == "assign_group":
        if not action.target_group_id:
            return False
        try:
            return UUID(action.target_group_id) in owned_groups
        except ValueError:
            return False
    return True


async def _filter_owned_plan_output(
    pool: Any, user_id: Any, group_id: UUID, plan: ApplicationPlan
) -> ApplicationPlan:
    """Last line of defense against hallucinated / cross-tenant / cross-group
    references reaching the client. Drops any plan item or proposed action whose
    job_id is not one of the caller's postings *in the analyzed group*, plus any
    assign_group action whose target_group_id is not one of the caller's groups.

    Scoping the job_id check to `group_id` (not just user_id) matches the list tool,
    which only ever surfaces the target group's postings — so an item naming a
    real-but-other-group posting is treated as out-of-scope, not kept."""
    # One id space for items and actions so a single query verifies every job_id.
    job_ids = {item.job_id for item in plan.items}
    job_ids.update(action.job_id for action in plan.proposed_actions)

    # Candidate target groups come only from assign_group actions; non-UUID strings
    # are skipped here and the owning action is dropped by _is_proposed_action_owned.
    target_group_ids: set[UUID] = set()
    for action in plan.proposed_actions:
        if action.action_type == "assign_group" and action.target_group_id:
            try:
                target_group_ids.add(UUID(action.target_group_id))
            except ValueError:
                continue

    async def operation(conn: Any) -> tuple[set[int], set[UUID]]:
        owned_ids = await filter_owned_job_posting_ids(
            conn, user_id=user_id, job_ids=list(job_ids), group_id=group_id
        )
        owned_groups = await filter_owned_group_ids(
            conn, user_id=user_id, group_ids=list(target_group_ids)
        )
        return owned_ids, owned_groups

    owned_ids, owned_groups = await run_database_operation(
        pool, operation, label="strategist.plan.verify_ids"
    )

    kept_items = [item for item in plan.items if item.job_id in owned_ids]
    kept_actions = [
        action
        for action in plan.proposed_actions
        if _is_proposed_action_owned(action, owned_ids, owned_groups)
    ]

    dropped_items = len(plan.items) - len(kept_items)
    dropped_actions = len(plan.proposed_actions) - len(kept_actions)
    if dropped_items or dropped_actions:
        _logger.warning(
            "strategist.plan.dropped_unowned user_id=%s items=%d actions=%d",
            user_id,
            dropped_items,
            dropped_actions,
        )
        return plan.model_copy(
            update={"items": kept_items, "proposed_actions": kept_actions}
        )
    return plan


@router.post(
    "/agent/artifact",
    tags=["agent"],
    dependencies=[rate_limit(5, per="minute"), quota(20, per="day")],
    responses={
        401: {"description": "인증 실패"},
        404: {"description": "채용 공고를 찾을 수 없음"},
        409: {"description": "프로필이 없음"},
        502: {"description": "자료 생성(에이전트 실행) 실패"},
    },
)
async def create_application_artifact(
    data: ArtifactRequest,
    request: Request,
    current_user: _CurrentUser,
) -> ApiResponse[ApplicationArtifact]:
    user_id = current_user["id"]
    pool = request.app.state.pool

    # Resolve ownership + precondition before any model call. Both are reads, so they
    # share one retryable operation; the posting fetch enforces ownership (foreign /
    # missing id → no row → 404), so no separate id re-check is needed afterwards.
    # HTTPExceptions raised here pass through run_database_operation untouched.
    async def resolve(conn: Any) -> tuple[Any, Any]:
        posting = await get_job_posting(conn, data.job_id, user_id=user_id)
        if posting is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job posting {data.job_id} not found",
            )
        profile = await get_user_profile(conn, user_id=user_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="지원 자료를 생성하려면 먼저 프로필을 작성해주세요.",
            )
        return posting, profile

    posting, profile = await run_database_operation(
        pool, resolve, label="strategist.artifact.resolve"
    )

    # Compose the run input deterministically (tool-less agent) — contact_person is
    # excluded and heavy posting fields trimmed inside compose_artifact_input.
    input_text = compose_artifact_input(
        profile=profile,
        posting=posting,
        artifact_type=data.artifact_type,
        focus=data.focus,
    )

    context = StrategistRunContext(
        user_id=user_id, pool=pool, request_id=get_request_id()
    )
    agent = build_artifact_agent(settings.strategist_model or settings.openai_model)

    try:
        artifact = await run_strategist_artifact(agent, input_text, context)
    except AgentsException as exc:
        _logger.warning(
            "strategist.artifact.run_failed user_id=%s request_id=%s error=%s",
            user_id,
            get_request_id(),
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="지원 자료 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
        ) from exc

    # Model output is untrusted: pin the model-echoed job_id / artifact_type back to
    # the verified request values so a hallucinated echo can never reach the client.
    # Ownership of data.job_id was already confirmed by the posting fetch above.
    artifact = artifact.model_copy(
        update={"job_id": data.job_id, "artifact_type": data.artifact_type}
    )

    return ApiResponse(
        status=status.HTTP_200_OK,
        message="지원 자료가 생성되었습니다.",
        data=artifact,
    )
