import json

import httpx
import pytest
from fastapi import HTTPException

from career_os_api.service.job_posting import wanted as wanted_module
from tests.httpx_stubs import SequenceAsyncClient, make_http_status_error, make_response

# Minimal Wanted API payload that exercises all _build_posting_html branches.
SAMPLE_API_RESPONSE: dict = {
    "job": {
        "id": 349998,
        "title": "Backend Engineer",
        "expire_time": "2024-12-31T23:59:59+09:00",
        "annual_from": 5000,
        "annual_to": 8000,
        "experience_level": {"min": 3, "max": 5, "name": "3~5년"},
        "company": {
            "name": "Career OS",
            "industry_name": "IT/인터넷",
        },
        "address": {"full_location": "서울 강남구"},
        "detail": {
            "title": None,
            "intro": "<p>We build tools for job seekers.</p>",
            "main_tasks": (
                "<p>Build APIs</p>"
                "<img src='https://cdn.wanted.co.kr/img/posting.png' />"
            ),
            "requirements": "<p>3+ years Python experience</p>",
            "preferred_points": None,  # omitted field — must not appear in output
            "benefits": "<p>Remote friendly</p>",
            "recruitment_process": None,
        },
        "job_hash_tags": [{"title": "#백엔드"}, {"title": "#파이썬"}],
        "tech_stacks": [{"title": "Python"}, {"title": "FastAPI"}],
    }
}


# ---------------------------------------------------------------------------
# is_wanted_url
# ---------------------------------------------------------------------------


def test_is_wanted_url_matches_bare_domain() -> None:
    assert wanted_module.is_wanted_url("https://wanted.co.kr/wd/1") is True


def test_is_wanted_url_matches_www_subdomain() -> None:
    assert wanted_module.is_wanted_url("https://www.wanted.co.kr/wd/349998") is True


def test_is_wanted_url_rejects_other_domains() -> None:
    assert wanted_module.is_wanted_url("https://saramin.co.kr/wd/1") is False
    assert wanted_module.is_wanted_url("https://example.com/wd/1") is False


# ---------------------------------------------------------------------------
# fetch_wanted_job_posting — success path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_wanted_job_posting_builds_html_from_api_response() -> None:
    client = SequenceAsyncClient(
        [
            make_response(
                f"{wanted_module.WANTED_JOB_API_URL}/349998",
                content=json.dumps(SAMPLE_API_RESPONSE).encode(),
                headers={"content-type": "application/json"},
            ),
        ]
    )

    content = await wanted_module.fetch_wanted_job_posting(
        "https://www.wanted.co.kr/wd/349998",
        client,
    )
    html = content.decode("utf-8")

    # Header fields
    assert "Backend Engineer" in html
    assert "Career OS" in html
    assert "IT/인터넷" in html
    assert "서울 강남구" in html
    assert "3~5년" in html
    assert "2024-12-31" in html
    assert "5000 ~ 8000" in html

    # Detail sections (HTML preserved raw so img tags survive)
    assert "We build tools for job seekers." in html
    assert "Build APIs" in html
    assert "https://cdn.wanted.co.kr/img/posting.png" in html
    assert "3+ years Python experience" in html
    assert "Remote friendly" in html

    # Tags and tech stack
    assert "#백엔드" in html
    assert "#파이썬" in html
    assert "Python" in html
    assert "FastAPI" in html

    # Null detail field must be absent
    assert "Preferred Qualifications" not in html


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("annual_from", "annual_to"),
    [
        (5000, None),
        (None, 8000),
    ],
)
async def test_fetch_wanted_job_posting_omits_salary_when_range_is_open_ended(
    annual_from: int | None,
    annual_to: int | None,
) -> None:
    payload = json.loads(json.dumps(SAMPLE_API_RESPONSE))
    payload["job"]["annual_from"] = annual_from
    payload["job"]["annual_to"] = annual_to

    client = SequenceAsyncClient(
        [
            make_response(
                f"{wanted_module.WANTED_JOB_API_URL}/349998",
                content=json.dumps(payload).encode(),
                headers={"content-type": "application/json"},
            ),
        ]
    )

    content = await wanted_module.fetch_wanted_job_posting(
        "https://www.wanted.co.kr/wd/349998",
        client,
    )
    html = content.decode("utf-8")

    assert "class='salary'" not in html
    assert "5000 ~ None" not in html
    assert "None ~ 8000" not in html


@pytest.mark.asyncio
async def test_fetch_wanted_job_posting_hits_api_with_posting_id() -> None:
    client = SequenceAsyncClient(
        [
            make_response(
                f"{wanted_module.WANTED_JOB_API_URL}/349998",
                content=json.dumps(SAMPLE_API_RESPONSE).encode(),
                headers={"content-type": "application/json"},
            ),
        ]
    )

    await wanted_module.fetch_wanted_job_posting(
        "https://www.wanted.co.kr/wd/349998",
        client,
    )

    assert client.calls[0][0] == f"{wanted_module.WANTED_JOB_API_URL}/349998"


# ---------------------------------------------------------------------------
# fetch_wanted_job_posting — URL validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_wanted_job_posting_requires_wd_path() -> None:
    from unittest.mock import MagicMock

    with pytest.raises(HTTPException) as exc_info:
        await wanted_module.fetch_wanted_job_posting(
            "https://www.wanted.co.kr/company/123",
            MagicMock(),
        )
    assert exc_info.value.status_code == 400
    assert "/wd/{id}" in exc_info.value.detail


@pytest.mark.asyncio
async def test_fetch_wanted_job_posting_requires_nonempty_id() -> None:
    from unittest.mock import MagicMock

    with pytest.raises(HTTPException) as exc_info:
        await wanted_module.fetch_wanted_job_posting(
            "https://www.wanted.co.kr/wd/",
            MagicMock(),
        )
    assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# fetch_wanted_job_posting — error propagation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_wanted_job_posting_maps_upstream_status() -> None:
    client = SequenceAsyncClient(
        [make_http_status_error(f"{wanted_module.WANTED_JOB_API_URL}/349998", 404)]
    )

    with pytest.raises(HTTPException) as exc_info:
        await wanted_module.fetch_wanted_job_posting(
            "https://www.wanted.co.kr/wd/349998",
            client,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Wanted returned 404"


@pytest.mark.asyncio
async def test_fetch_wanted_job_posting_maps_request_errors() -> None:
    client = SequenceAsyncClient(
        [
            httpx.RequestError(
                "timeout",
                request=httpx.Request(
                    "GET", f"{wanted_module.WANTED_JOB_API_URL}/349998"
                ),
            )
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await wanted_module.fetch_wanted_job_posting(
            "https://www.wanted.co.kr/wd/349998",
            client,
        )

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Failed to reach Wanted"
