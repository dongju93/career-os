from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Literal
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


class ApplicationStatus(StrEnum):
    """Lifecycle of a saved posting. Mirrors the job_postings.application_status
    CHECK constraint — the DDL string stays literal (the Platform CHECK is the
    precedent); a drift test guards the two against silent divergence."""

    saved = "saved"
    applied = "applied"
    interviewing = "interviewing"
    offer = "offer"
    rejected = "rejected"
    withdrawn = "withdrawn"


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
    application_status: ApplicationStatus
    status_updated_at: datetime | None = None
    memo: Annotated[str, Field(max_length=2000)] | None = None
    scraped_at: datetime
    created_at: datetime
    updated_at: datetime


class JobPostingUpdateRequest(BaseModel):
    """PATCH /v1/job-postings/{job_id} body — partial update of a saved posting.

    At least one field must be provided. NOT NULL columns (application_status,
    group_id) may not be set to an explicit null (mirrors the null-rejection guard
    in the groups PATCH handler). memo is a nullable column, so an explicit null
    is a valid "clear the memo" instruction and is allowed.
    """

    application_status: ApplicationStatus | None = None
    group_id: UUID | None = None
    memo: Annotated[str, Field(max_length=2000)] | None = None

    @model_validator(mode="after")
    def reject_empty_or_null_not_null_columns(self) -> JobPostingUpdateRequest:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        # memo is intentionally absent: an explicit null clears the memo.
        for field in ("application_status", "group_id"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


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
    application_status: ApplicationStatus
    status_updated_at: datetime | None = None
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


# ── Career Profile ──────────────────────────────────────────────────────────────


# Each array entry is capped so a single oversized item fails at the API boundary,
# not at the TEXT[] insert. List-level Field(max_length=...) bounds the item count.
_ProfileTag = Annotated[str, Field(max_length=100)]


class UserProfileUpsertRequest(BaseModel):
    """PUT /v1/profile body — full-replace upsert.

    Every field is optional and nullable; fields omitted on a replace are stored
    as NULL. String lengths mirror the user_profiles VARCHAR/TEXT limits so
    validation fails before the DB insert.
    """

    headline: Annotated[str, Field(max_length=200)] | None = None
    years_experience: Annotated[int, Field(ge=0, le=60)] | None = None
    target_roles: Annotated[list[_ProfileTag], Field(max_length=20)] | None = None
    skills: Annotated[list[_ProfileTag], Field(max_length=50)] | None = None
    locations: Annotated[list[_ProfileTag], Field(max_length=20)] | None = None
    salary_expectation: Annotated[str, Field(max_length=200)] | None = None
    summary: Annotated[str, Field(max_length=8000)] | None = None

    @field_validator("headline")
    @classmethod
    def normalize_headline(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip() or None

    @field_validator("target_roles", "skills", "locations", mode="before")
    @classmethod
    def drop_empty_profile_entries(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        cleaned = [item for item in v if isinstance(item, str) and item.strip()]
        return cleaned or None


class UserProfile(UserProfileUpsertRequest):
    """GET/PUT /v1/profile response — the seven content fields plus timestamps."""

    created_at: datetime
    updated_at: datetime


# ── Application Strategist ───────────────────────────────────────────────────────


# Deadline interpretation, computed by the model from the supplied "today" date and
# the posting's free-text deadline: overdue (past), soon (≤7 days), later (a future
# parseable date), unknown (no parseable date, e.g. 상시채용).
DeadlineUrgency = Literal["overdue", "soon", "later", "unknown"]


class PlanItem(BaseModel):
    """One prioritized posting in the generated Application Plan.

    This is part of the agent's structured output (`ApplicationPlan` is the SDK
    output_type), so every field is required — the model must fill them all. The
    job_id is model-emitted and therefore untrusted: the route re-verifies it
    against the caller's own postings before this reaches the client.
    """

    job_id: int
    company_name: str
    job_title: str
    fit_score: Annotated[int, Field(ge=0, le=100)]
    matched_skills: list[str]
    missing_skills: list[str]
    deadline_urgency: DeadlineUrgency
    recommended_action: str
    rationale: str


ProposedActionType = Literal["set_status", "assign_group", "save_memo"]


class ProposedAction(BaseModel):
    """A propose-then-confirm app action the model suggests but never executes.

    The agent has no write tools: it only proposes. The client applies a proposal
    by calling PATCH /v1/job-postings/{job_id} with the matching field; rejection is
    a client-side dismissal with no API call. job_id and target_group_id are
    model-emitted and therefore untrusted — the route re-verifies both against the
    caller's own postings/groups before this reaches the client.

    Which field carries the payload depends on action_type:
      - set_status   → application_status
      - assign_group → target_group_id
      - save_memo    → memo
    """

    action_type: ProposedActionType
    job_id: int
    application_status: ApplicationStatus | None = Field(
        default=None, description="set_status 액션의 목표 상태"
    )
    target_group_id: str | None = Field(
        default=None, description="assign_group 액션의 목표 그룹 UUID"
    )
    memo: str | None = Field(default=None, description="save_memo 액션의 메모 내용")
    reason: str


class ApplicationPlan(BaseModel):
    """POST /v1/agent/plan response payload AND the Agents-SDK output_type.

    Kept free of any server-only fields because it doubles as the model's required
    output contract. proposed_actions defaults to [] so the model may omit it and
    clients can always treat it as optional.
    """

    summary: str
    items: Annotated[list[PlanItem], Field(max_length=10)]
    proposed_actions: list[ProposedAction] = []


class ApplicationPlanRequest(BaseModel):
    """POST /v1/agent/plan body. Both fields optional.

    group_id omitted/null → the caller's current active group. focus is free-text
    user steering passed verbatim into the run input.
    """

    group_id: UUID | None = None
    focus: Annotated[str, Field(max_length=300)] | None = None
