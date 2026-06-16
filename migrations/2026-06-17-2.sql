-- GIN indexes for array columns used in containment/overlap queries.
--
-- job_postings.tech_stack, tags: chatkit search tool and strategist agent
--   may filter by skill/tag overlap; ILIKE on array_to_string() cannot use
--   any index. GIN enables @>, &&, <@ operators.
-- user_profiles.skills: strategist fit-scoring queries.
--
-- Partial (WHERE IS NOT NULL) to skip rows where the array is NULL,
-- keeping the index small.
--
-- Safe to re-run (IF NOT EXISTS guards).

CREATE INDEX IF NOT EXISTS idx_job_postings_tech_stack
    ON job_postings USING GIN (tech_stack)
    WHERE tech_stack IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_postings_tags
    ON job_postings USING GIN (tags)
    WHERE tags IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_skills
    ON user_profiles USING GIN (skills)
    WHERE skills IS NOT NULL;
