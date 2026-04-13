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

_INSERT_SQL = """
INSERT INTO users (google_id, email, name, picture)
VALUES (%s, %s, %s, %s)
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


async def create_user(
    conn: AsyncConnection,
    google_id: str,
    email: str,
    name: str | None,
    picture: str | None,
) -> UserRow:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_INSERT_SQL, (google_id, email, name, picture))
        row = await cur.fetchone()
    assert row is not None
    return row  # type: ignore[return-value]
