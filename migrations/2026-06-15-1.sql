-- Phase 2: user memo column on job_postings.
-- The production table predates this column; this script adds it with an
-- IF NOT EXISTS guard so it is safe to re-run.
-- ADD COLUMN with no default is metadata-only (no table rewrite) and safe on Neon.
--
-- This column is also present inline in CREATE_JOB_POSTINGS_TABLE
-- (career_os_api/database/ddl.py) for fresh-database creation.
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS memo TEXT;

COMMENT ON COLUMN job_postings.memo IS '사용자가 공고에 남긴 자유 메모 (NULL = 메모 없음)';