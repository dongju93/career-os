from datetime import datetime
from typing import TypedDict, cast
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from career_os_api.schemas import UserProfileUpsertRequest


class UserProfileRow(TypedDict):
    user_id: UUID
    headline: str | None
    years_experience: int | None
    target_roles: list[str] | None
    skills: list[str] | None
    locations: list[str] | None
    salary_expectation: str | None
    summary: str | None
    created_at: datetime
    updated_at: datetime


class UserProfileUpsertRow(UserProfileRow):
    # (xmax = 0) flags a freshly inserted tuple, driving 201-vs-200 in the route.
    inserted: bool


_GET_SQL = """
SELECT
    user_id, headline, years_experience, target_roles, skills,
    locations, salary_expectation, summary, created_at, updated_at
FROM user_profiles
WHERE user_id = %s
"""

# Full-replace upsert: omitted (None) fields overwrite stored values, matching
# the PUT contract. xmax = 0 distinguishes the initial insert from a replace.
_UPSERT_SQL = """
INSERT INTO user_profiles (
    user_id, headline, years_experience, target_roles, skills,
    locations, salary_expectation, summary
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (user_id) DO UPDATE SET
    headline           = EXCLUDED.headline,
    years_experience   = EXCLUDED.years_experience,
    target_roles       = EXCLUDED.target_roles,
    skills             = EXCLUDED.skills,
    locations          = EXCLUDED.locations,
    salary_expectation = EXCLUDED.salary_expectation,
    summary            = EXCLUDED.summary,
    updated_at         = NOW()
RETURNING
    user_id, headline, years_experience, target_roles, skills,
    locations, salary_expectation, summary, created_at, updated_at,
    (xmax = 0) AS inserted
"""


async def get_user_profile(
    conn: AsyncConnection, *, user_id: UUID
) -> UserProfileRow | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_GET_SQL, (user_id,))
        return cast("UserProfileRow | None", await cur.fetchone())


async def upsert_user_profile(
    conn: AsyncConnection,
    *,
    user_id: UUID,
    data: UserProfileUpsertRequest,
) -> UserProfileUpsertRow:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            _UPSERT_SQL,
            (
                user_id,
                data.headline,
                data.years_experience,
                data.target_roles,
                data.skills,
                data.locations,
                data.salary_expectation,
                data.summary,
            ),
        )
        row = await cur.fetchone()
    assert row is not None  # RETURNING always yields a row on successful upsert
    return cast(UserProfileUpsertRow, row)
