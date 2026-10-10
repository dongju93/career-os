"""Apply verified Google RISC events to local database state."""

import logging
from datetime import UTC, datetime

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
from career_os_api.config import settings
from career_os_api.database.risc_events import (
    anonymize_risc_events_by_google_id,
    delete_expired_risc_events,
    record_risc_event,
)
from career_os_api.database.users import (
    RiscAccountState,
    RiscAccountStateRow,
    delete_user_by_google_id,
    lock_user_risc_account_state_by_google_id,
    revoke_user_sessions_by_google_id,
    set_user_risc_account_state_by_google_id,
)

logger = logging.getLogger(__name__)

_ACCOUNT_STATE_EVENTS: dict[str, RiscAccountState] = {
    EVENT_ACCOUNT_DISABLED: RiscAccountState.DISABLED,
    EVENT_ACCOUNT_ENABLED: RiscAccountState.ENABLED,
}

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


def _supersedes_account_state(
    current: RiscAccountStateRow, new_state: RiscAccountState, issued_at: datetime
) -> bool:
    """Decide whether an account-state event may overwrite the stored state.

    Google may deliver events late or out of order, so the stored state only
    moves forward by `iat`. An `iat` tie goes to `disabled` so ambiguity fails
    closed. Purge is not a state here: `_purge_account` deletes the user, so
    later events for that `google_id` find no row and change nothing.

    A disabled account comes back only through a newer `account-enabled`
    event. If that event is lost (Google retries failed deliveries, so this
    is rare), the user stays locked out even though their Google account is
    fine. Recover that one user manually, setting both state columns together
    to satisfy `chk_users_risc_account_state_pair`:

        UPDATE users
        SET is_active = TRUE,
            risc_account_state = 'enabled',
            risc_account_state_at = NOW(),
            updated_at = NOW()
        WHERE id = '<user_id>';
    """
    current_at = current["risc_account_state_at"]
    if current_at is None:
        return True
    if new_state is RiscAccountState.DISABLED:
        return issued_at >= current_at
    return issued_at > current_at


async def _apply_account_state_event(
    conn: AsyncConnection,
    event: RiscEvent,
    google_id: str,
    new_state: RiscAccountState,
) -> None:
    current = await lock_user_risc_account_state_by_google_id(conn, google_id)
    if current is None:
        logger.info(
            "RISC %s for unknown google_id=%s; no user mutation",
            event.event_type,
            google_id,
        )
        return

    # Revoke even when the event turns out to be stale: a late disable still
    # proves credentials minted before it must die, and revoking on enable
    # keeps any pre-disable token from coming back with the account.
    await revoke_user_sessions_by_google_id(conn, google_id)

    issued_at = datetime.fromtimestamp(event.issued_at, UTC)
    if not _supersedes_account_state(current, new_state, issued_at):
        logger.warning(
            "Ignoring stale RISC %s for google_id=%s (stored state=%s at=%s)",
            event.event_type,
            google_id,
            current["risc_account_state"],
            current["risc_account_state_at"],
        )
        return

    await set_user_risc_account_state_by_google_id(
        conn, google_id, state=new_state, issued_at=issued_at
    )
    logger.info(
        "RISC %s set google_id=%s to state=%s",
        event.event_type,
        google_id,
        new_state,
    )


async def _purge_account(conn: AsyncConnection, google_id: str) -> None:
    """Erase local data for an account Google has permanently deleted.

    Google never reissues a purged `sub`, so nothing can sign in as this user
    again; keeping their profile, postings, and chat history would only extend
    exposure. The audit rows stay, unlinked from the account, so `jti` dedupe
    and event counts survive until retention removes them.
    """
    deleted = await delete_user_by_google_id(conn, google_id)
    await anonymize_risc_events_by_google_id(conn, google_id)
    logger.info("RISC account-purged erased local account (matched=%s)", deleted)


async def apply_risc_event(conn: AsyncConnection, event: RiscEvent) -> None:
    """Persist the event and apply user state changes atomically.

    Duplicate `jti` values are silently ignored per the RISC spec: receivers
    must be idempotent because Google retries undelivered events. The event
    row and the user mutation share one transaction so a failed mutation also
    rolls back the `jti`, letting a retry apply it instead of skipping it as a
    duplicate.

    Expired audit rows are swept in the same transaction. RISC traffic is
    sparse, so `main.py` also sweeps once at startup.
    """
    async with conn.transaction():
        await delete_expired_risc_events(
            conn, retention_days=settings.risc_event_retention_days
        )
        await _dispatch_risc_event(conn, event)


async def _dispatch_risc_event(conn: AsyncConnection, event: RiscEvent) -> None:
    inserted = await record_risc_event(
        conn,
        jti=event.jti,
        event_type=event.event_type,
        google_id=event.google_id,
        reason=event.reason,
        issued_at=event.issued_at,
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

    if event.event_type == EVENT_ACCOUNT_PURGED:
        await _purge_account(conn, event.google_id)
        return

    new_state = _ACCOUNT_STATE_EVENTS.get(event.event_type)
    if new_state is not None:
        await _apply_account_state_event(conn, event, event.google_id, new_state)
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

    logger.warning("Unhandled RISC event_type=%s", event.event_type)
