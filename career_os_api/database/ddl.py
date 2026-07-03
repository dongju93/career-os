"""
DDL definitions for the career-os PostgreSQL schema.

Rule: ALTER statements are **prohibited** in this file.
  - This file manages only CREATE TABLE / CREATE INDEX / COMMENT DDL,
    all of which are idempotent via IF NOT EXISTS and safe to run at
    every startup.
  - Any change to an existing table (ADD COLUMN, DROP COLUMN, ADD
    CONSTRAINT, etc.) must be written as a one-off SQL script in
    migrations/YYYY-MM-DD-<n>.sql and run manually against production.
"""

from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from career_os_api.database.retry import run_database_operation

# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------

CREATE_JOB_POSTINGS_TABLE = """
CREATE TABLE IF NOT EXISTS job_postings (
    -- PK & identity
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               UUID   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform              TEXT   NOT NULL CHECK (platform IN ('saramin', 'wanted')),
    posting_id            TEXT   NOT NULL,
    posting_url           TEXT   NOT NULL,

    -- Strict common (required)
    company_name          TEXT   NOT NULL,
    job_title             TEXT   NOT NULL,
    experience_req        TEXT,
    deadline              TEXT,
    location              TEXT,

    -- General (recommended)
    employment_type       TEXT,
    job_description       TEXT,
    responsibilities      TEXT,
    qualifications        TEXT,
    preferred_points      TEXT,
    benefits              TEXT,
    hiring_process        TEXT,

    -- Platform-specific (optional)
    education_req         TEXT,
    salary                TEXT,
    tech_stack            TEXT[],
    tags                  TEXT[],
    application_method    TEXT,
    application_form      TEXT,
    contact_person        TEXT,
    homepage              TEXT,
    job_category          TEXT,
    industry              TEXT,

    -- Group
    group_id              UUID   NOT NULL REFERENCES job_search_groups (id) ON DELETE CASCADE,

    -- Application lifecycle
    application_status    TEXT   NOT NULL DEFAULT 'saved'
        CHECK (application_status IN
            ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
    status_updated_at     TIMESTAMPTZ,

    -- User annotation
    memo                  TEXT,

    -- Metadata
    scraped_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
"""

CREATE_JOB_SEARCH_GROUPS_TABLE = """
CREATE TABLE IF NOT EXISTS job_search_groups (
    id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        TEXT  NOT NULL,
    started_at  DATE  NOT NULL,
    ended_at    DATE,
    memo        TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_job_search_groups_dates
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_job_search_groups_user_id
    ON job_search_groups (user_id, created_at DESC);
"""

CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id   TEXT     NOT NULL,
    email       TEXT     NOT NULL,
    name        TEXT,
    picture     TEXT,
    is_active   BOOLEAN  NOT NULL DEFAULT TRUE,
    auth_session_revoked_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_google_id UNIQUE (google_id),
    CONSTRAINT uq_users_email     UNIQUE (email)
);
"""

CREATE_USER_PROFILES_TABLE = """
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id            UUID     PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    headline           TEXT,
    years_experience   SMALLINT CHECK (years_experience BETWEEN 0 AND 60),
    target_roles       TEXT[],
    skills             TEXT[],
    locations          TEXT[],
    salary_expectation TEXT,
    summary            TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
