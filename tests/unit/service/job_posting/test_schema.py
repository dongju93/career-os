import pytest
from pydantic import ValidationError

from career_os_api.schemas import JobPostingExtracted
from career_os_api.service.job_posting.platform import Platform

_SARAMIN_URL = "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930"
_WANTED_URL = "https://www.wanted.co.kr/wd/4930"


def build_job_posting(
    *,
    platform: Platform = Platform.saramin,
    posting_id: str = "4930",
    posting_url: str | None = None,
    job_title: str = "Backend Engineer",
    tech_stack: list[str] | None = None,
    tags: list[str] | None = None,
) -> JobPostingExtracted:
    if posting_url is None:
        posting_url = _SARAMIN_URL if platform == Platform.saramin else _WANTED_URL
    return JobPostingExtracted(
        platform=platform,
        posting_id=posting_id,
        posting_url=posting_url,
        company_name="Career OS",
        job_title=job_title,
        tech_stack=tech_stack,
        tags=tags,
    )


def test_job_posting_extracted_drops_blank_list_items() -> None:
    posting = build_job_posting(
        tech_stack=["Python", "", "  ", "FastAPI"],
        tags=["#backend", "", "   ", "#remote"],
    )

    assert posting.tech_stack == ["Python", "FastAPI"]
    assert posting.tags == ["#backend", "#remote"]


def test_job_posting_extracted_turns_empty_lists_into_none() -> None:
    posting = build_job_posting(tech_stack=[" ", ""], tags=[])

    assert posting.tech_stack is None
    assert posting.tags is None


@pytest.mark.parametrize("job_title", ["", "   "])
def test_job_posting_extracted_rejects_blank_job_title(job_title: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_job_posting(job_title=job_title)

    assert exc_info.value.errors()[0]["loc"] == ("job_title",)


@pytest.mark.parametrize("posting_id", ["", "   "])
def test_job_posting_extracted_rejects_blank_posting_id(posting_id: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_job_posting(posting_id=posting_id)

    assert exc_info.value.errors()[0]["loc"] == ("posting_id",)


def test_job_posting_extracted_normalizes_posting_id_whitespace() -> None:
    posting = build_job_posting(posting_id=" 4930 ")

    assert posting.posting_id == "4930"


def test_job_posting_extracted_rejects_non_numeric_platform_posting_id() -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_job_posting(platform=Platform.wanted, posting_id="wd-321")

    assert exc_info.value.errors()[0]["loc"] == ("posting_id",)


# ── posting_url consistency ────────────────────────────────────────────────────


def test_posting_url_consistency_valid_saramin() -> None:
    posting = build_job_posting(platform=Platform.saramin, posting_id="4930")
    assert posting.posting_url == _SARAMIN_URL


def test_posting_url_consistency_valid_wanted() -> None:
    posting = build_job_posting(platform=Platform.wanted, posting_id="4930")
    assert posting.posting_url == _WANTED_URL


def test_posting_url_consistency_rejects_wrong_host_for_wanted() -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_job_posting(
            platform=Platform.wanted,
            posting_id="123",
            posting_url="https://evil.example/wd/123",
        )
    messages = " ".join(e["msg"] for e in exc_info.value.errors())
    assert "evil.example" in messages


def test_posting_url_consistency_rejects_saramin_rec_idx_mismatch() -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_job_posting(
            platform=Platform.saramin,
            posting_id="9999",
            posting_url="https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1111",
        )
    messages = " ".join(e["msg"] for e in exc_info.value.errors())
    assert "1111" in messages and "9999" in messages


def test_posting_url_consistency_rejects_wanted_wrong_path() -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_job_posting(
            platform=Platform.wanted,
            posting_id="123",
            posting_url="https://www.wanted.co.kr/wd/999",
        )
    messages = " ".join(e["msg"] for e in exc_info.value.errors())
    assert "123" in messages


def test_posting_url_consistency_accepts_saramin_subdomain() -> None:
    posting = build_job_posting(
        platform=Platform.saramin,
        posting_id="77",
        posting_url="https://m.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=77",
    )
    assert posting.posting_id == "77"
