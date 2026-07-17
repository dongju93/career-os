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

PostingId = Annotated[
    str,
    Field(
        min_length=1,
        max_length=50,
        description="채용 플랫폼에서 사용하는 공고 식별자",
        examples=["4930"],
    ),
]


def _validate_platform_posting_id(posting_id: str, info: ValidationInfo) -> str:
    platform = info.data.get("platform")
    if not isinstance(platform, Platform):
        return posting_id
    return validate_posting_id(posting_id, platform)


# ── Auth ──────────────────────────────────────────────────────────────────────


class CurrentUserResponse(BaseModel):
    user_id: UUID = Field(description="Career OS 사용자 UUID")
    email: str = Field(description="Google 계정 이메일")
    name: str | None = Field(default=None, description="사용자 표시 이름")
    picture: str | None = Field(default=None, description="Google 프로필 이미지 URL")


class UpdateCurrentUserRequest(BaseModel):
    name: Annotated[
        str,
        Field(
            min_length=1,
            max_length=100,
            description="변경할 사용자 표시 이름",
            examples=["홍길동"],
        ),
    ]

    @field_validator("name")
    @classmethod
    def reject_whitespace_only(cls, v: str) -> str:
        if not v.strip():
            msg = "Name must contain at least one non-whitespace character"
            raise ValueError(msg)
        return v.strip()


class LoginCodeExchangeRequest(BaseModel):
    login_code: Annotated[
        str,
        Field(
            min_length=1,
            max_length=200,
            description="OAuth callback URL에서 받은 일회용 로그인 교환 코드",
        ),
    ]


class AccessTokenResponse(BaseModel):
    access_token: str = Field(description="API 호출에 사용할 Bearer access token")
    token_type: Literal["bearer"] = Field(
        default="bearer", description="인증 토큰 타입"
    )


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
    platform: Platform = Field(description="채용 플랫폼", examples=["saramin"])
    posting_id: PostingId
    posting_url: str = Field(
        description="원본 채용 공고 URL",
        examples=["https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930"],
    )  # TEXT — no length limit

    # Strict common
    company_name: Annotated[
        str, Field(max_length=200, description="회사명", examples=["Career OS"])
    ]
    job_title: Annotated[
        str,
        Field(
            min_length=1,
            max_length=500,
            description="채용 직무명",
            examples=["Backend Engineer"],
        ),
    ]
    experience_req: (
        Annotated[str, Field(max_length=100, description="경력 요건")] | None
    ) = None
    deadline: (
        Annotated[str, Field(max_length=100, description="채용 마감일 원문")] | None
    ) = None
    location: Annotated[str, Field(max_length=300, description="근무지")] | None = None

    # General
    employment_type: (
        Annotated[str, Field(max_length=50, description="고용 형태")] | None
    ) = None
    job_description: str | None = None  # TEXT
    responsibilities: str | None = None  # TEXT
    qualifications: str | None = None  # TEXT
    preferred_points: str | None = None  # TEXT
    benefits: str | None = None  # TEXT
    hiring_process: str | None = None  # TEXT

    # Platform-specific
    education_req: (
        Annotated[str, Field(max_length=100, description="학력 요건")] | None
    ) = None
    salary: Annotated[str, Field(max_length=200, description="급여 정보")] | None = None
    tech_stack: list[str] | None = None
    tags: list[str] | None = None
    application_method: (
        Annotated[str, Field(max_length=200, description="지원 방법")] | None
    ) = None
    application_form: (
        Annotated[str, Field(max_length=200, description="지원 양식")] | None
    ) = None
    contact_person: (
        Annotated[str, Field(max_length=100, description="채용 담당자")] | None
    ) = None
    homepage: (
        Annotated[str, Field(max_length=500, description="회사 홈페이지 URL")] | None
    ) = None
    job_category: (
        Annotated[str, Field(max_length=200, description="직무 카테고리")] | None
    ) = None
    industry: Annotated[str, Field(max_length=200, description="산업 분야")] | None = (
        None
    )

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

    group_id: UUID | None = Field(
        default=None,
        description="저장할 구직 활동 그룹 UUID. 생략하면 현재 활성 그룹을 사용합니다.",
    )


