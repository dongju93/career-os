# Testing Scope

This test suite is intentionally split by boundary. The current suite verifies
application behavior without requiring a live database, live upstream HTTP, or
real OpenAI API access.

## Current Coverage

- `tests/api`
  - Verifies FastAPI route contracts only.
  - Uses `TestClient` against the app, but replaces app startup database pool
    creation with a fake pool.
  - Mocks route collaborators such as content fetching and job posting
    extraction.
  - Covers request validation, response shape, and route-to-service wiring.
  - Does not open a real Postgres connection or call external services.
- `tests/unit/service/job_posting`
  - Verifies service-level parsing rules, schema normalization, request
    orchestration, and error mapping.
  - Uses stubs and fakes for `httpx` and OpenAI client interactions.
  - Covers platform detection, posting ID extraction, Saramin HTML section
    extraction, fetch error handling, prompt/message construction, image source
    normalization, and model refusal handling.
  - Does not perform live HTTP requests or real OpenAI completions.
- `tests/conftest.py`
  - Sets placeholder `DATABASE_URL` and `OPENAI_API_KEY` values so settings can
    load during tests.
  - These values are test-only defaults, not expected to resolve to real
    services.

## Out Of Scope

- Real Postgres connectivity, connection pool behavior, or database migrations.
- End-to-end network calls to Saramin or other upstream job board pages.
- Real OpenAI API responses, latency, quotas, or model compatibility.
- Full integration coverage across FastAPI, database, upstream HTTP, and OpenAI
  in one test run.

## Placement Rules

- Add tests at the lowest stable boundary that proves the behavior.
- Add one API-level contract test only when public route behavior needs
  coverage.
- Put shared fixtures in `tests/conftest.py`.
- Put reusable test doubles and protocol helpers in modules like
  `tests/support.py`.
- Reserve `tests/integration` for future cases that intentionally require a
  real database, recorded upstream traffic, or other live dependencies.
