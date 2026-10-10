from psycopg import AsyncConnection

# Only the claims the handler acts on are stored. The raw SET is not kept: it
# carries token prefixes and stream metadata that have no use after
# verification but would be exposed by a DB or backup compromise (M-07).
_INSERT_SQL = """
INSERT INTO risc_events (jti, event_type, google_id, reason, issued_at)
VALUES (%s, %s, %s, %s, to_timestamp(%s))
ON CONFLICT (jti) DO NOTHING
RETURNING id
"""

_ANONYMIZE_BY_GOOGLE_ID_SQL = """
UPDATE risc_events
SET google_id = NULL
WHERE google_id = %s
"""

_DELETE_EXPIRED_SQL = """
DELETE FROM risc_events
WHERE received_at < NOW() - make_interval(days => %s)
"""


async def record_risc_event(
    conn: AsyncConnection,
    *,
    jti: str,
    event_type: str,
    google_id: str | None,
    reason: str | None,
    issued_at: int,
) -> bool:
    """Persist a verified RISC event. Returns False if jti was already stored."""
    async with conn.cursor() as cur:
        await cur.execute(_INSERT_SQL, (jti, event_type, google_id, reason, issued_at))
        row = await cur.fetchone()
    return row is not None


async def anonymize_risc_events_by_google_id(
    conn: AsyncConnection, google_id: str
) -> None:
    """Unlink a purged account's audit rows while keeping their `jti` for dedupe."""
    async with conn.cursor() as cur:
        await cur.execute(_ANONYMIZE_BY_GOOGLE_ID_SQL, (google_id,))


async def delete_expired_risc_events(
    conn: AsyncConnection, *, retention_days: int
) -> None:
    """Delete audit rows received more than `retention_days` ago.

    Dropping a row also forgets its `jti`, so retention must outlast Google's
    redelivery window; a replay past it is still bounded because account-state
    events are `iat`-guarded and session revocation is idempotent.
    """
    async with conn.cursor() as cur:
        await cur.execute(_DELETE_EXPIRED_SQL, (retention_days,))
