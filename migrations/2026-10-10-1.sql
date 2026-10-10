-- Track the last applied Google RISC account-state event per user (H-03).
--
-- Before this change account-disabled / account-purged only set
-- is_active = FALSE and account-enabled only set it back to TRUE, so a late or
-- out-of-order account-enabled could revive JWTs and sessions minted before the
-- disable, and nothing stopped a purged account from being re-enabled.
--
-- risc_account_state / risc_account_state_at hold the state and `iat` of the
-- last account-state event applied, so the handler ignores events older than
-- that and treats 'purged' as terminal. The pair constraint keeps the two
-- columns either both set or both NULL.
--
-- The backfill derives each user's state from the existing risc_events audit
-- log (purge wins outright; otherwise the latest iat, ties to 'disabled'),
-- realigns is_active with it, and revokes sessions for non-enabled users so
-- credentials minted before an already-received disable cannot come back.
--
-- Safe to re-run: IF NOT EXISTS / duplicate_object guards, and the backfill
-- only touches rows whose risc_account_state is still NULL.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS risc_account_state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risc_account_state_at TIMESTAMPTZ;

DO $$
BEGIN
    ALTER TABLE users
        ADD CONSTRAINT chk_users_risc_account_state
        CHECK (risc_account_state IN ('enabled', 'disabled', 'purged'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE users
        ADD CONSTRAINT chk_users_risc_account_state_pair
        CHECK ((risc_account_state IS NULL) = (risc_account_state_at IS NULL));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

WITH latest AS (
    SELECT DISTINCT ON (google_id)
           google_id,
           CASE event_type
               WHEN 'https://schemas.openid.net/secevent/risc/event-type/account-enabled'
                   THEN 'enabled'
               WHEN 'https://schemas.openid.net/secevent/risc/event-type/account-disabled'
                   THEN 'disabled'
               ELSE 'purged'
           END AS state,
           issued_at
    FROM risc_events
    WHERE google_id IS NOT NULL
      AND event_type IN (
          'https://schemas.openid.net/secevent/risc/event-type/account-enabled',
          'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
          'https://schemas.openid.net/secevent/risc/event-type/account-purged'
      )
    ORDER BY google_id,
             (event_type = 'https://schemas.openid.net/secevent/risc/event-type/account-purged') DESC,
             issued_at DESC,
             (event_type = 'https://schemas.openid.net/secevent/risc/event-type/account-disabled') DESC
)
UPDATE users AS u
SET risc_account_state      = latest.state,
    risc_account_state_at   = latest.issued_at,
    is_active               = (latest.state = 'enabled'),
    auth_session_revoked_at = CASE
                                  WHEN latest.state = 'enabled' THEN u.auth_session_revoked_at
                                  ELSE NOW()
                              END,
    updated_at              = NOW()
FROM latest
WHERE u.google_id = latest.google_id
  AND u.risc_account_state IS NULL;

COMMENT ON COLUMN users.risc_account_state IS '마지막으로 적용된 RISC 계정 상태 (enabled | disabled | purged, purged는 종결 상태)';
COMMENT ON COLUMN users.risc_account_state_at IS 'risc_account_state를 만든 RISC 이벤트의 iat — 이보다 오래된 이벤트는 상태를 바꾸지 못함';

COMMIT;
