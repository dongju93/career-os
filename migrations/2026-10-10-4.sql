-- Finish RISC data minimization (M-07) — run AFTER the backend that no longer
-- writes risc_events.payload or users.risc_account_state = 'purged' is live.
--
-- Drops the raw SET payload, which held token prefixes and stream metadata
-- the handler never reads, and narrows the account-state CHECK now that
-- account-purged deletes the user instead of storing a 'purged' state.
--
-- The erasure from 2026-10-10-3.sql is repeated first so an account the
-- previous release marked 'purged' between the two scripts cannot block the
-- narrowed constraint or linger with its data.
--
-- Safe to re-run: IF EXISTS guards; the CHECK is dropped and re-added.
BEGIN;

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

ALTER TABLE risc_events
DROP COLUMN IF EXISTS payload;

ALTER TABLE users
DROP CONSTRAINT IF EXISTS chk_users_risc_account_state;

ALTER TABLE users ADD CONSTRAINT chk_users_risc_account_state CHECK (risc_account_state IN ('enabled', 'disabled'));

COMMENT ON TABLE risc_events IS 'Google RISC(Cross-Account Protection) Security Event Token 수신 이력 (처리에 필요한 클레임만 저장, RISC_EVENT_RETENTION_DAYS 경과 시 삭제)';

COMMENT ON COLUMN risc_events.google_id IS '대상 Google 사용자 ID (subject.sub, verification 이벤트 또는 purge로 익명화된 행은 NULL)';

COMMENT ON COLUMN users.risc_account_state IS '마지막으로 적용된 RISC 계정 상태 (enabled | disabled). account-purged는 상태가 아니라 사용자 행과 소유 데이터를 삭제함';

COMMIT;