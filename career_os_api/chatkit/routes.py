"""ChatKit HTTP entry point.

A single `POST /chatkit` that hands the raw request body to the ChatKit SDK and
adapts its result to a FastAPI response. No Pydantic request schema: the SDK owns
parsing and serialization on both ends. Authentication, rate-limit and quota reuse
the project's existing dependencies; the authenticated user id is the only source
of identity passed into the SDK context.
"""

import logging
from typing import Annotated

from chatkit.server import StreamingResult
from chatkit.store import NotFoundError
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from career_os_api.auth.dependencies import get_current_user
from career_os_api.chatkit.context import ChatKitRequestContext
from career_os_api.chatkit.store import ChatKitThreadLimitError
from career_os_api.config import settings
from career_os_api.middleware import get_request_id
from career_os_api.rate_limit import quota, rate_limit

_logger = logging.getLogger(__name__)

router = APIRouter()

_CurrentUser = Annotated[dict, Depends(get_current_user)]


@router.post(
    "/chatkit",
    tags=["chatkit"],
    dependencies=[rate_limit(30, per="minute"), quota(500, per="day")],
)
async def chatkit_endpoint(request: Request, current_user: _CurrentUser) -> Response:
    if not settings.chatkit_enabled:
        # Hide the feature entirely when disabled.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    server = request.app.state.chatkit_server
    context = ChatKitRequestContext(
        user_id=current_user["id"],
        pool=request.app.state.pool,
        request_id=get_request_id(),
        locale=request.headers.get("accept-language"),
    )

    # Raw body is forwarded verbatim to the SDK and never logged.
    raw_body = await request.body()

    try:
        result = await server.process(raw_body, context)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="잘못된 ChatKit 요청입니다.",
        ) from exc
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="대화를 찾을 수 없습니다.",
        ) from exc
    except ChatKitThreadLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="대화 개수 상한에 도달했습니다. 기존 대화를 삭제한 뒤 다시 시도해 주세요.",
        ) from exc

    if isinstance(result, StreamingResult):
        return StreamingResponse(result, media_type="text/event-stream")
    return Response(content=result.json, media_type="application/json")
