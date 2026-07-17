import json
from collections.abc import Sequence
from http import HTTPStatus
from typing import Any

from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ApiResponse[T](BaseModel):
    status: int
    message: str
    data: T | None = None


class ProblemDetail(BaseModel):
    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: str | None = None


class ValidationProblemDetail(ProblemDetail):
    errors: list[dict[str, Any]]


# Reusable OpenAPI response metadata. Runtime errors are rendered by the exception
# handlers below as RFC 7807 problem details, so the schemas exposed in Swagger must
# describe that envelope instead of FastAPI's default error shape.
AUTHENTICATION_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "인증 정보가 없거나 유효하지 않습니다.",
}
BAD_REQUEST_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "요청을 처리할 수 없습니다.",
}
FORBIDDEN_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "요청한 리소스에 접근할 권한이 없습니다.",
}
NOT_FOUND_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "요청한 리소스를 찾을 수 없습니다.",
}
CONFLICT_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "현재 리소스 상태와 충돌합니다.",
}
PAYLOAD_TOO_LARGE_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "요청 본문이 허용된 최대 크기를 초과했습니다.",
}
UNSUPPORTED_MEDIA_TYPE_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "지원하지 않는 Content-Type입니다.",
}
UPSTREAM_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "외부 서비스 처리에 실패했습니다.",
}
SERVICE_UNAVAILABLE_ERROR_RESPONSE = {
    "model": ProblemDetail,
    "description": "서비스를 일시적으로 사용할 수 없습니다.",
}
VALIDATION_ERROR_RESPONSE = {
    "model": ValidationProblemDetail,
    "description": "요청 경로, 쿼리, 헤더 또는 본문 검증에 실패했습니다.",
}


def api_error_response(
    *,
    status_code: int,
    detail: str,
    instance: str | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    try:
        title = HTTPStatus(status_code).phrase
    except ValueError:
        title = "Error"
    body = ProblemDetail(
        title=title,
        status=status_code,
        detail=detail,
        instance=instance,
    )
    return JSONResponse(
        content=body.model_dump(exclude_none=True),
        status_code=status_code,
        media_type="application/problem+json",
        headers=headers,
    )


def api_validation_error_response(
    *,
    errors: Sequence[Any],
    instance: str | None = None,
) -> JSONResponse:
    # Pydantic v2 may include live Exception instances in ctx["error"].
    # Round-trip through JSON with str() fallback to get a fully serializable list.
    safe_errors = json.loads(json.dumps(errors, default=str))
    body = ValidationProblemDetail(
        title="Unprocessable Entity",
        status=422,
        detail="Request validation failed",
        instance=instance,
        errors=safe_errors,
    )
    return JSONResponse(
        content=body.model_dump(exclude_none=True),
        status_code=422,
        media_type="application/problem+json",
    )
