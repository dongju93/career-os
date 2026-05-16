import uuid
from datetime import date, datetime
from typing import Literal, TypedDict, cast

from psycopg import AsyncConnection
from psycopg.rows import dict_row


class JobSearchGroupRow(TypedDict):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    started_at: date
    ended_at: date | None
    memo: str | None
    created_at: datetime
    updated_at: datetime


class JobSearchGroupListRow(TypedDict):
    id: uuid.UUID
    name: str
    started_at: date
    ended_at: date | None
    memo: str | None
    posting_count: int
    created_at: datetime
    updated_at: datetime


_INSERT_SQL = """
INSERT INTO job_search_groups (id, user_id, name, started_at, ended_at, memo)
VALUES (%s, %s, %s, %s, %s, %s)
RETURNING id, user_id, name, started_at, ended_at, memo, created_at, updated_at
"""

_GET_SQL = """
SELECT id, user_id, name, started_at, ended_at, memo, created_at, updated_at
FROM job_search_groups
WHERE id = %s
"""

_DELETE_SQL = """
DELETE FROM job_search_groups
WHERE id = %s AND user_id = %s
"""

_COUNT_SQL = """
SELECT COUNT(*) AS total
FROM job_search_groups
WHERE user_id = %s
"""

_CURRENT_GROUP_SQL = """
SELECT id
FROM job_search_groups
WHERE user_id = %s AND ended_at IS NULL
ORDER BY created_at DESC
LIMIT 1
"""

_HAS_ANY_GROUP_SQL = """
SELECT EXISTS(
    SELECT 1 FROM job_search_groups WHERE user_id = %s
) AS has_group
"""

_GROUP_IDS_FOR_UPDATE_SQL = """
SELECT id
FROM job_search_groups
WHERE user_id = %s
FOR UPDATE
"""


_LIST_ACTIVE_SQL = """
SELECT
    g.id, g.name, g.started_at, g.ended_at, g.memo,
    g.created_at, g.updated_at,
    COUNT(p.id) AS posting_count
FROM job_search_groups g
LEFT JOIN job_postings p ON p.group_id = g.id
WHERE g.user_id = %s AND g.ended_at IS NULL
GROUP BY g.id
ORDER BY g.created_at DESC
LIMIT %s OFFSET %s
"""

_LIST_ENDED_SQL = """
SELECT
    g.id, g.name, g.started_at, g.ended_at, g.memo,
    g.created_at, g.updated_at,
    COUNT(p.id) AS posting_count
FROM job_search_groups g
LEFT JOIN job_postings p ON p.group_id = g.id
WHERE g.user_id = %s AND g.ended_at IS NOT NULL
GROUP BY g.id
ORDER BY g.ended_at DESC
LIMIT %s OFFSET %s
"""

_LIST_ALL_SQL = """
SELECT
    g.id, g.name, g.started_at, g.ended_at, g.memo,
    g.created_at, g.updated_at,
    COUNT(p.id) AS posting_count
FROM job_search_groups g
LEFT JOIN job_postings p ON p.group_id = g.id
WHERE g.user_id = %s
GROUP BY g.id
ORDER BY (g.ended_at IS NOT NULL), g.created_at DESC
LIMIT %s OFFSET %s
"""

_COUNT_ACTIVE_SQL = """
SELECT COUNT(*) AS total FROM job_search_groups
WHERE user_id = %s AND ended_at IS NULL
"""

_COUNT_ENDED_SQL = """
SELECT COUNT(*) AS total FROM job_search_groups
WHERE user_id = %s AND ended_at IS NOT NULL
"""

_COUNT_ALL_SQL = """
SELECT COUNT(*) AS total FROM job_search_groups WHERE user_id = %s
"""

_LIST_SQL_MAP = {
    "active": _LIST_ACTIVE_SQL,
    "ended": _LIST_ENDED_SQL,
    None: _LIST_ALL_SQL,
}

_COUNT_SQL_MAP = {
    "active": _COUNT_ACTIVE_SQL,
    "ended": _COUNT_ENDED_SQL,
    None: _COUNT_ALL_SQL,
}


