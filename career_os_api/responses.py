from enum import StrEnum
from typing import Any

from fastapi.responses import JSONResponse


class ApiErrorCode(StrEnum):
    DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"


def api_response(*, status_code: int, **payload: Any) -> JSONResponse:
    return JSONResponse(content=payload, status_code=status_code)


def api_error_response(
    *,
    status_code: int,
    code: ApiErrorCode,
    message: str,
) -> JSONResponse:
    return api_response(status_code=status_code, code=code.value, message=message)
