import asyncio
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any, Protocol

from psycopg import AsyncConnection, InterfaceError, OperationalError
from psycopg_pool import PoolTimeout

DATABASE_RETRY_ATTEMPTS = 5
DATABASE_RETRY_BASE_DELAY_SECONDS = 0.05

_RETRYABLE_DATABASE_ERRORS = (OperationalError, InterfaceError, PoolTimeout)


class DatabaseUnavailableError(RuntimeError):
    """Raised after transient database failures exhaust retry attempts."""


class AsyncPoolProtocol(Protocol):
    def connection(self) -> AbstractAsyncContextManager[Any]: ...


async def run_database_operation[T](
    pool: AsyncPoolProtocol,
    operation: Callable[[AsyncConnection], Awaitable[T]],
) -> T:
    last_error: BaseException | None = None

    for attempt in range(1, DATABASE_RETRY_ATTEMPTS + 1):
        try:
            async with pool.connection() as conn:
                return await operation(conn)
        except _RETRYABLE_DATABASE_ERRORS as exc:
            last_error = exc
            if attempt == DATABASE_RETRY_ATTEMPTS:
                break
            await asyncio.sleep(DATABASE_RETRY_BASE_DELAY_SECONDS * attempt)

    raise DatabaseUnavailableError from last_error
