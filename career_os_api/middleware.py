import logging
import uuid
from contextvars import ContextVar
from typing import Any

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

from career_os_api.constants import API_V1

_request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def get_request_id() -> str:
    return _request_id_var.get()


class RequestIdFilter(logging.Filter):
    """Injects the current request_id into every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()  # type: ignore[attr-defined]
        return True


def _request_is_https(scope: Scope) -> bool:
    if scope.get("scheme") == "https":
        return True
    for name, value in scope.get("headers", []):
        if name == b"x-forwarded-proto":
            return value.decode().lower().split(",", 1)[0].strip() == "https"
    return False


def _is_interactive_docs(path: str) -> bool:
    return (
        path
        in {
            f"/{API_V1}/docs",
            f"/{API_V1}/redoc",
            f"/{API_V1}/openapi.json",
        }
        or path.startswith(f"/{API_V1}/docs/")
        or path.startswith(f"/{API_V1}/redoc/")
    )


def _is_auth_navigation(path: str) -> bool:
    return path.startswith(f"/{API_V1}/auth/")


def build_security_headers(path: str, *, is_https: bool) -> list[tuple[str, str]]:
    """Return response headers safe for this API's cross-origin SPA clients.

    Frontend (e.g. https://career-os-sigma.vercel.app) talks to this backend
    with ``credentials: 'include'`` and ``X-Career-OS-Client: web``. OAuth uses
    full-page redirects through ``/v1/auth/google`` → Google →
    ``/v1/auth/google/callback`` → the SPA ``/auth/callback``.

    Do not emit CORP / COEP / COOP / CSP here — they can break credentialed
    fetch and ChatKit SSE from a separate origin.
    """
    headers: list[tuple[str, str]] = [("X-Content-Type-Options", "nosniff")]

    if _is_interactive_docs(path):
        headers.append(("X-Frame-Options", "SAMEORIGIN"))
    elif _is_auth_navigation(path):
        # Top-level OAuth navigations — avoid leaking callback query state.
        headers.append(("Referrer-Policy", "no-referrer"))

    if is_https:
        headers.append(("Strict-Transport-Security", "max-age=31536000"))

    return headers


class SecurityHeadersMiddleware:
    """Attach minimal, cross-origin-safe security headers per request path."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "/")
        response_headers = build_security_headers(
            path,
            is_https=_request_is_https(scope),
        )

        async def _send(message: Any) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in response_headers:
                    if name.lower() not in headers:
                        headers.append(name, value)
            await send(message)

        await self.app(scope, receive, _send)


class PartitionedSessionCookieMiddleware:
    """Appends the `Partitioned` attribute (CHIPS) to the session cookie.

    The frontend SPA and this API sit on different registrable domains, so
    the session cookie set by `SessionMiddleware` is a third-party cookie
    from the browser's perspective even with `SameSite=None`. Chrome's
    third-party cookie deprecation blocks it outside a brief post-OAuth-
    redirect grace window, so `/auth/me` starts 401ing within seconds of a
    successful login on mobile Chrome. `Partitioned` opts the cookie into
    CHIPS, which is exempt from that blocking. `SessionMiddleware` has no
    option to set this attribute itself, so it is appended here after the
    cookie is written. Must be added after `SessionMiddleware` (add_middleware
    order) so this layer observes the response after it sets `Set-Cookie`.
    """

    def __init__(self, app: ASGIApp, session_cookie: str = "session") -> None:
        self.app = app
        self._cookie_prefix = f"{session_cookie}=".encode("latin-1")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        async def _send(message: Any) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                raw = headers.raw
                for idx, (name, value) in enumerate(raw):
                    if (
                        name == b"set-cookie"
                        and value.startswith(self._cookie_prefix)
                        and b"partitioned" not in value.lower()
                    ):
                        raw[idx] = (name, value + b"; Partitioned")
            await send(message)

        await self.app(scope, receive, _send)


class RequestIdMiddleware:
    """Pure-ASGI middleware that stamps each HTTP request with a UUID.

    Sets the ContextVar so all log calls within the request scope include the id,
    and appends X-Request-ID to the response headers for client correlation.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid7())
        token = _request_id_var.set(request_id)

        async def _send(message: Any) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append("x-request-id", request_id)
            await send(message)

        try:
            await self.app(scope, receive, _send)
        finally:
            _request_id_var.reset(token)
