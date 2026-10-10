import uuid
from datetime import datetime
from enum import StrEnum
from hashlib import sha256
from typing import TypedDict, cast
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row


class GoogleSubjectPurgedError(ValueError):
    """A permanently purged Google subject cannot sign in again."""


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

_LOCK_GOOGLE_SUBJECT_SQL = "SELECT pg_advisory_xact_lock(%s)"

_FIND_PURGED_GOOGLE_SUBJECT_SQL = """
SELECT 1 FROM purged_google_subjects WHERE subject_hash = %s
"""

_RECORD_PURGED_GOOGLE_SUBJECT_SQL = """
INSERT INTO purged_google_subjects (subject_hash) VALUES (%s)
ON CONFLICT (subject_hash) DO NOTHING
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

_DELETE_BY_GOOGLE_ID_SQL = """
DELETE FROM users
WHERE google_id = %s
RETURNING id
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
    async with conn.transaction():
        subject_hash = await _lock_google_subject(conn, google_id)
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_FIND_PURGED_GOOGLE_SUBJECT_SQL, (subject_hash,))
            if await cur.fetchone() is not None:
                raise GoogleSubjectPurgedError
            await cur.execute(
                _UPSERT_SQL, (uuid.uuid7(), google_id, email, name, picture)
            )
            row = await cur.fetchone()
    assert row is not None
    return cast(UserRow, row)


async def _lock_google_subject(conn: AsyncConnection, google_id: str) -> str:
    """Serialize purge and upsert even when no user row exists.

    Call inside a transaction. At READ COMMITTED (the pool default), the
    next statement gets a fresh snapshot after a competing purge commits.
    Keep the lock statement separate from the tombstone lookup/write.
    Hash collisions in the 64-bit lock key only serialize unrelated subjects;
    tombstone matching uses the full SHA-256 digest.
    """
    digest = sha256(google_id.encode("utf-8")).digest()
    async with conn.cursor() as cur:
        await cur.execute(
            _LOCK_GOOGLE_SUBJECT_SQL,
            (int.from_bytes(digest[:8], signed=True),),
        )
    return digest.hex()


async def record_google_subject_purge(conn: AsyncConnection, google_id: str) -> None:
    """Retain a permanent fingerprint, independent of user/audit retention.

    The caller must own the transaction spanning this marker, user deletion,
    and audit anonymization so the subject lock lasts until erasure commits.
    """
    subject_hash = await _lock_google_subject(conn, google_id)
    async with conn.cursor() as cur:
        await cur.execute(_RECORD_PURGED_GOOGLE_SUBJECT_SQL, (subject_hash,))


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


async def delete_user_by_google_id(conn: AsyncConnection, google_id: str) -> bool:
    """Delete the user and, via ON DELETE CASCADE, every row they own.

    Profile, job search groups, postings, and ChatKit threads/items all
    reference `users(id)` with ON DELETE CASCADE, so this one statement is the
    complete account erasure. Returns False when no user matched.
    """
    async with conn.cursor() as cur:
        await cur.execute(_DELETE_BY_GOOGLE_ID_SQL, (google_id,))
        return await cur.fetchone() is not None


async def revoke_user_sessions(conn: AsyncConnection, user_id: UUID) -> None:
    """Invalidate every session cookie issued to the user before now.

    Session cookies are stateless signed values, so clearing one client-side
    does not stop a copied cookie; moving the per-user boundary does.
    """
    async with conn.cursor() as cur:
        await cur.execute(_REVOKE_SESSIONS_BY_ID_SQL, (user_id,))
