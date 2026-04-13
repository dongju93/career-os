"""
DDL definitions for the career-os PostgreSQL schema.
"""

from psycopg_pool import AsyncConnectionPool

# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------

CREATE_JOB_POSTINGS_TABLE = """
CREATE TABLE IF NOT EXISTS job_postings (
    -- PK & identity
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    platform              VARCHAR(20)   NOT NULL CHECK (platform IN ('saramin', 'wanted')),
    posting_id            VARCHAR(50)   NOT NULL,
    posting_url           TEXT          NOT NULL,

    -- Strict common (required)
    company_name          VARCHAR(200)  NOT NULL,
    job_title             VARCHAR(500)  NOT NULL,
    experience_req        VARCHAR(100),
    deadline              VARCHAR(100),
    location              VARCHAR(300),

    -- General (recommended)
    employment_type       VARCHAR(50),
    job_description       TEXT,
    responsibilities      TEXT,
    qualifications        TEXT,
    preferred_points      TEXT,
    benefits              TEXT,
    hiring_process        TEXT,

    -- Platform-specific (optional)
    education_req         VARCHAR(100),
    salary                VARCHAR(200),
    tech_stack            TEXT[],
    tags                  TEXT[],
    application_method    VARCHAR(200),
    application_form      VARCHAR(200),
    contact_person        VARCHAR(100),
    homepage              VARCHAR(500),
    job_category          VARCHAR(200),
    industry              VARCHAR(200),

    -- Metadata
    scraped_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_platform_posting UNIQUE (platform, posting_id)
);
"""

CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id   VARCHAR(255)  NOT NULL,
    email       VARCHAR(255)  NOT NULL,
    name        VARCHAR(100),
    picture     VARCHAR(512),
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_google_id UNIQUE (google_id),
    CONSTRAINT uq_users_email     UNIQUE (email)
);
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_job_postings_platform
    ON job_postings (platform);

CREATE INDEX IF NOT EXISTS idx_job_postings_company
    ON job_postings (company_name);

CREATE INDEX IF NOT EXISTS idx_job_postings_deadline
    ON job_postings (deadline);

CREATE INDEX IF NOT EXISTS idx_job_postings_location
    ON job_postings (location);

CREATE INDEX IF NOT EXISTS idx_job_postings_tech_stack
    ON job_postings USING GIN (tech_stack);

CREATE INDEX IF NOT EXISTS idx_job_postings_tags
    ON job_postings USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_job_postings_scraped_at
    ON job_postings (scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_google_id
    ON users (google_id);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);
"""

CREATE_COMMENTS = """
COMMENT ON TABLE  job_postings IS '사람인·원티드 채용공고 통합 테이블';
COMMENT ON COLUMN job_postings.platform    IS '출처 플랫폼 (saramin | wanted)';
COMMENT ON COLUMN job_postings.posting_id  IS '플랫폼 내 공고 고유 ID (saramin: rec_idx, wanted: wd ID)';
COMMENT ON COLUMN job_postings.tech_stack  IS '기술스택 배열 (원티드: 별도 섹션, 사람인: 키워드 파싱)';
COMMENT ON COLUMN job_postings.tags        IS '원티드 회사 태그 배열';
COMMENT ON COLUMN job_postings.scraped_at  IS '데이터 수집 시각';

COMMENT ON TABLE  users          IS 'Google OAuth로 가입한 사용자 계정';
COMMENT ON COLUMN users.google_id IS 'Google sub claim (고유 사용자 식별자)';
COMMENT ON COLUMN users.email     IS 'Google 계정 이메일';
"""

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def init_schema(pool: AsyncConnectionPool) -> None:
    """Apply DDL to the connected database (idempotent via IF NOT EXISTS)."""
    async with pool.connection() as conn:
        await conn.execute(CREATE_JOB_POSTINGS_TABLE)
        await conn.execute(CREATE_USERS_TABLE)
        await conn.execute(CREATE_INDEXES)
        await conn.execute(CREATE_COMMENTS)
