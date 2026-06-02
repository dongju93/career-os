from __future__ import annotations

from typing import Any, Protocol

import httpx2


class AsyncHttpClient(Protocol):
    """Structural interface for an async HTTP client.

    Satisfied by `httpx2.AsyncClient` in production and by test doubles such as
    `SequenceAsyncClient`.  Only the methods actually called by service code are
    declared; callers must not rely on any other `httpx2.AsyncClient` behaviour.
    """

    async def get(self, url: str, **kwargs: Any) -> httpx2.Response: ...

    def stream(self, method: str, url: str, **kwargs: Any) -> Any: ...
