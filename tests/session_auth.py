"""Forge app session cookies for API tests.

The HttpOnly session cookie (plus the ``X-Career-OS-Client: web`` header) is the
only credential ``get_current_user`` accepts, so API tests authenticate by
building the exact cookie Starlette's ``SessionMiddleware`` would issue.
"""

import base64
import json
import time
from uuid import UUID

import itsdangerous

from career_os_api.config import settings

SESSION_COOKIE_NAME = "session"
SESSION_CLIENT_HEADERS = {"X-Career-OS-Client": "web"}


def forge_session_cookie(user_id: UUID, *, issued_at: int | None = None) -> str:
    """Return a signed cookie value in the same format SessionMiddleware issues."""
    payload = {
        "user_id": str(user_id),
        "issued_at": int(time.time()) if issued_at is None else issued_at,
    }
    data = base64.b64encode(json.dumps(payload).encode())
    return itsdangerous.TimestampSigner(settings.secret_key).sign(data).decode()


def make_session_auth_headers(user_id: UUID) -> dict[str, str]:
    """Per-request headers that authenticate as ``user_id`` via the session path."""
    return {
        "Cookie": f"{SESSION_COOKIE_NAME}={forge_session_cookie(user_id)}",
        **SESSION_CLIENT_HEADERS,
    }
