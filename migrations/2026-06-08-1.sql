-- ChatKit items: scope upsert conflicts to the owning user.
-- chatkit_items previously had only a bare `id` PRIMARY KEY, so save_item's
-- ON CONFLICT (id) DO UPDATE could overwrite another user's item if a
-- caller-controlled id collided. Add UNIQUE (id, user_id) — mirroring
-- chatkit_threads — so the upsert can target it directly: same id + same user
-- conflicts on this constraint (upsert proceeds), same id + different user
-- instead hits the `id` PRIMARY KEY and raises UniqueViolation.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chatkit_items_id_user_id_key'
          AND conrelid = 'chatkit_items'::regclass
    ) THEN
        ALTER TABLE chatkit_items
            ADD CONSTRAINT chatkit_items_id_user_id_key UNIQUE (id, user_id);
    END IF;
END
$$;
