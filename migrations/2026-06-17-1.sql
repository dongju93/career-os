-- Missing FK/lookup indexes on risc_events and chatkit_items.
--
-- risc_events.google_id: looked up in apply_risc_event(); no index means
--   a seq scan on every RISC event received.
-- risc_events.received_at: audit/time-range queries.
-- chatkit_items.user_id: FK to users(id) ON DELETE CASCADE. PostgreSQL does
--   not auto-index FK columns; a cascade-delete of any user causes a full
--   table scan of chatkit_items without this index.
--
-- Safe to re-run (IF NOT EXISTS guards).

CREATE INDEX IF NOT EXISTS idx_risc_events_google_id
    ON risc_events (google_id)
    WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_risc_events_received_at
    ON risc_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatkit_items_user_id
    ON chatkit_items (user_id);
