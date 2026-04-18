from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from career_os_api.service.job_posting.platform import Platform, validate_posting_id

PostingId = Annotated[str, Field(min_length=1, max_length=50)]


def _validate_platform_posting_id(posting_id: str, info: ValidationInfo) -> str:
    platform = info.data.get("platform")
    if not isinstance(platform, Platform):
        return posting_id
    return validate_posting_id(posting_id, platform)


# ── Auth ──────────────────────────────────────────────────────────────────────


class GoogleLoginResponse(BaseModel):
    message: str
    user_id: UUID
    email: str
    name: str | None
    picture: str | None
    access_token: str
    token_type: str = "bearer"


# ── Job Postings ──────────────────────────────────────────────────────────────


class JobPostingExtracted(BaseModel):
    """
    Structured output schema mirroring the job_postings table columns.
    All optional fields default to None — the model must not fabricate values.
    String lengths mirror the VARCHAR(...) limits in the DDL so validation
    fails at the API boundary, not at the database insert.
    """

    # Identity (derived from URL, echoed back for traceability)
    platform: Platform
    posting_id: PostingId
    posting_url: str  # TEXT — no length limit

    # Strict common
    company_name: Annotated[str, Field(max_length=200)]
    job_title: Annotated[str, Field(max_length=500)]
    experience_req: Annotated[str, Field(max_length=100)] | None = None
    deadline: Annotated[str, Field(max_length=100)] | None = None
    location: Annotated[str, Field(max_length=300)] | None = None

    # General
    employment_type: Annotated[str, Field(max_length=50)] | None = None
    job_description: str | None = None  # TEXT
    responsibilities: str | None = None  # TEXT
    qualifications: str | None = None  # TEXT
    preferred_points: str | None = None  # TEXT
    benefits: str | None = None  # TEXT
    hiring_process: str | None = None  # TEXT

    # Platform-specific
    education_req: Annotated[str, Field(max_length=100)] | None = None
    salary: Annotated[str, Field(max_length=200)] | None = None
    tech_stack: list[str] | None = None
    tags: list[str] | None = None
    application_method: Annotated[str, Field(max_length=200)] | None = None
    application_form: Annotated[str, Field(max_length=200)] | None = None
    contact_person: Annotated[str, Field(max_length=100)] | None = None
    homepage: Annotated[str, Field(max_length=500)] | None = None
    job_category: Annotated[str, Field(max_length=200)] | None = None
    industry: Annotated[str, Field(max_length=200)] | None = None

    @field_validator("tech_stack", "tags", mode="before")
    @classmethod
    def drop_empty_strings(cls, v: list[str] | None) -> list[str] | None:
        """Remove blank entries the model may emit instead of omitting items."""
        if v is None:
            return None
        cleaned = [item for item in v if isinstance(item, str) and item.strip()]
        return cleaned or None

    @field_validator("posting_id")
    @classmethod
    def validate_platform_posting_id(cls, posting_id: str, info: ValidationInfo) -> str:
        return _validate_platform_posting_id(posting_id, info)


class JobPostingStored(JobPostingExtracted):
    """Response model after a successful upsert into job_postings."""

    id: int
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime


class JobPostingListItem(BaseModel):
    """Lightweight projection for list responses — heavy text fields excluded."""

    id: int
    platform: Platform
    posting_id: PostingId
    posting_url: str
    company_name: str
    job_title: str
    experience_req: str | None = None
    deadline: str | None = None
    location: str | None = None
    employment_type: str | None = None
    salary: str | None = None
    tech_stack: list[str] | None = None
    tags: list[str] | None = None
    job_category: str | None = None
    industry: str | None = None
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime

    @field_validator("posting_id")
    @classmethod
    def validate_platform_posting_id(cls, posting_id: str, info: ValidationInfo) -> str:
        return _validate_platform_posting_id(posting_id, info)


class JobPostingPage(BaseModel):
    """Offset-paginated list response."""

    items: list[JobPostingListItem]
    total: int
    offset: int
    limit: int
