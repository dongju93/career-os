from __future__ import annotations

from typing import Any, Protocol

import httpx


class AsyncHttpClient(Protocol):
    """Structural interface for an async HTTP client.

    Satisfied by `httpx.AsyncClient` in production and by test doubles such as
    `SequenceAsyncClient`.  Only the methods actually called by service code are
    declared; callers must not rely on any other `httpx.AsyncClient` behaviour.
    """

    async def get(self, url: str, **kwargs: Any) -> httpx.Response: ...

    def stream(self, method: str, url: str, **kwargs: Any) -> Any: ...
