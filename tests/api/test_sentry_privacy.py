"""Regression guard: what the production Sentry config lets out of the process.

Sentry SDK 3.x has no EventScrubber and defaults most categories to "collect",
so a 500 is driven through the real middleware stack with
``main.SENTRY_DATA_COLLECTION`` and every captured event/span is searched for
marker values. Framework frame locals (``scope``, ``request``) carry the raw
Cookie header, which is how the session cookie leaked before the allowlists.
"""

import json
from collections.abc import Generator
from typing import Any

import pytest
import sentry_sdk
from fastapi import Request
from fastapi.testclient import TestClient
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.transport import Transport

import main as main_module
from career_os_api.schemas import UserProfileUpsertRequest

_PROBE_PATH = "/v1/__sentry_privacy_probe"
_ALLOWED_JOB_ID = 424242

_SENSITIVE_MARKERS = {
    "session cookie": "PROBE-SIGNED-SESSION-COOKIE",
    "client ip": "203.0.113.77",
    "vercel geo header": "PROBE-GEO-CITY",
    "email": "probe-user@example.com",
    "oauth access token": "ya29.PROBE-ACCESS-TOKEN",
    "request body": "PROBE-SALARY-9000",
    "oauth code query": "PROBE-AUTH-CODE",
}


class _DiscardTransport(Transport):
    def capture_envelope(self, envelope: Any) -> None:
        pass


async def _sentry_privacy_probe_route(
    request: Request, data: UserProfileUpsertRequest
) -> None:
    current_user = {"id": 1, "email": _SENSITIVE_MARKERS["email"]}
    token = {"access_token": _SENSITIVE_MARKERS["oauth access token"]}
    job_id = _ALLOWED_JOB_ID
    assert current_user and token and job_id  # keep the locals live in the frame
    raise RuntimeError("probe failure")


@pytest.fixture
def captured_sentry_payloads() -> Generator[tuple[list[Any], list[Any]]]:
    events: list[Any] = []
    spans: list[Any] = []

    def _record_event(event: Any, _hint: Any) -> None:
        events.append(event)

    def _record_span(span: Any, _hint: Any) -> Any:
        spans.append(span)
        return span

    sentry_sdk.init(
        dsn="https://public@o0.ingest.sentry.io/1",
        traces_sample_rate=1.0,
        integrations=[FastApiIntegration()],
        data_collection=main_module.SENTRY_DATA_COLLECTION,
        transport=_DiscardTransport,
        before_send=_record_event,
        before_send_span=_record_span,
    )
    main_module.career_os.add_api_route(
        _PROBE_PATH, _sentry_privacy_probe_route, methods=["POST"]
    )
    probe_route = main_module.career_os.router.routes[-1]
    try:
        yield events, spans
    finally:
        main_module.career_os.router.routes.remove(probe_route)
        sentry_sdk.get_client().close()
        sentry_sdk.get_global_scope().set_client(None)


def test_sentry_payload_excludes_pii_and_credentials(
    captured_sentry_payloads: tuple[list[Any], list[Any]],
) -> None:
    events, spans = captured_sentry_payloads
    client = TestClient(main_module.career_os, raise_server_exceptions=False)

    response = client.post(
        f"{_PROBE_PATH}?code={_SENSITIVE_MARKERS['oauth code query']}&limit=7",
        json={"salary_expectation": _SENSITIVE_MARKERS["request body"]},
        headers={
            "Cookie": f"session={_SENSITIVE_MARKERS['session cookie']}",
            "X-Forwarded-For": _SENSITIVE_MARKERS["client ip"],
            "X-Real-IP": _SENSITIVE_MARKERS["client ip"],
            "X-Vercel-IP-City": _SENSITIVE_MARKERS["vercel geo header"],
            "X-Career-OS-Client": "web",
        },
    )
    sentry_sdk.flush()

    assert response.status_code == 500
    assert len(events) == 1
    payload = json.dumps([events, spans], default=repr)
    leaked = [name for name, value in _SENSITIVE_MARKERS.items() if value in payload]
    assert leaked == []

    # Allowlisted, non-identifying context must still reach Sentry.
    event = events[0]
    probe_frame = event["exception"]["values"][-1]["stacktrace"]["frames"][-1]
    assert probe_frame["vars"]["job_id"] == str(_ALLOWED_JOB_ID)
    assert event["request"]["headers"]["x-career-os-client"] == "web"
    assert "limit=7" in event["request"]["query_string"]
