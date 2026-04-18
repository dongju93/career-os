import pytest
from pydantic import ValidationError

from career_os_api.schemas import JobPostingExtracted
from career_os_api.service.job_posting.platform import Platform


def build_job_posting(
    *,
    platform: Platform = Platform.saramin,
    posting_id: str = "4930",
    tech_stack: list[str] | None = None,
    tags: list[str] | None = None,
) -> JobPostingExtracted:
    return JobPostingExtracted(
        platform=platform,
        posting_id=posting_id,
        posting_url="https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
        company_name="Career OS",
        job_title="Backend Engineer",
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
