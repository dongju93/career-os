from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from psycopg_pool import AsyncConnectionPool

from career_os_api.config import settings


@asynccontextmanager
async def create_postgres_pool() -> AsyncGenerator[AsyncConnectionPool]:
    async with AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
    ) as pool:
        yield pool
