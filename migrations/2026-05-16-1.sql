BEGIN;

-- [1] job_search_groups 테이블 생성
CREATE TABLE IF NOT EXISTS job_search_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    started_at DATE NOT NULL,
    ended_at DATE,
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_job_search_groups_dates CHECK (
        ended_at IS NULL
        OR ended_at >= started_at
    )
);

CREATE INDEX IF NOT EXISTS idx_job_search_groups_user_id ON job_search_groups (user_id, created_at DESC);

-- [2] group_id 컬럼 추가 (nullable — 백필 전이므로)
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES job_search_groups (id) ON DELETE CASCADE;

-- [3] 기존 사용자에게 초기 구직 활동 그룹 생성 (그룹이 없는 유저만)
INSERT INTO
    job_search_groups (id, user_id, name, started_at)
SELECT
    gen_random_uuid(),
    u.id,
    '첫 번째 구직 활동',
    COALESCE(MIN(p.scraped_at)::date, CURRENT_DATE)
FROM
    users u
    LEFT JOIN job_postings p ON p.user_id = u.id
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            job_search_groups g
        WHERE
            g.user_id = u.id
    )
GROUP BY
    u.id;

-- [4] 기존 job_postings에 group_id 백필
UPDATE job_postings p
SET
    group_id = g.id
FROM
    (
        SELECT DISTINCT
            ON (user_id) id,
            user_id
        FROM
            job_search_groups
        ORDER BY
            user_id,
            created_at ASC
    ) g
WHERE
    p.user_id = g.user_id
    AND p.group_id IS NULL;

-- [5] 백필 검증 — 둘 다 0이어야 COMMIT 진행
SELECT
    COUNT(*) AS users_without_group
FROM
    users u
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            job_search_groups g
        WHERE
            g.user_id = u.id
    );

SELECT
    COUNT(*) AS postings_without_group
FROM
    job_postings
WHERE
    group_id IS NULL;

-- [6] 구 unique 인덱스 삭제
DROP INDEX IF EXISTS uq_job_postings_user_id;

-- [7] NOT NULL 제약 설정
ALTER TABLE job_postings
ALTER COLUMN group_id
SET NOT NULL;

COMMIT;