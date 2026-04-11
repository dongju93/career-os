from collections.abc import AsyncIterator, Generator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

import main as app_module

API_PREFIX = f"/{app_module.API_V1}"


class FakeResult:
    async def fetchone(self) -> tuple[int]:  # NOSONAR
        return (1,)


class FakeConnection:
    def __init__(self) -> None:
        self.executed_queries: list[str] = []

    async def execute(self, query: str) -> FakeResult:  # NOSONAR
        self.executed_queries.append(query)
        return FakeResult()


class FakePool:
    def __init__(self) -> None:
        self.connection_obj = FakeConnection()

    @asynccontextmanager
    async def connection(self) -> AsyncIterator[FakeConnection]:
        yield self.connection_obj


@pytest.fixture
def fake_pool() -> FakePool:
    return FakePool()


@pytest.fixture
def client(
    monkeypatch: pytest.MonkeyPatch, fake_pool: FakePool
) -> Generator[TestClient]:
    @asynccontextmanager
    async def fake_create_postgres_pool() -> AsyncIterator[FakePool]:
        yield fake_pool

    monkeypatch.setattr(app_module, "create_postgres_pool", fake_create_postgres_pool)

    with TestClient(app_module.career_os) as test_client:
        yield test_client


def test_root_endpoint_returns_hello_world(client: TestClient) -> None:
    response = client.get(f"{API_PREFIX}/")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello, World!"}


def test_job_posting_extraction_endpoint_returns_extracted_payload(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting,
) -> None:
    fetch_url_content = AsyncMock(
        return_value=(b"<html><body>Backend Engineer</body></html>", "text/html")
    )
    extract_job_posting = AsyncMock(return_value=sample_job_posting)

    monkeypatch.setattr(app_module, "fetch_url_content", fetch_url_content)
    monkeypatch.setattr(app_module, "extract_job_posting", extract_job_posting)

    response = client.get(
        f"{API_PREFIX}/job-postings/extraction",
        params={"url": sample_job_posting.posting_url},
    )

    assert response.status_code == 200
    assert response.json()["posting_id"] == sample_job_posting.posting_id
    assert response.json()["company_name"] == sample_job_posting.company_name
    fetch_url_content.assert_awaited_once_with(sample_job_posting.posting_url)
    extract_job_posting.assert_awaited_once_with(
        html_content=b"<html><body>Backend Engineer</body></html>",
        source_url=sample_job_posting.posting_url,
    )


def test_job_posting_extraction_endpoint_requires_url_query(
    client: TestClient,
) -> None:
    response = client.get(f"{API_PREFIX}/job-postings/extraction")

    assert response.status_code == 422


def test_db_health_endpoint_uses_app_pool(
    client: TestClient,
    fake_pool: FakePool,
) -> None:
    response = client.get(f"{API_PREFIX}/health/db")

    assert response.status_code == 200
    assert response.json() == {"database": "connected", "result": 1}
    assert fake_pool.connection_obj.executed_queries == ["SELECT 1"]
