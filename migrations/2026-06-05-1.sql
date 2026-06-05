-- ChatKit text chat: per-user threads and items.
-- Mirrors career_os_api/database/ddl.py (CREATE_CHATKIT_THREADS_TABLE /
-- CREATE_CHATKIT_ITEMS_TABLE). ddl.py remains the authoritative live schema; this
-- script exists so the tables can also be applied manually against production.

CREATE TABLE IF NOT EXISTS chatkit_threads (
    id          TEXT        PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       TEXT,
    status      TEXT,
    payload     JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chatkit_threads_user_updated
    ON chatkit_threads (user_id, updated_at DESC, id);

CREATE TABLE IF NOT EXISTS chatkit_items (
    id          TEXT        PRIMARY KEY,
    thread_id   TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    item_type   TEXT        NOT NULL,
    payload     JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (thread_id, user_id)
        REFERENCES chatkit_threads (id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chatkit_items_thread_created
    ON chatkit_items (thread_id, user_id, created_at, id);
