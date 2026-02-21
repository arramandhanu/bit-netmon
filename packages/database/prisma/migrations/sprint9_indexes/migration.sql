-- Sprint 9.10: Database Query Optimization
-- Additional indexes for common query patterns

-- ─── Devices ────────────────────────────────────────────
-- Frequently filtered by status on dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_status ON devices (status);

-- Filtered by device_type in device list
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_type ON devices (device_type);

-- Filtered by polling_enabled for polling job queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_polling ON devices (polling_enabled) WHERE polling_enabled = true;

-- ─── Alert History ──────────────────────────────────────
-- Dashboard query: active alerts sorted by time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_history_state ON alert_history (state) WHERE state = 'triggered';

-- Alert history query with date range filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_history_triggered ON alert_history (triggered_at DESC);

-- Alert history filtered by severity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_history_severity ON alert_history (severity, triggered_at DESC);

-- ─── Audit Logs ─────────────────────────────────────────
-- Security page filters by action
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);

-- ─── Interfaces ─────────────────────────────────────────
-- Device detail page loads interfaces
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interfaces_device ON interfaces (device_id);

-- ─── API Keys ───────────────────────────────────────────
-- Auth guard looks up by key hash
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = true;
