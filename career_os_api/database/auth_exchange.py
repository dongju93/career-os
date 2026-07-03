import secrets
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row

# Single-use, short-lived code minted at the end of the OAuth callback so the
# frontend can obtain a Bearer token even when the session cookie is dropped
# by cross-site cookie blocking (Safari ITP, Chrome third-party blocking).
# Short TTL + one-time redemption keeps it safe to place in a redirect URL,
# unlike the long-lived JWT itself.
EXCHANGE_CODE_TTL_SECONDS = 60

# Piggybacks an opportunistic cleanup of expired, never-redeemed codes onto
# every login rather than requiring a separate cron job.
_INSERT_SQL = """
WITH cleanup AS (
    DELETE FROM auth_exchange_codes WHERE expires_at < NOW()
)
INSERT INTO auth_exchange_codes (code, user_id, expires_at)
VALUES (%s, %s, NOW() + make_interval(secs => %s))
"""

_REDEEM_SQL = """
DELETE FROM auth_exchange_codes
WHERE code = %s AND expires_at > NOW()
RETURNING user_id
"""


async def create_exchange_code(conn: AsyncConnection, user_id: UUID) -> str:
    code = secrets.token_urlsafe(32)
    async with conn.cursor() as cur:
        await cur.execute(_INSERT_SQL, (code, user_id, EXCHANGE_CODE_TTL_SECONDS))
    return code


async def redeem_exchange_code(conn: AsyncConnection, code: str) -> UUID | None:
    """Consume *code*, returning the associated user id. Redeemable only once."""
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_REDEEM_SQL, (code,))
        row = await cur.fetchone()
    return row["user_id"] if row else None
