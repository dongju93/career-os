"""Google RISC (Cross-Account Protection) Security Event Token verification.

Google delivers security events about users who signed in via Google as SETs
(Security Event Tokens, RFC 8417) — JWTs signed with Google's OIDC keys.
This module validates the JWT signature and SET-specific claims, and returns
a typed `RiscEvent` for the handler layer to act on.

References:
- https://developers.google.com/identity/protocols/risc
- https://datatracker.ietf.org/doc/html/rfc8417
"""

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
from jose import JWTError, jwt

from career_os_api.config import settings

logger = logging.getLogger(__name__)

# Google RISC event type URIs
EVENT_SESSIONS_REVOKED = (
    "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked"
)
EVENT_TOKENS_REVOKED = (
    "https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked"
)
EVENT_TOKEN_REVOKED = (
    "https://schemas.openid.net/secevent/oauth/event-type/token-revoked"
)
EVENT_ACCOUNT_DISABLED = (
    "https://schemas.openid.net/secevent/risc/event-type/account-disabled"
)
EVENT_ACCOUNT_ENABLED = (
    "https://schemas.openid.net/secevent/risc/event-type/account-enabled"
)
EVENT_ACCOUNT_PURGED = (
    "https://schemas.openid.net/secevent/risc/event-type/account-purged"
)
EVENT_CREDENTIAL_CHANGE_REQUIRED = (
    "https://schemas.openid.net/secevent/risc/event-type/"
    "account-credential-change-required"
)
EVENT_VERIFICATION = "https://schemas.openid.net/secevent/risc/event-type/verification"

SUPPORTED_EVENT_TYPES: frozenset[str] = frozenset(
    {
        EVENT_SESSIONS_REVOKED,
        EVENT_TOKENS_REVOKED,
        EVENT_TOKEN_REVOKED,
        EVENT_ACCOUNT_DISABLED,
        EVENT_ACCOUNT_ENABLED,
        EVENT_ACCOUNT_PURGED,
        EVENT_CREDENTIAL_CHANGE_REQUIRED,
        EVENT_VERIFICATION,
    }
)


class RiscVerificationError(Exception):
    """Raised when a SET JWT cannot be verified or fails claim checks."""


class RiscVerificationUnavailableError(RiscVerificationError):
    """Raised when SET verification cannot complete due to upstream key lookup."""


@dataclass(frozen=True)
class RiscEvent:
    jti: str
    event_type: str
    issued_at: int
    google_id: str | None
    reason: str | None
    state: str | None
    raw_payload: dict[str, Any]


# Module-level JWKS cache. Mutated by `get_jwks`; tests may seed directly.
_jwks_state: dict[str, Any] = {"keys": [], "fetched_at": 0.0}


async def _fetch_jwks() -> list[dict[str, Any]]:
    try:
        async with httpx.AsyncClient(
            timeout=settings.google_risc_http_timeout_seconds
        ) as client:
            response = await client.get(settings.google_risc_jwks_uri)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise RiscVerificationUnavailableError(f"Failed to fetch JWKS: {exc}") from exc
    except ValueError as exc:
        raise RiscVerificationUnavailableError("Malformed JWKS document") from exc
    if not isinstance(data, dict):
        raise RiscVerificationUnavailableError("Malformed JWKS document")
    keys = data.get("keys")
    if not isinstance(keys, list):
        raise RiscVerificationUnavailableError("Malformed JWKS document")
    return keys


async def get_jwks(*, force_refresh: bool = False) -> list[dict[str, Any]]:
    now = time.monotonic()
    fresh = (
        not force_refresh
        and _jwks_state["keys"]
        and now - _jwks_state["fetched_at"]
        <= settings.google_risc_jwks_cache_ttl_seconds
    )
    if not fresh:
        _jwks_state["keys"] = await _fetch_jwks()
        _jwks_state["fetched_at"] = now
    return list(_jwks_state["keys"])


def invalidate_jwks_cache() -> None:
    _jwks_state["keys"] = []
    _jwks_state["fetched_at"] = 0.0


async def _find_signing_key(token: str) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise RiscVerificationError("Malformed JWT header") from exc

    kid = header.get("kid")
    if not isinstance(kid, str) or not kid:
        raise RiscVerificationError("JWT header missing 'kid'")

    keys = await get_jwks()
    for key in keys:
        if key.get("kid") == kid:
            return key

    # Unknown kids can be legitimate after key rotation, but this endpoint is
    # unauthenticated. Only perform an extra refresh when the cached key set is
    # old enough that rotation is plausible.
    cache_age = time.monotonic() - _jwks_state["fetched_at"]
    if cache_age > settings.google_risc_unknown_kid_refresh_cooldown_seconds:
        keys = await get_jwks(force_refresh=True)
        for key in keys:
            if key.get("kid") == kid:
                return key

    raise RiscVerificationError(f"No JWKS key matches kid={kid}")


def _extract_event(payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    events = payload.get("events")
    if not isinstance(events, dict) or len(events) != 1:
        raise RiscVerificationError("Payload must contain exactly one 'events' entry")
    event_type, body = next(iter(events.items()))
    if not isinstance(event_type, str) or not event_type:
        raise RiscVerificationError("Event type must be a non-empty string")
    if not isinstance(body, dict):
        raise RiscVerificationError("Event body must be a JSON object")
    return event_type, body


async def verify_risc_set(token: str, *, now: int | None = None) -> RiscEvent:
    """Verify a SET JWT against Google's JWKS and return the parsed event.

    Raises `RiscVerificationError` on signature, claim, or key lookup failure.
    """
    key = await _find_signing_key(token)

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.risc_audience,
            issuer=settings.google_risc_issuer,
            # SETs don't carry `exp`; skip that check explicitly.
            options={
                "verify_exp": False,
                "verify_at_hash": False,
                "require_aud": True,
            },
        )
    except JWTError as exc:
        raise RiscVerificationError(f"JWT verification failed: {exc}") from exc

    iat = payload.get("iat")
    if not isinstance(iat, int):
        raise RiscVerificationError("Missing or invalid 'iat' claim")

    current = now if now is not None else int(time.time())
    if iat - current > settings.google_risc_max_iat_skew_seconds:
        raise RiscVerificationError("'iat' is too far in the future")

    jti = payload.get("jti")
    if not isinstance(jti, str) or not jti:
        raise RiscVerificationError("Missing or invalid 'jti' claim")

    event_type, body = _extract_event(payload)

    google_id: str | None = None
    subject = body.get("subject")
    if isinstance(subject, dict):
        sub = subject.get("sub")
        if isinstance(sub, str) and sub:
            google_id = sub

    reason_raw = body.get("reason")
    reason = reason_raw if isinstance(reason_raw, str) else None
    state_raw = body.get("state")
    state = state_raw if isinstance(state_raw, str) else None

    return RiscEvent(
        jti=jti,
        event_type=event_type,
        issued_at=iat,
        google_id=google_id,
        reason=reason,
        state=state,
        raw_payload=payload,
    )
