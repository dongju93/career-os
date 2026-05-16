from datetime import date, datetime
from typing import Annotated
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator

from career_os_api.service.job_posting.platform import (
    PLATFORM_REGISTRY,
    Platform,
    validate_posting_id,
)

PostingId = Annotated[str, Field(min_length=1, max_length=50)]


def _validate_platform_posting_id(posting_id: str, info: ValidationInfo) -> str:
    platform = info.data.get("platform")
    if not isinstance(platform, Platform):
        return posting_id
    return validate_posting_id(posting_id, platform)


# ── Auth ──────────────────────────────────────────────────────────────────────


class CurrentUserResponse(BaseModel):
    user_id: UUID
    email: str
    name: str | None
    picture: str | None


class UpdateCurrentUserRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]

    @field_validator("name")
    @classmethod
    def reject_whitespace_only(cls, v: str) -> str:
        if not v.strip():
            msg = "Name must contain at least one non-whitespace character"
            raise ValueError(msg)
        return v.strip()


# ── Job Postings ──────────────────────────────────────────────────────────────


class _JobPostingBase(BaseModel):
    """
    Shared fields and field-level validators for all job posting schemas.
    String lengths mirror the VARCHAR(...) limits in the DDL so field
    validation fails at the API boundary, not at the database insert.
    """

    # Identity (derived from URL, echoed back for traceability)
    platform: Platform
    posting_id: PostingId
    posting_url: str  # TEXT — no length limit

    # Strict common
    company_name: Annotated[str, Field(max_length=200)]
    job_title: Annotated[str, Field(min_length=1, max_length=500)]
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

    @field_validator("job_title")
    @classmethod
    def reject_blank_job_title(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("job_title must not be blank")
        return v

    @field_validator("tech_stack", "tags", mode="before")
    @classmethod
    def drop_empty_strings(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        cleaned = [item for item in v if isinstance(item, str) and item.strip()]
        return cleaned or None

    @field_validator("posting_id")
    @classmethod
    def validate_platform_posting_id(cls, posting_id: str, info: ValidationInfo) -> str:
        return _validate_platform_posting_id(posting_id, info)


class JobPostingExtracted(_JobPostingBase):
    """
    Write-path schema: OpenAI response_format and POST request body.
    All optional fields default to None — the model must not fabricate values.

    Adds posting_url↔platform/posting_id consistency validation that is
    intentionally absent from JobPostingStored so that the read path never
    raises on legacy rows whose URLs predate or diverge from these rules.
    """

    @model_validator(mode="after")
    def validate_posting_url_consistency(self) -> JobPostingExtracted:
        parsed = urlparse(self.posting_url)
        host = parsed.hostname or ""
        adapter = PLATFORM_REGISTRY[self.platform]

        if host != adapter.domain and not host.endswith(f".{adapter.domain}"):
            raise ValueError(
                f"posting_url host '{host}' does not match platform '{self.platform.value}' (expected *.{adapter.domain})"
            )

        if self.platform == Platform.saramin:
            rec_idx = parse_qs(parsed.query).get("rec_idx", [None])[0]
            if rec_idx != self.posting_id:
                raise ValueError(
                    f"posting_url rec_idx '{rec_idx}' does not match posting_id '{self.posting_id}'"
                )
        elif self.platform == Platform.wanted:
            segments = parsed.path.rstrip("/").split("/")
            if (
                len(segments) < 3
                or segments[1] != "wd"
                or segments[2] != self.posting_id
            ):
                raise ValueError(
                    f"posting_url path must be /wd/{self.posting_id} for Wanted postings"
                )

        return self


class JobPostingCreateRequest(JobPostingExtracted):
    """POST /v1/job-postings body — extraction result plus optional target group."""

    group_id: UUID | None = None


class JobPostingStored(_JobPostingBase):
    """
    Read-path schema: response model for DB rows returned after upsert or fetch.

    Inherits from _JobPostingBase (not JobPostingExtracted) so that
    validate_posting_url_consistency does not run when deserialising persisted
    rows. The DB schema does not enforce URL↔platform/posting_id consistency,
    so any legacy mismatch would raise ValidationError and turn a valid fetch
    into a 500 if the check ran here.
    """

    id: int
    group_id: UUID
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime


class JobPostingListItem(BaseModel):
    """Lightweight projection for list responses — heavy text fields excluded."""

    id: int
    group_id: UUID
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


# ── Job Search Groups ─────────────────────────────────────────────────────────


class JobSearchGroupCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    started_at: date | None = None
    ended_at: date | None = None
    memo: str | None = None

    @model_validator(mode="after")
    def check_dates(self) -> JobSearchGroupCreate:
        if self.started_at and self.ended_at and self.ended_at < self.started_at:
            raise ValueError("ended_at must be >= started_at")
        return self


class JobSearchGroupUpdate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    started_at: date | None = None
    ended_at: date | None = None
    memo: str | None = None


class JobSearchGroupItem(BaseModel):
    """List response projection — includes posting_count."""

    id: UUID
    name: str
    started_at: date
    ended_at: date | None
    memo: str | None
    posting_count: int
    created_at: datetime
    updated_at: datetime


class JobSearchGroup(BaseModel):
    """Single-record response — no posting_count."""

    id: UUID
    name: str
    started_at: date
    ended_at: date | None
    memo: str | None
    created_at: datetime
    updated_at: datetime


class JobSearchGroupPage(BaseModel):
    items: list[JobSearchGroupItem]
    total: int
    offset: int
    limit: int
