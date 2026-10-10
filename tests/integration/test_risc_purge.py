"""Opt-in tests against an isolated schema in a disposable PostgreSQL database."""

import asyncio
import os
from hashlib import sha256
from uuid import uuid4

import pytest
from psycopg import AsyncConnection, sql

from career_os_api.auth.risc import (
    EVENT_ACCOUNT_ENABLED,
    EVENT_ACCOUNT_PURGED,
    RiscEvent,
)
from career_os_api.auth.risc_handlers import apply_risc_event
from career_os_api.database.ddl import _apply_schema
from career_os_api.database.job_search_groups import create_initial_group
from career_os_api.database.risc_events import delete_expired_risc_events
from career_os_api.database.users import GoogleSubjectPurgedError, upsert_user

_SUBJECT = "purged-google-subject"


@pytest.fixture
async def connections():
    dsn = os.environ.get("CAREER_OS_TEST_POSTGRES_DSN")
    if not dsn:
        pytest.skip(
            "Set CAREER_OS_TEST_POSTGRES_DSN to a disposable PostgreSQL database"
        )
    schema = f"purge_test_{uuid4().hex}"
    async with await AsyncConnection.connect(dsn, autocommit=True) as admin:
        await admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        try:
            options = f"-c search_path={schema} -c statement_timeout=5000"
            async with (
                await AsyncConnection.connect(
                    dsn, autocommit=True, options=options
                ) as first,
                await AsyncConnection.connect(
                    dsn, autocommit=True, options=options
                ) as second,
            ):
                await _apply_schema(first)
                yield first, second, admin
        finally:
            await admin.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
            )


def _event(event_type=EVENT_ACCOUNT_PURGED, *, jti="purge", subject=_SUBJECT):
    return RiscEvent(
        jti=jti,
        event_type=event_type,
        google_id=subject,
        issued_at=1_700_000_000,
        reason=None,
        state=None,
    )


async def _callback(conn, subject=_SUBJECT):
    async with conn.transaction():
        user = await upsert_user(conn, subject, "x@example.com", None, None)
        await create_initial_group(conn, user["id"])
        return user


async def _wait_for_subject_lock(observer, blocked):
    async with asyncio.timeout(5):
        while True:
            cur = await observer.execute(
                "SELECT 1 FROM pg_locks WHERE pid = %s "
                "AND locktype = 'advisory' AND NOT granted",
                (blocked.info.backend_pid,),
            )
            if await cur.fetchone():
                return
            await asyncio.sleep(0.01)


@pytest.mark.parametrize("existing_user", [False, True])
@pytest.mark.parametrize("purge_first", [False, True])
async def test_purge_and_callback_serialize_in_both_orders(
    connections, existing_user, purge_first
):
    first, second, observer = connections
    if existing_user:
        await _callback(first)

    async def competing_operation():
        if purge_first:
            with pytest.raises(GoogleSubjectPurgedError):
                await _callback(second)
        else:
            await apply_risc_event(second, _event())

    async with asyncio.TaskGroup() as tasks:
        async with first.transaction():
            if purge_first:
                await apply_risc_event(first, _event())
            else:
                await _callback(first)
            tasks.create_task(competing_operation())
            # Verify real database contention before committing the winner.
            await _wait_for_subject_lock(observer, second)

    cur = await first.execute("SELECT count(*) FROM users")
    assert await cur.fetchone() == (0,)
    cur = await first.execute("SELECT count(*) FROM job_search_groups")
    assert await cur.fetchone() == (0,)
    with pytest.raises(GoogleSubjectPurgedError):
        await _callback(first)


async def test_tombstone_survives_retention_enable_and_duplicate_purge(connections):
    first, _, _ = connections
    await _callback(first)
    await apply_risc_event(first, _event())
    await apply_risc_event(first, _event())
    await apply_risc_event(first, _event(EVENT_ACCOUNT_ENABLED, jti="enable"))
    await first.execute(
        "UPDATE risc_events SET received_at = NOW() - INTERVAL '100 days'"
    )
    await delete_expired_risc_events(first, retention_days=90)

    cur = await first.execute("SELECT count(*) FROM risc_events")
    assert await cur.fetchone() == (0,)
    cur = await first.execute("SELECT subject_hash FROM purged_google_subjects")
    assert await cur.fetchall() == [(sha256(_SUBJECT.encode()).hexdigest(),)]
    with pytest.raises(GoogleSubjectPurgedError):
        await _callback(first)
    # Another subject can still sign in, and repeated sign-in keeps its user ID.
    user = await _callback(first, "unrelated-subject")
    updated = await upsert_user(
        first, "unrelated-subject", "new@example.com", "New", None
    )
    assert updated["id"] == user["id"]
    assert updated["email"] == "new@example.com"


async def test_failed_purge_rolls_back_marker_and_erasure(connections):
    first, _, _ = connections
    user = await _callback(first)
    with pytest.raises(RuntimeError, match="abort purge"):
        async with first.transaction():
            await apply_risc_event(first, _event())
            raise RuntimeError("abort purge")

    cur = await first.execute("SELECT count(*) FROM purged_google_subjects")
    assert await cur.fetchone() == (0,)
    cur = await first.execute("SELECT count(*) FROM risc_events")
    assert await cur.fetchone() == (0,)
    updated = await upsert_user(first, _SUBJECT, "x@example.com", None, None)
    assert updated["id"] == user["id"]
