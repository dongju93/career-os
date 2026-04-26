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


def api_error_response(
    *,
    status_code: int,
    detail: str,
    instance: str | None = None,
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
