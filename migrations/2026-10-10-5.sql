-- Guard the RISC payload alteration for recovery/replay after 2026-10-10-4.sql.
-- Migrations 2026-10-10-1.sql through 2026-10-10-4.sql are already applied
-- and remain unchanged. Use this script instead of replaying 2026-10-10-3.sql,
-- whose unconditional payload alteration fails after the column is dropped.
--
-- If payload still exists, allow NULL; otherwise skip its alteration. Repeat
-- the purge erasure and audit unlinking from 2026-10-10-3.sql for recovery.
-- Safe to re-run: the column guard handles upgraded/fresh schemas, and the
-- erasure only matches rows still marked 'purged'.
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'risc_events'::regclass
          AND attname = 'payload'
          AND NOT attisdropped
    ) THEN
        ALTER TABLE risc_events
            ALTER COLUMN payload DROP NOT NULL;
    END IF;
END
$$;

WITH
    purged AS (
        DELETE FROM users
        WHERE
            risc_account_state = 'purged' RETURNING google_id
    )
UPDATE risc_events
SET
    google_id = NULL
WHERE
    google_id IN (
        SELECT
            google_id
        FROM
            purged
    );

COMMIT;
