-- ──────────────────────────────────────────────────────────
-- TimescaleDB Hypertable Setup
-- ──────────────────────────────────────────────────────────
-- Run AFTER Prisma migrations. This creates the time-series
-- tables that Prisma doesn't manage, plus compression and
-- retention policies.
-- ──────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ─── Interface Metrics ──────────────────────────────────

CREATE TABLE IF NOT EXISTS interface_metrics (
    time          TIMESTAMPTZ NOT NULL,
    device_id     INT         NOT NULL,
    interface_id  INT         NOT NULL,
    in_octets     BIGINT,
    out_octets    BIGINT,
    in_errors     INT         DEFAULT 0,
    out_errors    INT         DEFAULT 0,
    in_bw_util    REAL,
    out_bw_util   REAL
);

SELECT create_hypertable(
    'interface_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_if_metrics_device
    ON interface_metrics (device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_if_metrics_interface
    ON interface_metrics (interface_id, time DESC);

ALTER TABLE interface_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id, interface_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('interface_metrics', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('interface_metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- ─── Device Metrics ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_metrics (
    time          TIMESTAMPTZ NOT NULL,
    device_id     INT         NOT NULL,
    cpu_usage     REAL,
    memory_used   BIGINT,
    memory_total  BIGINT,
    memory_usage  REAL,
    temperature   REAL,
    uptime        BIGINT
);

SELECT create_hypertable(
    'device_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_dev_metrics_device
    ON device_metrics (device_id, time DESC);

ALTER TABLE device_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('device_metrics', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('device_metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- ─── Wireless Metrics ───────────────────────────────────

CREATE TABLE IF NOT EXISTS wireless_metrics (
    time            TIMESTAMPTZ NOT NULL,
    device_id       INT         NOT NULL,
    interface_id    INT,
    client_count    INT         DEFAULT 0,
    channel         INT,
    noise_floor     INT,
    channel_util    REAL
);

SELECT create_hypertable(
    'wireless_metrics', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_wireless_device
    ON wireless_metrics (device_id, time DESC);

ALTER TABLE wireless_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('wireless_metrics', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('wireless_metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- ─── Continuous Aggregates (Hourly Rollups) ─────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS interface_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    interface_id,
    SUM(in_octets)       AS total_in_octets,
    SUM(out_octets)      AS total_out_octets,
    AVG(in_bw_util)      AS avg_in_util,
    AVG(out_bw_util)     AS avg_out_util,
    MAX(in_bw_util)      AS peak_in_util,
    MAX(out_bw_util)     AS peak_out_util,
    SUM(in_errors)       AS total_in_errors,
    SUM(out_errors)      AS total_out_errors
FROM interface_metrics
GROUP BY bucket, device_id, interface_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('interface_metrics_hourly',
    start_offset    => INTERVAL '3 hours',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists   => TRUE
);

CREATE MATERIALIZED VIEW IF NOT EXISTS device_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    device_id,
    AVG(cpu_usage)       AS avg_cpu,
    MAX(cpu_usage)       AS peak_cpu,
    AVG(memory_usage)    AS avg_memory,
    MAX(memory_usage)    AS peak_memory,
    AVG(temperature)     AS avg_temp,
    MAX(temperature)     AS peak_temp,
    MAX(uptime)          AS max_uptime
FROM device_metrics
GROUP BY bucket, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('device_metrics_hourly',
    start_offset    => INTERVAL '3 hours',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists   => TRUE
);

-- ─── Daily Aggregates ───────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS interface_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    device_id,
    interface_id,
    SUM(in_octets)       AS total_in_octets,
    SUM(out_octets)      AS total_out_octets,
    AVG(in_bw_util)      AS avg_in_util,
    AVG(out_bw_util)     AS avg_out_util,
    MAX(in_bw_util)      AS peak_in_util,
    MAX(out_bw_util)     AS peak_out_util
FROM interface_metrics
GROUP BY bucket, device_id, interface_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('interface_metrics_daily',
    start_offset    => INTERVAL '3 days',
    end_offset      => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists   => TRUE
);

CREATE MATERIALIZED VIEW IF NOT EXISTS device_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    device_id,
    AVG(cpu_usage)       AS avg_cpu,
    MAX(cpu_usage)       AS peak_cpu,
    AVG(memory_usage)    AS avg_memory,
    MAX(memory_usage)    AS peak_memory,
    AVG(temperature)     AS avg_temp,
    MAX(temperature)     AS peak_temp
FROM device_metrics
GROUP BY bucket, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('device_metrics_daily',
    start_offset    => INTERVAL '3 days',
    end_offset      => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists   => TRUE
);
