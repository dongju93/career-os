-- Prepare for RISC data minimization and purge erasure (M-07) — run BEFORE
-- deploying the backend that stops writing risc_events.payload.
--
-- The new backend no longer inserts the raw SET payload, so the column must
-- accept NULL before it ships; the previous release still writes it, so the
-- column itself is dropped only afterwards, in 2026-10-10-4.sql.
--
-- account-purged now deletes the user row (ON DELETE CASCADE removes profile,
-- groups, postings, and ChatKit threads/items) instead of storing the terminal
-- 'purged' state. Accounts already purged under the old behavior are erased
-- here, and their audit rows are unlinked from the Google ID. The new backend
-- no longer treats 'purged' as terminal, so these rows must be gone first.
--
-- Safe to re-run: DROP NOT NULL is idempotent and the erasure only matches
-- rows still marked 'purged'.
BEGIN;

ALTER TABLE risc_events
ALTER COLUMN payload
DROP NOT NULL;

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