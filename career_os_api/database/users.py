import uuid
from datetime import datetime
from enum import StrEnum
from typing import TypedDict, cast
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
    auth_session_revoked_at: datetime | None


class RiscAccountState(StrEnum):
    """Last Google RISC account-state event applied to a user."""

    ENABLED = "enabled"
    DISABLED = "disabled"
    PURGED = "purged"


class RiscAccountStateRow(TypedDict):
    risc_account_state: str | None
    risc_account_state_at: datetime | None


_FIND_BY_GOOGLE_ID_SQL = """
SELECT id, google_id, email, name, picture, is_active, auth_session_revoked_at
FROM users
WHERE google_id = %s
"""

_FIND_BY_ID_SQL = """
SELECT id, google_id, email, name, picture, is_active, auth_session_revoked_at
FROM users
WHERE id = %s
"""

_UPSERT_SQL = """
INSERT INTO users (id, google_id, email, name, picture)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (google_id) DO UPDATE
    SET email   = EXCLUDED.email,
        name    = EXCLUDED.name,
        picture = EXCLUDED.picture
RETURNING id, google_id, email, name, picture, is_active, auth_session_revoked_at
"""

_UPDATE_NAME_SQL = """
UPDATE users
SET name = %s, updated_at = NOW()
WHERE id = %s
RETURNING id, google_id, email, name, picture, is_active, auth_session_revoked_at
"""

_LOCK_RISC_ACCOUNT_STATE_BY_GOOGLE_ID_SQL = """
SELECT risc_account_state, risc_account_state_at
FROM users
WHERE google_id = %s
FOR UPDATE
"""

_SET_RISC_ACCOUNT_STATE_BY_GOOGLE_ID_SQL = """
UPDATE users
SET is_active = %s,
    risc_account_state = %s,
    risc_account_state_at = %s,
    updated_at = NOW()
WHERE google_id = %s
RETURNING id, google_id, email, name, picture, is_active, auth_session_revoked_at
"""

_REVOKE_SESSIONS_BY_GOOGLE_ID_SQL = """
UPDATE users
SET auth_session_revoked_at = NOW(), updated_at = NOW()
WHERE google_id = %s
RETURNING id, google_id, email, name, picture, is_active, auth_session_revoked_at
"""

_REVOKE_SESSIONS_BY_ID_SQL = """
UPDATE users
SET auth_session_revoked_at = NOW(), updated_at = NOW()
WHERE id = %s
"""


async def find_user_by_google_id(
    conn: AsyncConnection, google_id: str
) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_FIND_BY_GOOGLE_ID_SQL, (google_id,))
        return cast("UserRow | None", await cur.fetchone())


async def find_user_by_id(conn: AsyncConnection, user_id: UUID) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_FIND_BY_ID_SQL, (user_id,))
        return cast("UserRow | None", await cur.fetchone())


async def update_user_name(
    conn: AsyncConnection, user_id: UUID, name: str
) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_UPDATE_NAME_SQL, (name, user_id))
        return cast("UserRow | None", await cur.fetchone())


async def upsert_user(
    conn: AsyncConnection,
    google_id: str,
    email: str,
    name: str | None,
    picture: str | None,
) -> UserRow:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_UPSERT_SQL, (uuid.uuid7(), google_id, email, name, picture))
        row = await cur.fetchone()
    assert row is not None
    return cast(UserRow, row)


async def lock_user_risc_account_state_by_google_id(
    conn: AsyncConnection, google_id: str
) -> RiscAccountStateRow | None:
    """Row-lock the user's RISC account state; must run inside a transaction."""
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_LOCK_RISC_ACCOUNT_STATE_BY_GOOGLE_ID_SQL, (google_id,))
        return cast("RiscAccountStateRow | None", await cur.fetchone())


async def set_user_risc_account_state_by_google_id(
    conn: AsyncConnection,
    google_id: str,
    *,
    state: RiscAccountState,
    issued_at: datetime,
) -> UserRow | None:
    # is_active is derived from the state so the two columns cannot disagree.
    is_active = state is RiscAccountState.ENABLED
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _SET_RISC_ACCOUNT_STATE_BY_GOOGLE_ID_SQL,
            (is_active, state.value, issued_at, google_id),
        )
        return cast("UserRow | None", await cur.fetchone())


async def revoke_user_sessions_by_google_id(
    conn: AsyncConnection, google_id: str
) -> UserRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_REVOKE_SESSIONS_BY_GOOGLE_ID_SQL, (google_id,))
        return cast("UserRow | None", await cur.fetchone())


async def revoke_user_sessions(conn: AsyncConnection, user_id: UUID) -> None:
    """Invalidate every session cookie issued to the user before now.

    Session cookies are stateless signed values, so clearing one client-side
    does not stop a copied cookie; moving the per-user boundary does.
    """
    async with conn.cursor() as cur:
        await cur.execute(_REVOKE_SESSIONS_BY_ID_SQL, (user_id,))
