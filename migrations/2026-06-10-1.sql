-- Phase 0: Application lifecycle columns on job_postings.
-- The production table predates these columns; this script adds them
-- with IF NOT EXISTS guards so it is safe to re-run.
-- ADD COLUMN with a constant default is metadata-only on modern Postgres
-- (no table rewrite) and therefore safe on Neon.
--
-- These columns are also present inline in CREATE_JOB_POSTINGS_TABLE
-- (career_os_api/database/ddl.py) for fresh-database creation.

ALTER TABLE job_postings
    ADD COLUMN IF NOT EXISTS application_status VARCHAR(20)
        NOT NULL DEFAULT 'saved'
        CHECK (application_status IN
            ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
    ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN job_postings.application_status IS '지원 진행 상태 (saved → applied → interviewing → offer/rejected/withdrawn)';
COMMENT ON COLUMN job_postings.status_updated_at  IS 'application_status가 마지막으로 변경된 시각';
