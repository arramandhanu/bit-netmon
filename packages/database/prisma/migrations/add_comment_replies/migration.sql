-- Add parent_id column for threaded comment replies
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER;

-- Add foreign key constraint (idempotent: skip if already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_ticket_comments_parent'
           OR conname = 'ticket_comments_parent_id_fkey'
    ) THEN
        ALTER TABLE ticket_comments
            ADD CONSTRAINT fk_ticket_comments_parent
            FOREIGN KEY (parent_id) REFERENCES ticket_comments(comment_id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for parent lookups
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent ON ticket_comments(parent_id);