async def create_job_search_group(
    conn: AsyncConnection,
    user_id: uuid.UUID,
    name: str,
    started_at: date,
    ended_at: date | None,
    memo: str | None,
) -> JobSearchGroupRow:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _INSERT_SQL,
            (uuid.uuid7(), user_id, name, started_at, ended_at, memo),
        )
        row = await cur.fetchone()
    assert row is not None
    return cast(JobSearchGroupRow, row)


async def get_job_search_groups(
    conn: AsyncConnection,
    *,
    user_id: uuid.UUID,
    status: Literal["active", "ended"] | None,
    limit: int,
    offset: int,
) -> tuple[list[JobSearchGroupListRow], int]:
    if status == "active":
        list_sql, count_sql = _LIST_ACTIVE_SQL, _COUNT_ACTIVE_SQL
    elif status == "ended":
        list_sql, count_sql = _LIST_ENDED_SQL, _COUNT_ENDED_SQL
    else:
        list_sql, count_sql = _LIST_ALL_SQL, _COUNT_ALL_SQL

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(list_sql, (user_id, limit, offset))
        rows = await cur.fetchall()
        await cur.execute(count_sql, (user_id,))
        count_row = await cur.fetchone()
    assert count_row is not None
    return cast(list[JobSearchGroupListRow], rows), count_row["total"]


async def get_job_search_group(
    conn: AsyncConnection,
    group_id: uuid.UUID,
) -> JobSearchGroupRow | None:
    """Return the group by ID regardless of owner, or None if not found.

    Callers must check row["user_id"] against the authenticated user and
    raise 403 / 404 as appropriate for their endpoint semantics.
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_GET_SQL, (group_id,))
        row = await cur.fetchone()
    return cast("JobSearchGroupRow | None", row)


async def update_job_search_group(
    conn: AsyncConnection,
    group_id: uuid.UUID,
    *,
    user_id: uuid.UUID,
    fields: dict[str, object],
) -> JobSearchGroupRow | None:
    """Update only the fields present in `fields`. Returns None if not found."""
    if not fields:
        return await get_job_search_group(conn, group_id)

    set_clauses = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values())
    sql: str = f"""
UPDATE job_search_groups
SET {set_clauses}, updated_at = NOW()
WHERE id = %s AND user_id = %s
RETURNING id, user_id, name, started_at, ended_at, memo, created_at, updated_at
"""
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, (*values, group_id, user_id))  # type: ignore[arg-type]
        row = await cur.fetchone()
    return cast("JobSearchGroupRow | None", row)


async def delete_job_search_group(
    conn: AsyncConnection,
    group_id: uuid.UUID,
    *,
    user_id: uuid.UUID,
) -> bool:
    """Delete a group owned by user_id. Returns False if not found."""
    async with conn.cursor() as cur:
        await cur.execute(_DELETE_SQL, (group_id, user_id))
        return cur.rowcount > 0


async def get_user_group_ids_for_update(
    conn: AsyncConnection,
    user_id: uuid.UUID,
) -> list[uuid.UUID]:
    """SELECT … FOR UPDATE — locks all group rows for this user within the current transaction."""
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_GROUP_IDS_FOR_UPDATE_SQL, (user_id,))
        rows = await cur.fetchall()
    return [row["id"] for row in rows]


async def get_current_group_id(
    conn: AsyncConnection,
    user_id: uuid.UUID,
) -> uuid.UUID | None:
    """Return the most recently created active group id, or None if none exists."""
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_CURRENT_GROUP_SQL, (user_id,))
        row = await cur.fetchone()
    return row["id"] if row else None


async def has_any_group(
    conn: AsyncConnection,
    user_id: uuid.UUID,
) -> bool:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_HAS_ANY_GROUP_SQL, (user_id,))
        row = await cur.fetchone()
    assert row is not None
    return bool(row["has_group"])


async def create_initial_group(
    conn: AsyncConnection,
    user_id: uuid.UUID,
) -> JobSearchGroupRow:
    return await create_job_search_group(
        conn,
        user_id=user_id,
        name="첫 번째 구직 활동",
        started_at=date.today(),
        ended_at=None,
        memo=None,
    )
