-- Enforce years_experience range (0–60) documented in column comment.
--
-- PostgreSQL CHECK treats NULL as passing (three-valued logic), so NULL
-- values are still allowed for users who haven't filled in their profile.
-- The constraint only rejects values outside 0–60.
--
-- ADD CONSTRAINT requires a full table scan of user_profiles to validate
-- existing rows. Safe on a small table; run during low-traffic window if
-- the table is large.
--
-- IF NOT EXISTS guard (PG15+ syntax) makes this safe to re-run.

ALTER TABLE user_profiles
    ADD CONSTRAINT IF NOT EXISTS chk_user_profiles_years_experience
    CHECK (years_experience BETWEEN 0 AND 60);