class JobPostingStored(_JobPostingBase):
    """
    Read-path schema: response model for DB rows returned after upsert or fetch.

    Inherits from _JobPostingBase (not JobPostingExtracted) so that
    validate_posting_url_consistency does not run when deserialising persisted
    rows. The DB schema does not enforce URL↔platform/posting_id consistency,
    so any legacy mismatch would raise ValidationError and turn a valid fetch
    into a 500 if the check ran here.
    """

    id: int = Field(description="Career OS 내부 채용 공고 ID", examples=[101])
    group_id: UUID = Field(description="소속 구직 활동 그룹 UUID")
    application_status: ApplicationStatus = Field(description="지원 진행 상태")
    status_updated_at: datetime | None = Field(
        default=None, description="지원 진행 상태가 마지막으로 변경된 시각"
    )
    memo: Annotated[str, Field(max_length=2000, description="사용자 메모")] | None = (
        None
    )
    scraped_at: datetime = Field(description="원본 공고를 마지막으로 수집한 시각")
    created_at: datetime = Field(description="레코드 생성 시각")
    updated_at: datetime = Field(description="레코드 수정 시각")


class JobPostingUpdateRequest(BaseModel):
    """PATCH /v1/job-postings/{job_id} body — partial update of a saved posting.

    At least one field must be provided. NOT NULL columns (application_status,
    group_id) may not be set to an explicit null (mirrors the null-rejection guard
    in the groups PATCH handler). memo is a nullable column, so an explicit null
    is a valid "clear the memo" instruction and is allowed.
    """

    application_status: ApplicationStatus | None = Field(
        default=None, description="변경할 지원 진행 상태"
    )
    group_id: UUID | None = Field(
        default=None, description="이동할 구직 활동 그룹 UUID"
    )
    memo: (
        Annotated[
            str,
            Field(max_length=2000, description="저장할 메모. null이면 기존 메모 삭제"),
        ]
        | None
    ) = None

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
    name: Annotated[
        str,
        Field(
            min_length=1,
            max_length=100,
            description="구직 활동 그룹 이름",
            examples=["2026년 상반기 백엔드 지원"],
        ),
    ]
    started_at: date | None = Field(
        default=None, description="구직 활동 시작일. 생략하면 오늘 날짜"
    )
    ended_at: date | None = Field(default=None, description="구직 활동 종료일")
    memo: str | None = Field(default=None, description="그룹 메모")

    @model_validator(mode="after")
    def check_dates(self) -> JobSearchGroupCreate:
        if self.started_at and self.ended_at and self.ended_at < self.started_at:
            raise ValueError("ended_at must be >= started_at")
        return self


