from typing import TypedDict
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row


class UserRow(TypedDict):
    id: UUID
    google_id: str
    email: str
    name: str | None
    picture: str | None
    is_active: bool


_FIND_BY_GOOGLE_ID_SQL = """
SELECT id, google_id, email, name, picture, is_active
FROM users
WHERE google_id = %s
"""

_FIND_BY_ID_SQL = """
SELECT id, google_id, email, name, picture, is_active
FROM users
WHERE id = %s
"""

_UPSERT_SQL = """
INSERT INTO users (google_id, email, name, picture)
VALUES (%s, %s, %s, %s)
ON CONFLICT (google_id) DO UPDATE
    SET email   = EXCLUDED.email,
        name    = EXCLUDED.name,
        picture = EXCLUDED.picture
RETURNING id, google_id, email, name, picture, is_active
"""

_UPDATE_NAME_SQL = """
UPDATE users
SET name = %s, updated_at = NOW()
WHERE id = %s
RETURNING id, google_id, email, name, picture, is_active
"""

_SET_ACTIVE_BY_GOOGLE_ID_SQL = """
UPDATE users
SET is_active = %s, updated_at = NOW()
WHERE google_id = %s
RETURNING id, google_id, email, name, picture, is_active
"""


async def find_user_by_google_id(
    conn: AsyncConnection, google_id: str
) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_FIND_BY_GOOGLE_ID_SQL, (google_id,))
        return await cur.fetchone()  # type: ignore[return-value]


async def find_user_by_id(conn: AsyncConnection, user_id: UUID) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_FIND_BY_ID_SQL, (user_id,))
        return await cur.fetchone()  # type: ignore[return-value]


async def update_user_name(
    conn: AsyncConnection, user_id: UUID, name: str
) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_UPDATE_NAME_SQL, (name, user_id))
        return await cur.fetchone()  # type: ignore[return-value]


async def upsert_user(
    conn: AsyncConnection,
    google_id: str,
    email: str,
    name: str | None,
    picture: str | None,
) -> UserRow:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_UPSERT_SQL, (google_id, email, name, picture))
        row = await cur.fetchone()
    assert row is not None
    return row  # type: ignore[return-value]


async def set_user_active_by_google_id(
    conn: AsyncConnection, google_id: str, *, is_active: bool
) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_SET_ACTIVE_BY_GOOGLE_ID_SQL, (is_active, google_id))
        return await cur.fetchone()  # type: ignore[return-value]
