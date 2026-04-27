import asyncio
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any, Protocol

from psycopg import AsyncConnection, InterfaceError, OperationalError
from psycopg_pool import PoolTimeout

DATABASE_RETRY_ATTEMPTS = 5
DATABASE_RETRY_BASE_DELAY_SECONDS = 0.05

# PoolTimeout fires before a connection is handed out — the operation never ran,
# so retrying is always safe regardless of idempotency.
_ACQUISITION_ERRORS = (PoolTimeout,)

# OperationalError / InterfaceError can fire during operation execution, leaving
# DB state unknown. Only retry these for idempotent operations (reads, upserts,
# IF NOT EXISTS DDL) where re-running produces the same result.
_EXECUTION_ERRORS = (OperationalError, InterfaceError)


class DatabaseUnavailableError(RuntimeError):
    """Raised after transient database failures exhaust retry attempts."""


class AsyncPoolProtocol(Protocol):
    def connection(self) -> AbstractAsyncContextManager[Any]: ...


async def run_database_operation[T](
    pool: AsyncPoolProtocol,
    operation: Callable[[AsyncConnection], Awaitable[T]],
    *,
    idempotent: bool = True,
) -> T:
    """Run *operation* inside a pooled connection with exponential-backoff retry.

    Args:
        pool: Async connection pool.
        operation: Async callable that receives an open connection and returns T.
        idempotent: Set to True (default) for reads, upserts, and DDL with
            IF NOT EXISTS — operations where re-execution produces the same
            result. Set to False for plain inserts or any write coupled to an
            external side effect; these are retried only on pool-acquisition
            failures (PoolTimeout), where the operation is known not to have run.
    """
    retryable = _ACQUISITION_ERRORS + (_EXECUTION_ERRORS if idempotent else ())
    all_db_errors = _ACQUISITION_ERRORS + _EXECUTION_ERRORS
    last_error: BaseException | None = None

    for attempt in range(1, DATABASE_RETRY_ATTEMPTS + 1):
        try:
            async with pool.connection() as conn:
                return await operation(conn)
        except all_db_errors as exc:
            if not isinstance(exc, retryable):
                # Non-idempotent operation hit an execution-level error — DB state
                # is unknown, so raise immediately without retry. Still wrapped as
                # DatabaseUnavailableError so the HTTP 503 handler fires correctly.
                raise DatabaseUnavailableError from exc
            last_error = exc
            if attempt == DATABASE_RETRY_ATTEMPTS:
                break
            await asyncio.sleep(DATABASE_RETRY_BASE_DELAY_SECONDS * attempt)

    raise DatabaseUnavailableError from last_error
