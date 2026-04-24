import json
from typing import Any

from psycopg import AsyncConnection

_INSERT_SQL = """
INSERT INTO risc_events (jti, event_type, google_id, reason, issued_at, payload)
VALUES (%s, %s, %s, %s, to_timestamp(%s), %s::jsonb)
ON CONFLICT (jti) DO NOTHING
RETURNING id
"""


async def record_risc_event(
    conn: AsyncConnection,
    *,
    jti: str,
    event_type: str,
    google_id: str | None,
    reason: str | None,
    issued_at: int,
    payload: dict[str, Any],
) -> bool:
    """Persist a verified RISC event. Returns False if jti was already stored."""
    async with conn.cursor() as cur:
        await cur.execute(
            _INSERT_SQL,
            (
                jti,
                event_type,
                google_id,
                reason,
                issued_at,
                json.dumps(payload, ensure_ascii=False),
            ),
        )
        row = await cur.fetchone()
    return row is not None
