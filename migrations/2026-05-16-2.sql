-- job_postings
DROP INDEX IF EXISTS idx_job_postings_platform;

DROP INDEX IF EXISTS idx_job_postings_company;

DROP INDEX IF EXISTS idx_job_postings_deadline;

DROP INDEX IF EXISTS idx_job_postings_location;

DROP INDEX IF EXISTS idx_job_postings_tech_stack;

DROP INDEX IF EXISTS idx_job_postings_tags;

DROP INDEX IF EXISTS idx_job_postings_scraped_at;

-- users (UNIQUE constraints already provide equivalent indexes)
DROP INDEX IF EXISTS idx_users_google_id;

DROP INDEX IF EXISTS idx_users_email;

-- risc_events (no read queries exist)
DROP INDEX IF EXISTS idx_risc_events_google_id;

DROP INDEX IF EXISTS idx_risc_events_event_type;

DROP INDEX IF EXISTS idx_risc_events_received_at;