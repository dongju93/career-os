from contextlib import asynccontextmanager

from fastapi import FastAPI

from career_os_api.api import v1_router
from career_os_api.constants import API_V1
from career_os_api.database.connection import create_postgres_pool
from career_os_api.database.schemas import init_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with create_postgres_pool() as pool:
        await init_schema(pool)
        app.state.pool = pool
        yield


career_os = FastAPI(
    lifespan=lifespan,
    title="Career OS API",
    docs_url=f"/{API_V1}/docs",
    redoc_url=f"/{API_V1}/redoc",
)

career_os.include_router(v1_router)
