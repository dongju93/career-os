"""ChatKit HTTP entry point.

A single `POST /chatkit` that hands the raw request body to the ChatKit SDK and
adapts its result to a FastAPI response. No Pydantic request schema: the SDK owns
parsing and serialization on both ends. Authentication, rate-limit and quota reuse
the project's existing dependencies; the authenticated user id is the only source
of identity passed into the SDK context.
"""

import logging
from typing import Annotated

import psycopg.errors
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
from career_os_api.responses import (
    AUTHENTICATION_ERROR_RESPONSE,
    CONFLICT_ERROR_RESPONSE,
    NOT_FOUND_ERROR_RESPONSE,
    PAYLOAD_TOO_LARGE_ERROR_RESPONSE,
    ProblemDetail,
)

_logger = logging.getLogger(__name__)


def _require_chatkit_enabled() -> None:
    if not settings.chatkit_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


router = APIRouter(dependencies=[Depends(_require_chatkit_enabled)])

_CurrentUser = Annotated[dict, Depends(get_current_user)]

# `rate_limit`/`quota` bound request *frequency*, not per-request size, so a
# single oversized POST would still be buffered into memory in full. Stream the
# body with a hard cap — mirroring the RISC receiver's `_MAX_RISC_BODY_BYTES`
# pattern in router.py — to bound memory use on this endpoint.
_MAX_CHATKIT_BODY_BYTES = 262_144


@router.post(
    "/chatkit",
    tags=["chatkit"],
    summary="ChatKit 대화 요청 처리",
    description=(
        "ChatKit 프로토콜 요청을 인증된 사용자의 저장 채용 공고 컨텍스트로 처리합니다. "
        "요청은 ChatKit SDK가 정의한 JSON 형식이어야 하며, 응답은 처리 유형에 따라 "
        "Server-Sent Events 스트림 또는 JSON으로 반환됩니다."
    ),
    operation_id="process_chatkit_request",
    dependencies=[rate_limit(30, per="minute"), quota(500, per="day")],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "additionalProperties": True,
                        "description": "OpenAI ChatKit 프로토콜 요청 payload",
                    }
                }
            },
        }
    },
    responses={
        status.HTTP_200_OK: {
            "description": "ChatKit 처리 결과. streaming 요청은 SSE, 그 외 요청은 JSON입니다.",
            "content": {
                "text/event-stream": {
                    "schema": {"type": "string"},
                },
                "application/json": {
                    "schema": {"type": "object"},
                },
            },
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ProblemDetail,
            "description": "ChatKit 요청 형식이 올바르지 않습니다.",
        },
        status.HTTP_401_UNAUTHORIZED: AUTHENTICATION_ERROR_RESPONSE,
        status.HTTP_404_NOT_FOUND: NOT_FOUND_ERROR_RESPONSE,
        status.HTTP_409_CONFLICT: CONFLICT_ERROR_RESPONSE,
        status.HTTP_413_CONTENT_TOO_LARGE: PAYLOAD_TOO_LARGE_ERROR_RESPONSE,
    },
)
async def chatkit_endpoint(request: Request, current_user: _CurrentUser) -> Response:
    server = request.app.state.chatkit_server
    context = ChatKitRequestContext(
        user_id=current_user["id"],
        pool=request.app.state.pool,
        request_id=get_request_id(),
        locale=request.headers.get("accept-language"),
    )

    # Raw body is forwarded verbatim to the SDK and never logged.
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > _MAX_CHATKIT_BODY_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="요청 본문이 허용된 최대 크기를 초과했습니다.",
            )
        chunks.append(chunk)
    raw_body = b"".join(chunks)

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
    except psycopg.errors.UniqueViolation as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        ) from exc

    if isinstance(result, StreamingResult):
        return StreamingResponse(result, media_type="text/event-stream")
    return Response(content=result.json, media_type="application/json")
