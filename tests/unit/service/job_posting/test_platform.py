import pytest
from fastapi import HTTPException

from career_os_api.service.job_posting.platform import (
    Platform,
    detect_platform,
    extract_posting_id,
    validate_posting_id,
)


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
            Platform.saramin,
        ),
        (
            "https://m.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
            Platform.saramin,
        ),
        ("https://www.wanted.co.kr/wd/321", Platform.wanted),
        ("https://api.wanted.co.kr/wd/321", Platform.wanted),
    ],
)
def test_detect_platform_accepts_supported_domains(
    url: str, expected: Platform
) -> None:
    assert detect_platform(url) is expected


def test_detect_platform_rejects_missing_hostname() -> None:
    with pytest.raises(HTTPException) as exc_info:
        detect_platform("not-a-valid-url")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid URL: could not parse hostname"


def test_detect_platform_rejects_unsupported_domain() -> None:
    with pytest.raises(HTTPException) as exc_info:
        detect_platform("https://example.com/jobs/123")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unsupported job board domain: example.com"


@pytest.mark.parametrize(
    ("posting_id", "platform", "expected"),
    [
        ("4930", Platform.saramin, "4930"),
        (" 321 ", Platform.wanted, "321"),
    ],
)
def test_validate_posting_id_accepts_numeric_identifiers(
    posting_id: str, platform: Platform, expected: str
) -> None:
    assert validate_posting_id(posting_id, platform) == expected


@pytest.mark.parametrize(
    ("posting_id", "platform", "expected_message"),
    [
        ("", Platform.saramin, "must not be empty"),
        ("   ", Platform.wanted, "must not be empty"),
        ("49a0", Platform.saramin, "must contain only digits"),
        ("wd-321", Platform.wanted, "must contain only digits"),
    ],
)
def test_validate_posting_id_rejects_blank_or_non_numeric_values(
    posting_id: str, platform: Platform, expected_message: str
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        validate_posting_id(posting_id, platform)


@pytest.mark.parametrize(
    ("url", "platform", "expected"),
    [
        (
            "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
            Platform.saramin,
            "4930",
        ),
        ("https://www.wanted.co.kr/wd/321", Platform.wanted, "321"),
    ],
)
def test_extract_posting_id_derives_platform_native_identifier(
    url: str, platform: Platform, expected: str
) -> None:
    assert extract_posting_id(url, platform) == expected


def test_extract_posting_id_raises_for_saramin_missing_rec_idx() -> None:
    with pytest.raises(HTTPException) as exc_info:
        extract_posting_id(
            "https://www.saramin.co.kr/zf_user/jobs/relay/view",
            Platform.saramin,
        )

    assert exc_info.value.status_code == 400
    assert "rec_idx" in exc_info.value.detail


def test_extract_posting_id_raises_for_saramin_invalid_rec_idx() -> None:
    with pytest.raises(HTTPException) as exc_info:
        extract_posting_id(
            "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=49a0",
            Platform.saramin,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Saramin URL contains an invalid rec_idx parameter"


@pytest.mark.parametrize(
    "url",
    [
        "https://www.wanted.co.kr/company/123",  # not a /wd/ path
        "https://www.wanted.co.kr/events/hiring",  # not a /wd/ path
        "https://www.wanted.co.kr/wd/",  # missing ID segment
        "https://www.wanted.co.kr/",  # no path at all
    ],
)
def test_extract_posting_id_raises_for_wanted_non_job_url(url: str) -> None:
    with pytest.raises(HTTPException) as exc_info:
        extract_posting_id(url, Platform.wanted)

    assert exc_info.value.status_code == 400
    assert "/wd/" in exc_info.value.detail


def test_extract_posting_id_raises_for_wanted_non_numeric_id() -> None:
    with pytest.raises(HTTPException) as exc_info:
        extract_posting_id("https://www.wanted.co.kr/wd/wd-321", Platform.wanted)

    assert exc_info.value.status_code == 400
    assert "/wd/" in exc_info.value.detail
