import pytest

from career_os_api.router import _resolve_callback_url

ALLOWED = [
    "https://career-os-sigma.vercel.app",
    "http://localhost:4173",
    "http://localhost:5173",
]
FRONTEND = "https://career-os-sigma.vercel.app"


@pytest.mark.parametrize(
    "callback_url, expected",
    [
        # Path-only inputs are prefixed with frontend_url
        ("/dashboard", "https://career-os-sigma.vercel.app/dashboard"),
        (
            "/auth/callback?next=/home",
            "https://career-os-sigma.vercel.app/auth/callback?next=/home",
        ),
        # Full URLs on allowed origins pass through unchanged
        (
            "https://career-os-sigma.vercel.app/dashboard",
            "https://career-os-sigma.vercel.app/dashboard",
        ),
        ("http://localhost:5173/home", "http://localhost:5173/home"),
        ("http://localhost:4173/foo/bar", "http://localhost:4173/foo/bar"),
    ],
)
def test_valid_callback_urls(callback_url: str, expected: str) -> None:
    result = _resolve_callback_url(callback_url, ALLOWED, FRONTEND)
    assert result == expected


@pytest.mark.parametrize(
    "callback_url",
    [
        # Foreign hosts — token would leak to attacker
        "https://attacker.example/cb",
        "https://evil.com?x=1",
        # Lookalike domains not in allowlist
        "https://career-os-sigma.vercel.app.evil.com/cb",
        # Path without leading slash
        "relative/path",
        # Empty string (degenerate)
        "",
        # javascript: scheme
        "javascript:alert(1)",
    ],
)
def test_invalid_callback_urls_return_none(callback_url: str) -> None:
    result = _resolve_callback_url(callback_url, ALLOWED, FRONTEND)
    assert result is None
