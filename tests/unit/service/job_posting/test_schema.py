from career_os_api.service.job_posting.platform import Platform
from career_os_api.service.job_posting.schema import JobPostingExtracted


def build_job_posting(
    *,
    tech_stack: list[str] | None = None,
    tags: list[str] | None = None,
) -> JobPostingExtracted:
    return JobPostingExtracted(
        platform=Platform.saramin,
        posting_id="4930",
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
