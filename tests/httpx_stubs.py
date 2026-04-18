from collections.abc import Sequence
from typing import Any

import httpx


def make_response(
    url: str,
    *,
    status_code: int = 200,
    content: bytes = b"",
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    request = httpx.Request("GET", url)
    return httpx.Response(
        status_code=status_code,
        content=content,
        headers=headers,
        request=request,
    )


def make_http_status_error(url: str, status_code: int) -> httpx.HTTPStatusError:
    response = make_response(url, status_code=status_code)
    return httpx.HTTPStatusError(
        f"HTTP {status_code}",
        request=response.request,
        response=response,
    )


class SequenceAsyncClient:
    def __init__(self, outcomes: Sequence[httpx.Response | Exception]) -> None:
        self._outcomes = list(outcomes)
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def __aenter__(self) -> SequenceAsyncClient:
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        return None

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append((url, kwargs))

        if not self._outcomes:
            raise AssertionError("No more stubbed responses are available")

        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome
