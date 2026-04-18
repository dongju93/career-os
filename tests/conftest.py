import os

import pytest

# Force test-safe settings so the suite does not depend on a developer's shell
# environment or local .env secrets.
os.environ["DATABASE_URL"] = (
    "postgresql://career_os:career_os@localhost:5432/career_os_test"
)
os.environ["OPENAI_API_KEY"] = "test-openai-api-key"
os.environ["GOOGLE_CLIENT_ID"] = "test-google-client-id"
os.environ["GOOGLE_CLIENT_SECRET"] = "test-google-client-secret"
os.environ["SECRET_KEY"] = "test-secret-key-for-jwt"

from career_os_api.schemas import JobPostingExtracted
from career_os_api.service.job_posting.platform import Platform


@pytest.fixture
def sample_job_posting() -> JobPostingExtracted:
    return JobPostingExtracted(
        platform=Platform.saramin,
        posting_id="4930",
        posting_url="https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
        company_name="Career OS",
        job_title="Backend Engineer",
        experience_req="3 years+",
        deadline="2026-05-31",
        location="Seoul",
        employment_type="Full-time",
        job_description="Build and maintain APIs.",
        responsibilities="Own backend services.",
        qualifications="FastAPI experience",
        preferred_points="OpenAI integration experience",
        benefits="Remote-friendly",
        hiring_process="Resume > Interview",
        tech_stack=["Python", "FastAPI", "PostgreSQL"],
        tags=["#backend", "#python"],
    )
