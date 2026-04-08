from pydantic import BaseModel, field_validator

from career_os_api.service.job_posting.platform import Platform


class JobPostingExtracted(BaseModel):
    """
    Structured output schema mirroring the job_postings table columns.
    All optional fields default to None — the model must not fabricate values.
    """

    # Identity (derived from URL, echoed back for traceability)
    platform: Platform
    posting_id: str
    posting_url: str

    # Strict common
    company_name: str
    job_title: str
    experience_req: str | None = None
    deadline: str | None = None
    location: str | None = None

    # General
    employment_type: str | None = None
    job_description: str | None = None
    responsibilities: str | None = None
    qualifications: str | None = None
    preferred_points: str | None = None
    benefits: str | None = None
    hiring_process: str | None = None

    # Platform-specific
    education_req: str | None = None
    salary: str | None = None
    tech_stack: list[str] | None = None
    tags: list[str] | None = None
    application_method: str | None = None
    application_form: str | None = None
    contact_person: str | None = None
    homepage: str | None = None
    job_category: str | None = None
    industry: str | None = None

    @field_validator("tech_stack", "tags", mode="before")
    @classmethod
    def drop_empty_strings(cls, v: list[str] | None) -> list[str] | None:
        """Remove blank entries the model may emit instead of omitting items."""
        if v is None:
            return None
        cleaned = [item for item in v if isinstance(item, str) and item.strip()]
        return cleaned or None
