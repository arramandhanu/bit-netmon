-- Create uptime_records hypertable for tracking device up/down status over time
CREATE TABLE IF NOT EXISTS uptime_records (
  time             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  device_id        INT           NOT NULL,
  status           VARCHAR(10)   NOT NULL,  -- 'up' or 'down'
  response_time_ms INT,
  check_type       VARCHAR(20)   DEFAULT 'snmp'  -- 'snmp', 'icmp', 'http'
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('uptime_records', 'time', if_not_exists => TRUE);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_uptime_device_time ON uptime_records (device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_status ON uptime_records (status, time DESC);

-- Create url_monitors table for Web/API URL monitoring
CREATE TABLE IF NOT EXISTS url_monitors (
  url_monitor_id   SERIAL        PRIMARY KEY,
  name             VARCHAR(255)  NOT NULL,
  url              VARCHAR(2048) NOT NULL,
  method           VARCHAR(10)   DEFAULT 'GET',
  expected_status  INT           DEFAULT 200,
  check_interval   INT           DEFAULT 300,  -- seconds
  timeout          INT           DEFAULT 30000, -- ms
  headers          JSONB,
  body             TEXT,
  enabled          BOOLEAN       DEFAULT true,
  status           VARCHAR(20)   DEFAULT 'unknown',  -- up, down, unknown
  last_checked_at  TIMESTAMPTZ,
  last_response_ms INT,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- Create url_check_results hypertable for URL monitoring history
CREATE TABLE IF NOT EXISTS url_check_results (
  time           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  monitor_id     INT NOT NULL,
  status_code    INT,
  response_ms    INT,
  is_up          BOOLEAN NOT NULL,
  error_message  TEXT
);

SELECT create_hypertable('url_check_results', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_url_checks_monitor_time ON url_check_results (monitor_id, time DESC);
