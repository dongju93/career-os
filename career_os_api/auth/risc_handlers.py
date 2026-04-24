"""Apply verified Google RISC events to local database state."""

import logging

from psycopg import AsyncConnection

from career_os_api.auth.risc import (
    EVENT_ACCOUNT_DISABLED,
    EVENT_ACCOUNT_ENABLED,
    EVENT_ACCOUNT_PURGED,
    EVENT_CREDENTIAL_CHANGE_REQUIRED,
    EVENT_SESSIONS_REVOKED,
    EVENT_TOKEN_REVOKED,
    EVENT_TOKENS_REVOKED,
    EVENT_VERIFICATION,
    RiscEvent,
)
from career_os_api.database.risc_events import record_risc_event
from career_os_api.database.users import (
    revoke_user_sessions_by_google_id,
    set_user_active_by_google_id,
)

logger = logging.getLogger(__name__)

_DEACTIVATING_EVENTS = frozenset(
    {
        EVENT_ACCOUNT_DISABLED,
        EVENT_ACCOUNT_PURGED,
    }
)

_SESSION_REVOKING_EVENTS = frozenset(
    {
        # credential-change-required signals that credentials changed (e.g. password
        # reset); existing sessions must be invalidated but the account stays active.
        EVENT_CREDENTIAL_CHANGE_REQUIRED,
        EVENT_SESSIONS_REVOKED,
        EVENT_TOKENS_REVOKED,
    }
)

_AUDIT_ONLY_EVENTS = frozenset({EVENT_TOKEN_REVOKED})


async def apply_risc_event(conn: AsyncConnection, event: RiscEvent) -> None:
    """Persist the event and apply user state changes.

    Duplicate `jti` values are silently ignored per the RISC spec: receivers
    must be idempotent because Google retries undelivered events.
    """
    inserted = await record_risc_event(
        conn,
        jti=event.jti,
        event_type=event.event_type,
        google_id=event.google_id,
        reason=event.reason,
        issued_at=event.issued_at,
        payload=event.raw_payload,
    )

    if not inserted:
        logger.info("Ignoring duplicate RISC event jti=%s", event.jti)
        return

    if event.event_type == EVENT_VERIFICATION:
        logger.info("RISC verification received state=%s", event.state)
        return

    if event.event_type in _AUDIT_ONLY_EVENTS:
        # The app does not store Google OAuth refresh tokens, so individual
        # token revocations are recorded for audit only.
        logger.info(
            "RISC %s recorded for google_id=%s (audit-only)",
            event.event_type,
            event.google_id,
        )
        return

    if event.google_id is None:
        logger.warning(
            "RISC %s has no subject.sub; audit row stored, no user mutation",
            event.event_type,
        )
        return

    if event.event_type in _DEACTIVATING_EVENTS:
        updated = await set_user_active_by_google_id(
            conn, event.google_id, is_active=False
        )
        logger.info(
            "RISC %s deactivated google_id=%s matched=%s",
            event.event_type,
            event.google_id,
            updated is not None,
        )
        return

    if event.event_type in _SESSION_REVOKING_EVENTS:
        updated = await revoke_user_sessions_by_google_id(conn, event.google_id)
        logger.info(
            "RISC %s revoked sessions for google_id=%s matched=%s",
            event.event_type,
            event.google_id,
            updated is not None,
        )
        return

    if event.event_type == EVENT_ACCOUNT_ENABLED:
        updated = await set_user_active_by_google_id(
            conn, event.google_id, is_active=True
        )
        logger.info(
            "RISC %s reactivated google_id=%s matched=%s",
            event.event_type,
            event.google_id,
            updated is not None,
        )
        return

    logger.warning("Unhandled RISC event_type=%s", event.event_type)