"""

CREATE_AUTH_EXCHANGE_CODES_TABLE = """
CREATE TABLE IF NOT EXISTS auth_exchange_codes (
    code        TEXT         PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_exchange_codes_expires_at
    ON auth_exchange_codes (expires_at);
"""

CREATE_RISC_EVENTS_TABLE = """
CREATE TABLE IF NOT EXISTS risc_events (
    id          BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    jti         TEXT    NOT NULL,
    event_type  TEXT    NOT NULL,
    google_id   TEXT,
    reason      TEXT,
    issued_at   TIMESTAMPTZ  NOT NULL,
    payload     JSONB        NOT NULL,
    received_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_risc_events_jti UNIQUE (jti)
);
"""

CREATE_CHATKIT_THREADS_TABLE = """
CREATE TABLE IF NOT EXISTS chatkit_threads (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       TEXT,
    status      TEXT,
    payload     JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chatkit_threads_user_updated
    ON chatkit_threads (user_id, updated_at DESC, id);
"""

CREATE_CHATKIT_ITEMS_TABLE = """
CREATE TABLE IF NOT EXISTS chatkit_items (
    id          TEXT        PRIMARY KEY,
    thread_id   TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item_type   TEXT        NOT NULL,
    payload     JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id),
    FOREIGN KEY (thread_id, user_id)
        REFERENCES chatkit_threads (id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chatkit_items_thread_created
    ON chatkit_items (thread_id, user_id, created_at, id);
"""

CREATE_INDEXES = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_postings_group_id
    ON job_postings (group_id, platform, posting_id);

CREATE INDEX IF NOT EXISTS idx_job_postings_group_id_scraped_at
    ON job_postings (group_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_postings_user_id_scraped_at
    ON job_postings (user_id, scraped_at DESC);

-- Partial index for active-status queries (list endpoint + strategist agent).
CREATE INDEX IF NOT EXISTS idx_job_postings_status_active
    ON job_postings (user_id, scraped_at DESC)
    WHERE application_status IN ('saved', 'applied', 'interviewing');

-- GIN indexes for array containment queries on job_postings and user_profiles.
CREATE INDEX IF NOT EXISTS idx_job_postings_tech_stack
    ON job_postings USING GIN (tech_stack)
    WHERE tech_stack IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_postings_tags
    ON job_postings USING GIN (tags)
    WHERE tags IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_skills
    ON user_profiles USING GIN (skills)
    WHERE skills IS NOT NULL;

-- risc_events: lookup by google_id and time-range audit queries.
CREATE INDEX IF NOT EXISTS idx_risc_events_google_id
    ON risc_events (google_id)
    WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_risc_events_received_at
    ON risc_events (received_at DESC);

-- chatkit_items: FK to users(id) ON DELETE CASCADE requires an index on
-- user_id so cascade-deletes do not scan the full table.
CREATE INDEX IF NOT EXISTS idx_chatkit_items_user_id
    ON chatkit_items (user_id);
"""

CREATE_COMMENTS = """
COMMENT ON TABLE  job_postings IS '사람인·원티드 채용공고 통합 테이블';
COMMENT ON COLUMN job_postings.user_id IS '이 공고를 저장한 사용자 ID';
COMMENT ON COLUMN job_postings.platform    IS '출처 플랫폼 (saramin | wanted)';
COMMENT ON COLUMN job_postings.posting_id  IS '플랫폼 내 공고 고유 ID (saramin: rec_idx, wanted: wd ID)';
COMMENT ON COLUMN job_postings.tech_stack  IS '기술스택 배열 (원티드: 별도 섹션, 사람인: 키워드 파싱)';
COMMENT ON COLUMN job_postings.tags        IS '원티드 회사 태그 배열';
COMMENT ON COLUMN job_postings.application_status IS '지원 진행 상태 (saved → applied → interviewing → offer/rejected/withdrawn)';
COMMENT ON COLUMN job_postings.status_updated_at  IS 'application_status가 마지막으로 변경된 시각';
COMMENT ON COLUMN job_postings.memo        IS '사용자가 공고에 남긴 자유 메모 (NULL = 메모 없음)';
COMMENT ON COLUMN job_postings.scraped_at  IS '데이터 수집 시각';

COMMENT ON TABLE  user_profiles                    IS '지원 전략 에이전트가 참조하는 사용자 커리어 프로필 (사용자당 1행)';
COMMENT ON COLUMN user_profiles.headline           IS '한 줄 자기소개/직함';
COMMENT ON COLUMN user_profiles.years_experience   IS '총 경력 연수 (0~60)';
COMMENT ON COLUMN user_profiles.target_roles       IS '희망 직무 배열';
COMMENT ON COLUMN user_profiles.skills             IS '보유 스킬 배열';
COMMENT ON COLUMN user_profiles.locations          IS '선호 근무 지역 배열';
COMMENT ON COLUMN user_profiles.salary_expectation IS '희망 연봉/처우';
COMMENT ON COLUMN user_profiles.summary            IS '자유 형식 커리어 요약 서술';

COMMENT ON TABLE  users          IS 'Google OAuth로 가입한 사용자 계정';
COMMENT ON COLUMN users.google_id IS 'Google sub claim (고유 사용자 식별자)';
COMMENT ON COLUMN users.email     IS 'Google 계정 이메일';
COMMENT ON COLUMN users.auth_session_revoked_at IS '이 시각 이전에 발급된 앱 세션/JWT를 거부하는 RISC 세션 폐기 경계';

COMMENT ON TABLE  auth_exchange_codes            IS 'OAuth 콜백 직후 발급되는 1회용 단기 코드 (세션 쿠키가 차단된 브라우저를 위한 Bearer 토큰 교환용)';
COMMENT ON COLUMN auth_exchange_codes.code       IS '무작위 생성된 1회용 교환 코드';
COMMENT ON COLUMN auth_exchange_codes.expires_at IS '이 시각 이후 코드는 교환 불가 (기본 60초 TTL)';

COMMENT ON TABLE  risc_events            IS 'Google RISC(Cross-Account Protection) Security Event Token 수신 이력';
COMMENT ON COLUMN risc_events.jti        IS 'SET JWT의 jti 클레임 (중복 전송 방지용 고유 ID)';
COMMENT ON COLUMN risc_events.event_type IS 'RISC 이벤트 타입 URI';
COMMENT ON COLUMN risc_events.google_id  IS '대상 Google 사용자 ID (subject.sub, verification 이벤트는 NULL)';
COMMENT ON COLUMN risc_events.issued_at  IS 'SET JWT의 iat (발급 시각)';
COMMENT ON COLUMN risc_events.payload    IS '검증을 통과한 SET JWT의 원본 클레임 전체';

COMMENT ON TABLE  job_search_groups          IS '사용자의 구직 활동 라운드 그룹';
COMMENT ON COLUMN job_search_groups.ended_at IS 'NULL = 진행 중; NOT NULL = 종료된 구직 활동';
COMMENT ON COLUMN job_search_groups.memo     IS '구직 활동 관련 자유 메모';
"""

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _apply_schema(conn: AsyncConnection) -> None:
    await conn.execute(CREATE_USERS_TABLE)
    await conn.execute(CREATE_AUTH_EXCHANGE_CODES_TABLE)
    await conn.execute(CREATE_USER_PROFILES_TABLE)
    await conn.execute(CREATE_JOB_SEARCH_GROUPS_TABLE)
    await conn.execute(CREATE_JOB_POSTINGS_TABLE)
    await conn.execute(CREATE_RISC_EVENTS_TABLE)
    await conn.execute(CREATE_CHATKIT_THREADS_TABLE)
    await conn.execute(CREATE_CHATKIT_ITEMS_TABLE)
    await conn.execute(CREATE_INDEXES)
    await conn.execute(CREATE_COMMENTS)


async def init_schema(pool: AsyncConnectionPool) -> None:
    """Apply DDL to the connected database (idempotent via IF NOT EXISTS)."""
    await run_database_operation(pool, _apply_schema)
