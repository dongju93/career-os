from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from career_os_api.constants import API_V1
from career_os_api.middleware import (
    SecurityHeadersMiddleware,
    build_security_headers,
)


async def _homepage(_request: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


def test_build_security_headers_for_api_json_is_minimal() -> None:
    headers = dict(
        build_security_headers(f"/{API_V1}/job-postings", is_https=True),
    )

    assert headers == {
        "X-Content-Type-Options": "nosniff",
        "Strict-Transport-Security": "max-age=31536000",
    }
    assert "Cross-Origin-Resource-Policy" not in headers
    assert "Cross-Origin-Opener-Policy" not in headers
    assert "Content-Security-Policy" not in headers


def test_build_security_headers_for_docs_allows_same_origin_framing() -> None:
    headers = dict(build_security_headers(f"/{API_V1}/docs", is_https=True))

    assert headers["X-Frame-Options"] == "SAMEORIGIN"
    assert "Referrer-Policy" not in headers


def test_build_security_headers_for_oauth_suppresses_referrer() -> None:
    headers = dict(
        build_security_headers(f"/{API_V1}/auth/google/callback", is_https=True),
    )

    assert headers["Referrer-Policy"] == "no-referrer"
    assert "X-Frame-Options" not in headers


def test_build_security_headers_skips_hsts_on_plain_http() -> None:
    headers = dict(build_security_headers(f"/{API_V1}/profile", is_https=False))

    assert headers == {"X-Content-Type-Options": "nosniff"}


def test_security_headers_middleware_applies_api_json_policy() -> None:
    app = SecurityHeadersMiddleware(
        Starlette(routes=[Route(f"/{API_V1}/job-postings", _homepage)]),
    )

    with TestClient(app) as client:
        response = client.get(f"/{API_V1}/job-postings")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "x-frame-options" not in response.headers
    assert "cross-origin-resource-policy" not in response.headers
