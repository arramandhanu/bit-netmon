-- CreateEnum
CREATE TYPE "server_type" AS ENUM ('linux', 'windows');

-- CreateTable
CREATE TABLE "server_monitors" (
    "server_id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "server_type" "server_type" NOT NULL,
    "ip_address" VARCHAR(45),
    "hostname" VARCHAR(255),
    "os_info" VARCHAR(500),
    "agent_token" VARCHAR(255) NOT NULL,
    "agent_version" VARCHAR(50),
    "agent_interval" INTEGER NOT NULL DEFAULT 300,
    "status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "last_reported_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "monitor_options" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_monitors_pkey" PRIMARY KEY ("server_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_monitors_agent_token_key" ON "server_monitors"("agent_token");
CREATE INDEX "idx_server_monitors_status" ON "server_monitors"("status");
CREATE INDEX "idx_server_monitors_token" ON "server_monitors"("agent_token");

-- CreateTable: server_metrics TimescaleDB hypertable
CREATE TABLE server_metrics (
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_id       INT NOT NULL,
    cpu_user        DOUBLE PRECISION,
    cpu_system      DOUBLE PRECISION,
    cpu_load1       DOUBLE PRECISION,
    cpu_load5       DOUBLE PRECISION,
    cpu_load15      DOUBLE PRECISION,
    cpu_cores       INT,
    mem_total       BIGINT,
    mem_used        BIGINT,
    mem_percent     DOUBLE PRECISION,
    swap_total      BIGINT,
    swap_used       BIGINT,
    disk_json       JSONB,
    disk_io_json    JSONB,
    net_json        JSONB,
    processes_json  JSONB,
    uptime_seconds  BIGINT
);

SELECT create_hypertable('server_metrics', 'time');
CREATE INDEX idx_server_metrics_server ON server_metrics (server_id, time DESC);
