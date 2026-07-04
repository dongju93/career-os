from starlette.applications import Starlette
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from career_os_api.constants import API_V1
from career_os_api.middleware import (
    PartitionedSessionCookieMiddleware,
    SecurityHeadersMiddleware,
    build_security_headers,
)


async def _homepage(_request: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


async def _set_session(request: Request) -> PlainTextResponse:
    request.session["user_id"] = "abc"
    return PlainTextResponse("ok")


async def _clear_session(request: Request) -> PlainTextResponse:
    request.session.clear()
    return PlainTextResponse("ok")


async def _set_other_cookie(_request: Request) -> PlainTextResponse:
    response = PlainTextResponse("ok")
    response.set_cookie("other", "value")
    return response


def _build_session_app(handler):
    return PartitionedSessionCookieMiddleware(
        SessionMiddleware(
            Starlette(routes=[Route("/", handler)]),
            secret_key="test-secret",
            same_site="none",
            https_only=True,
        ),
    )


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


def test_partitioned_middleware_appends_attribute_to_session_cookie() -> None:
    with TestClient(_build_session_app(_set_session)) as client:
        response = client.get("/")

    set_cookie = response.headers["set-cookie"]
    assert set_cookie.startswith("session=")
    assert "Partitioned" in set_cookie
    assert "samesite=none" in set_cookie.lower()
    assert "secure" in set_cookie.lower()


def test_partitioned_middleware_applies_to_session_clear_cookie() -> None:
    app = PartitionedSessionCookieMiddleware(
        SessionMiddleware(
            Starlette(
                routes=[
                    Route("/set", _set_session),
                    Route("/clear", _clear_session),
                ],
            ),
            secret_key="test-secret",
            same_site="none",
            https_only=True,
        ),
    )
    with TestClient(app, base_url="https://testserver") as client:
        client.get("/set")
        response = client.get("/clear")

    set_cookie = response.headers["set-cookie"]
    assert set_cookie.startswith("session=null")
    assert "Partitioned" in set_cookie


def test_partitioned_middleware_ignores_unrelated_cookies() -> None:
    with TestClient(_build_session_app(_set_other_cookie)) as client:
        response = client.get("/")

    set_cookie_values = response.headers.get_list("set-cookie")
    other_cookie = next(v for v in set_cookie_values if v.startswith("other="))
    assert "Partitioned" not in other_cookie


async def _already_partitioned(_request: Request) -> PlainTextResponse:
    return PlainTextResponse(
        "ok", headers={"set-cookie": "session=abc; Partitioned; secure"}
    )


def test_partitioned_middleware_does_not_duplicate_attribute() -> None:
    app = PartitionedSessionCookieMiddleware(
        Starlette(routes=[Route("/", _already_partitioned)]),
    )
    with TestClient(app) as client:
        response = client.get("/")

    set_cookie = response.headers["set-cookie"]
    assert set_cookie.count("Partitioned") == 1
