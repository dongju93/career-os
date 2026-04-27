from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from psycopg import InterfaceError, OperationalError
from psycopg_pool import PoolTimeout

from career_os_api.database.retry import (
    DATABASE_RETRY_ATTEMPTS,
    DatabaseUnavailableError,
    run_database_operation,
)


def _make_pool(side_effects: list):
    """Return a mock pool whose connection() context manager raises each side_effect in order."""
    pool = MagicMock()
    call_iter = iter(side_effects)

    @asynccontextmanager
    async def _connection():
        exc = next(call_iter, None)
        if exc is None or not isinstance(exc, BaseException):
            yield MagicMock()
        else:
            raise exc

    pool.connection = _connection
    return pool


# ── idempotent=True (default) ─────────────────────────────────────────────────


@pytest.mark.parametrize("error", [OperationalError(), InterfaceError(), PoolTimeout()])
async def test_idempotent_retries_execution_errors(error):
    """Execution-level errors are retried for idempotent operations."""
    successes = [None]  # sentinel: yield a connection without raising
    pool = _make_pool([error, error, *successes])
    operation = AsyncMock(return_value="ok")

    result = await run_database_operation(pool, operation)

    assert result == "ok"
    assert operation.call_count == 1


async def test_idempotent_exhausts_retries_and_raises():
    """After DATABASE_RETRY_ATTEMPTS failures, DatabaseUnavailableError is raised."""
    errors = [OperationalError()] * DATABASE_RETRY_ATTEMPTS
    pool = _make_pool(errors)
    operation = AsyncMock()

    with pytest.raises(DatabaseUnavailableError):
        await run_database_operation(pool, operation)

    operation.assert_not_called()


# ── idempotent=False ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("error", [OperationalError(), InterfaceError()])
async def test_non_idempotent_does_not_retry_execution_errors(error):
    """OperationalError / InterfaceError must not trigger retry for non-idempotent ops."""
    pool = _make_pool([error])
    operation = AsyncMock()

    with pytest.raises(DatabaseUnavailableError):
        await run_database_operation(pool, operation, idempotent=False)

    operation.assert_not_called()


async def test_non_idempotent_retries_pool_acquisition_failure():
    """PoolTimeout (operation never ran) is safe to retry even for non-idempotent ops."""
    pool = _make_pool([PoolTimeout(), None])
    operation = AsyncMock(return_value="ok")

    result = await run_database_operation(pool, operation, idempotent=False)

    assert result == "ok"
    assert operation.call_count == 1


async def test_non_idempotent_exhausts_pool_timeouts_and_raises():
    errors = [PoolTimeout()] * DATABASE_RETRY_ATTEMPTS
    pool = _make_pool(errors)
    operation = AsyncMock()

    with pytest.raises(DatabaseUnavailableError):
        await run_database_operation(pool, operation, idempotent=False)

    operation.assert_not_called()
