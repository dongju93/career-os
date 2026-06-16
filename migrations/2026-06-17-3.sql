-- Partial index for active-status job posting queries.
--
-- The list endpoint and strategist agent both filter by application_status.
-- A partial index covering only in-progress statuses (saved/applied/interviewing)
-- is much smaller than a full index and covers the hot read path.
--
-- Safe to re-run (IF NOT EXISTS guard).

CREATE INDEX IF NOT EXISTS idx_job_postings_status_active
    ON job_postings (user_id, scraped_at DESC)
    WHERE application_status IN ('saved', 'applied', 'interviewing');
