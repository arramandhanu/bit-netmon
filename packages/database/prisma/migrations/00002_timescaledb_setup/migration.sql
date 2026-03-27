-- ══════════════════════════════════════════════════════════
-- TimescaleDB Hypertables for Network Monitoring Metrics
-- ══════════════════════════════════════════════════════════
-- Run AFTER Prisma init migration. Requires TimescaleDB extension.
-- ══════════════════════════════════════════════════════════

-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ─── Device Metrics ─────────────────────────────────────────
-- One row per device per poll cycle (CPU, memory, uptime, response time)

CREATE TABLE IF NOT EXISTS device_metrics (
    time              TIMESTAMPTZ NOT NULL,
    device_id         INTEGER     NOT NULL,
    cpu_utilization   REAL,                     -- percentage 0-100
    memory_used       BIGINT,                   -- bytes
    memory_total      BIGINT,                   -- bytes
    memory_percent    REAL,                     -- percentage 0-100
    uptime            BIGINT,                   -- timeticks (1/100th second)
    response_time_ms  INTEGER,                  -- SNMP round-trip in ms
    device_status     VARCHAR(20) DEFAULT 'up'  -- up/down/warning
);

-- Convert to hypertable (partition by time, 1-day chunks)
SELECT create_hypertable(
    'device_metrics',
    'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_metrics_device_time
    ON device_metrics (device_id, time DESC);

-- ─── Interface Metrics ──────────────────────────────────────
-- One row per interface per poll cycle (bandwidth, errors)

CREATE TABLE IF NOT EXISTS interface_metrics (
    time              TIMESTAMPTZ NOT NULL,
    device_id         INTEGER     NOT NULL,
    interface_id      INTEGER     NOT NULL,    -- references interfaces.interface_id
    if_index          INTEGER     NOT NULL,
    in_octets         BIGINT      DEFAULT 0,   -- cumulative counter
    out_octets        BIGINT      DEFAULT 0,   -- cumulative counter
    in_errors         BIGINT      DEFAULT 0,
    out_errors        BIGINT      DEFAULT 0,
    in_bps            BIGINT      DEFAULT 0,   -- calculated bits/sec
    out_bps           BIGINT      DEFAULT 0,   -- calculated bits/sec
    in_utilization    REAL        DEFAULT 0,   -- percentage 0-100
    out_utilization   REAL        DEFAULT 0,   -- percentage 0-100
    oper_status       VARCHAR(20) DEFAULT 'up'
);

-- Convert to hypertable
SELECT create_hypertable(
    'interface_metrics',
    'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interface_metrics_device_time
    ON interface_metrics (device_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_interface_metrics_iface_time
    ON interface_metrics (interface_id, time DESC);

-- ─── Compression Policies ───────────────────────────────────
-- Compress data older than 7 days to save storage

ALTER TABLE device_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('device_metrics', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE interface_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id, interface_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('interface_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- ─── Retention Policies ─────────────────────────────────────
-- Drop raw data older than 90 days (adjust as needed)

SELECT add_retention_policy('device_metrics', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('interface_metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- ─── Continuous Aggregates (hourly rollups) ─────────────────
-- Pre-compute hourly averages for dashboard performance

CREATE MATERIALIZED VIEW IF NOT EXISTS device_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    AVG(cpu_utilization)  AS avg_cpu,
    MAX(cpu_utilization)  AS max_cpu,
    AVG(memory_percent)   AS avg_memory_percent,
    MAX(memory_percent)   AS max_memory_percent,
    AVG(response_time_ms) AS avg_response_time,
    MAX(response_time_ms) AS max_response_time,
    COUNT(*)              AS sample_count
FROM device_metrics
GROUP BY bucket, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('device_metrics_hourly',
    start_offset    => INTERVAL '3 hours',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists   => TRUE
);

CREATE MATERIALIZED VIEW IF NOT EXISTS interface_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    interface_id,
    AVG(in_bps)           AS avg_in_bps,
    MAX(in_bps)           AS max_in_bps,
    AVG(out_bps)          AS avg_out_bps,
    MAX(out_bps)          AS max_out_bps,
    AVG(in_utilization)   AS avg_in_util,
    MAX(in_utilization)   AS max_in_util,
    AVG(out_utilization)  AS avg_out_util,
    MAX(out_utilization)  AS max_out_util,
    SUM(in_errors)        AS total_in_errors,
    SUM(out_errors)       AS total_out_errors,
    COUNT(*)              AS sample_count
FROM interface_metrics
GROUP BY bucket, device_id, interface_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('interface_metrics_hourly',
    start_offset    => INTERVAL '3 hours',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists   => TRUE
);