class JobSearchGroupUpdate(BaseModel):
    name: (
        Annotated[
            str,
            Field(min_length=1, max_length=100, description="변경할 그룹 이름"),
        ]
        | None
    ) = None
    started_at: date | None = Field(default=None, description="변경할 구직 활동 시작일")
    ended_at: date | None = Field(default=None, description="변경할 구직 활동 종료일")
    memo: str | None = Field(default=None, description="변경할 그룹 메모")


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

    headline: (
        Annotated[
            str,
            Field(
                max_length=200,
                description="커리어 한 줄 소개",
                examples=["5년차 백엔드 엔지니어"],
            ),
        ]
        | None
    ) = None
    years_experience: (
        Annotated[int, Field(ge=0, le=60, description="총 경력 연수", examples=[5])]
        | None
    ) = None
    target_roles: (
        Annotated[list[_ProfileTag], Field(max_length=20, description="희망 직무 목록")]
        | None
    ) = None
    skills: (
        Annotated[list[_ProfileTag], Field(max_length=50, description="보유 기술 목록")]
        | None
    ) = None
    locations: (
        Annotated[
            list[_ProfileTag], Field(max_length=20, description="희망 근무지 목록")
        ]
        | None
    ) = None
    salary_expectation: (
        Annotated[str, Field(max_length=200, description="희망 연봉 또는 보상 조건")]
        | None
    ) = None
    summary: (
        Annotated[str, Field(max_length=8000, description="경력 요약 및 주요 경험")]
        | None
    ) = None

    @field_validator("headline")
    @classmethod
    def normalize_headline(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip() or None

    @field_validator("target_roles", "skills", "locations", mode="before")
    @classmethod
    def drop_empty_profile_entries(cls, v: object) -> object:
        if v is None:
            return None
        if not isinstance(v, list):
            # Leave non-list input untouched so Pydantic raises a list[str] type
            # error instead of silently exploding a scalar (e.g. "Python") into
            # its characters under mode="before".
            return v
        cleaned = [item.strip() for item in v if isinstance(item, str) and item.strip()]
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

    job_id: int = Field(description="분석 대상 저장 공고 ID", examples=[101])
    company_name: str = Field(description="회사명")
    job_title: str = Field(description="직무명")
    fit_score: Annotated[
        int, Field(ge=0, le=100, description="프로필과 공고의 적합도 점수")
    ]
    matched_skills: list[str] = Field(description="프로필과 일치하는 역량")
    missing_skills: list[str] = Field(description="보완이 필요한 역량")
    deadline_urgency: DeadlineUrgency = Field(description="마감일 긴급도")
    recommended_action: str = Field(description="권장 다음 행동")
    rationale: str = Field(description="적합도와 권장 행동에 대한 근거")


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

    action_type: ProposedActionType = Field(description="제안 액션 유형")
    job_id: int = Field(description="액션 대상 저장 공고 ID", examples=[101])
    application_status: ApplicationStatus | None = Field(
        default=None, description="set_status 액션의 목표 상태"
    )
    target_group_id: str | None = Field(
        default=None, description="assign_group 액션의 목표 그룹 UUID"
    )
    memo: str | None = Field(default=None, description="save_memo 액션의 메모 내용")
    reason: str = Field(description="액션을 제안한 이유")


class ApplicationPlan(BaseModel):
    """POST /v1/agent/plan response payload AND the Agents-SDK output_type.

    Kept free of any server-only fields because it doubles as the model's required
    output contract. proposed_actions defaults to [] so the model may omit it and
    clients can always treat it as optional.
    """

    summary: str = Field(description="전체 지원 전략 요약")
    items: Annotated[
        list[PlanItem],
        Field(max_length=10, description="우선순위가 정렬된 공고별 분석"),
    ]
    proposed_actions: list[ProposedAction] = Field(
        default=[], description="사용자 확인이 필요한 후속 액션 제안"
    )


class ApplicationPlanRequest(BaseModel):
    """POST /v1/agent/plan body. Both fields optional.

    group_id omitted/null → the caller's current active group. focus is free-text
    user steering passed verbatim into the run input.
    """

    group_id: UUID | None = Field(
        default=None,
        description="분석할 구직 활동 그룹 UUID. 생략하면 현재 그룹을 사용합니다.",
    )
    focus: (
        Annotated[
            str,
            Field(
                max_length=300,
                description="전략 생성 시 반영할 사용자 요청",
                examples=["백엔드 포지션 우선"],
            ),
        ]
        | None
    ) = None


# The three tailored-artifact kinds the strategist can generate for a single posting.
ArtifactType = Literal["resume_bullets", "cover_letter", "interview_prep"]


class ArtifactRequest(BaseModel):
    """POST /v1/agent/artifact body.

    Targets exactly one saved posting. job_id is required (the artifact agent is
    tool-less — the route fetches the posting + profile server-side and bakes them
    into the run input), and it is re-verified against the caller's own postings
    before any model call. focus is optional free-text steering.
    """

    job_id: int = Field(description="지원 자료를 생성할 저장 공고 ID", examples=[101])
    artifact_type: ArtifactType = Field(description="생성할 지원 자료 유형")
    focus: (
        Annotated[
            str,
            Field(max_length=300, description="지원 자료에 반영할 사용자 요청"),
        ]
        | None
    ) = None


class ApplicationArtifact(BaseModel):
    """POST /v1/agent/artifact response payload AND the Agents-SDK output_type.

    Kept free of server-only fields because it doubles as the model's required
    output contract. content_markdown is hard-capped so a runaway generation fails
    Pydantic validation instead of reaching the client. job_id and artifact_type are
    model-echoed and therefore untrusted — the route pins both back to the verified
    request values before returning.
    """

    artifact_type: ArtifactType = Field(description="생성된 지원 자료 유형")
    job_id: int = Field(description="지원 자료의 대상 공고 ID", examples=[101])
    title: str = Field(description="지원 자료 제목")
    content_markdown: Annotated[
        str, Field(max_length=12000, description="Markdown 형식의 생성 결과 본문")
    ]
