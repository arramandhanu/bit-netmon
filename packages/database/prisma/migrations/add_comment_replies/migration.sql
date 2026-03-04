-- Add parent_id column for threaded comment replies
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER;

-- Add foreign key constraint
ALTER TABLE ticket_comments
    ADD CONSTRAINT fk_ticket_comments_parent
    FOREIGN KEY (parent_id) REFERENCES ticket_comments(comment_id)
    ON DELETE SET NULL;

-- Add index for parent lookups
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent ON ticket_comments(parent_id);
