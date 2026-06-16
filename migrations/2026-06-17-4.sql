-- VARCHAR(n) → TEXT across all tables.
--
-- PostgreSQL stores VARCHAR and TEXT identically; this is a metadata-only
-- change with no table rewrite and no locking beyond a brief metadata lock.
-- Existing CHECK constraints (platform, application_status) are unaffected.
--
-- Safe to re-run: ALTER COLUMN TYPE to the same effective type is a no-op
-- if the column is already TEXT.

ALTER TABLE users
    ALTER COLUMN google_id TYPE TEXT,
    ALTER COLUMN email     TYPE TEXT,
    ALTER COLUMN name      TYPE TEXT,
    ALTER COLUMN picture   TYPE TEXT;

ALTER TABLE user_profiles
    ALTER COLUMN headline           TYPE TEXT,
    ALTER COLUMN salary_expectation TYPE TEXT;

ALTER TABLE job_search_groups
    ALTER COLUMN name TYPE TEXT;

ALTER TABLE job_postings
    ALTER COLUMN platform           TYPE TEXT,
    ALTER COLUMN posting_id         TYPE TEXT,
    ALTER COLUMN company_name       TYPE TEXT,
    ALTER COLUMN job_title          TYPE TEXT,
    ALTER COLUMN experience_req     TYPE TEXT,
    ALTER COLUMN deadline           TYPE TEXT,
    ALTER COLUMN location           TYPE TEXT,
    ALTER COLUMN employment_type    TYPE TEXT,
    ALTER COLUMN education_req      TYPE TEXT,
    ALTER COLUMN salary             TYPE TEXT,
    ALTER COLUMN application_method TYPE TEXT,
    ALTER COLUMN application_form   TYPE TEXT,
    ALTER COLUMN contact_person     TYPE TEXT,
    ALTER COLUMN homepage           TYPE TEXT,
    ALTER COLUMN job_category       TYPE TEXT,
    ALTER COLUMN industry           TYPE TEXT,
    ALTER COLUMN application_status TYPE TEXT;

ALTER TABLE risc_events
    ALTER COLUMN jti        TYPE TEXT,
    ALTER COLUMN event_type TYPE TEXT,
    ALTER COLUMN google_id  TYPE TEXT,
    ALTER COLUMN reason     TYPE TEXT;
