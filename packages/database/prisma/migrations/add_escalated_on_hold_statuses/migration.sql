-- Add escalated and on_hold values to ticket_status enum
-- These support ITIL/ITSM operations workflows:
--   escalated = raised to higher-level support (L2/L3)
--   on_hold   = intentionally paused (e.g. maintenance window)

ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'escalated';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'on_hold';
