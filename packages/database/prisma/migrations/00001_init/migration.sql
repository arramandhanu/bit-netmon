-- ──────────────────────────────────────────────────────────
-- NetMon — Initial Migration (Baseline)
-- ──────────────────────────────────────────────────────────
-- Creates all Prisma-managed tables, enums, indexes, and
-- foreign keys. TimescaleDB hypertables are handled in a
-- separate migration (00002_timescaledb_setup).
-- ──────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "device_type" AS ENUM ('router', 'switch', 'access_point', 'firewall', 'server', 'unknown');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('up', 'down', 'warning', 'maintenance', 'unknown');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "alert_state" AS ENUM ('triggered', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('open', 'in_progress', 'waiting', 'escalated', 'on_hold', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ticket_category" AS ENUM ('incident', 'problem', 'change_request', 'maintenance');

-- CreateTable
CREATE TABLE "locations" (
    "location_id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "province" VARCHAR(100),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "device_id" SERIAL NOT NULL,
    "hostname" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "display_name" VARCHAR(255),
    "device_type" "device_type" NOT NULL DEFAULT 'unknown',
    "vendor" VARCHAR(100),
    "model" VARCHAR(100),
    "os_version" VARCHAR(255),
    "serial_number" VARCHAR(100),
    "sys_object_id" VARCHAR(255),
    "status" "device_status" NOT NULL DEFAULT 'unknown',
    "uptime" BIGINT DEFAULT 0,
    "snmp_version" VARCHAR(10) NOT NULL DEFAULT 'v2c',
    "snmp_port" INTEGER NOT NULL DEFAULT 161,
    "snmp_community" VARCHAR(512),
    "snmp_v3_user" VARCHAR(255),
    "snmp_v3_auth_proto" VARCHAR(10),
    "snmp_v3_auth_pass" VARCHAR(512),
    "snmp_v3_priv_proto" VARCHAR(10),
    "snmp_v3_priv_pass" VARCHAR(512),
    "polling_enabled" BOOLEAN NOT NULL DEFAULT true,
    "polling_interval" INTEGER NOT NULL DEFAULT 300,
    "last_polled_at" TIMESTAMP(3),
    "last_discovered_at" TIMESTAMP(3),
    "location_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "interfaces" (
    "interface_id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "if_index" INTEGER NOT NULL,
    "if_name" VARCHAR(255),
    "if_descr" VARCHAR(255),
    "if_alias" VARCHAR(255),
    "if_type" VARCHAR(50),
    "if_speed" BIGINT DEFAULT 0,
    "if_high_speed" BIGINT DEFAULT 0,
    "if_phys_address" VARCHAR(50),
    "if_admin_status" VARCHAR(20) DEFAULT 'up',
    "if_oper_status" VARCHAR(20) DEFAULT 'up',
    "polling_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interfaces_pkey" PRIMARY KEY ("interface_id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "rule_id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "metric_name" VARCHAR(100) NOT NULL,
    "condition" VARCHAR(10) NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "severity" "alert_severity" NOT NULL DEFAULT 'warning',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify_channels" TEXT[],
    "device_group_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "alert_history" (
    "alert_id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "state" "alert_state" NOT NULL DEFAULT 'triggered',
    "message" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" INTEGER,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("alert_id")
);

-- CreateTable
CREATE TABLE "device_groups" (
    "group_id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_groups_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "device_group_members" (
    "group_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,

    CONSTRAINT "device_group_members_pkey" PRIMARY KEY ("group_id","device_id")
);

-- CreateTable
CREATE TABLE "polling_jobs" (
    "job_id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "job_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polling_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255),
    "role" "user_role" NOT NULL DEFAULT 'viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "totp_secret" VARCHAR(255),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" INTEGER,
    "details" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "api_key_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "prefix" VARCHAR(12) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("api_key_id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "ticket_id" SERIAL NOT NULL,
    "ticket_number" VARCHAR(20) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'open',
    "priority" "ticket_priority" NOT NULL DEFAULT 'medium',
    "category" "ticket_category" NOT NULL DEFAULT 'incident',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "device_id" INTEGER,
    "alert_id" INTEGER,
    "creator_id" INTEGER NOT NULL,
    "assignee_id" INTEGER,
    "due_date" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("ticket_id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "comment_id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "attachment_id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_path" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "devices_hostname_key" ON "devices"("hostname");

-- CreateIndex
CREATE INDEX "idx_devices_location" ON "devices"("location_id");

-- CreateIndex
CREATE INDEX "idx_devices_status" ON "devices"("status");

-- CreateIndex
CREATE INDEX "idx_devices_type" ON "devices"("device_type");

-- CreateIndex
CREATE INDEX "idx_devices_ip" ON "devices"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "uq_device_ifindex" ON "interfaces"("device_id", "if_index");

-- CreateIndex
CREATE INDEX "idx_interfaces_device" ON "interfaces"("device_id");

-- CreateIndex
CREATE INDEX "idx_interfaces_status" ON "interfaces"("if_oper_status");

-- CreateIndex
CREATE INDEX "idx_alerts_device_time" ON "alert_history"("device_id", "triggered_at");

-- CreateIndex
CREATE INDEX "idx_alerts_state" ON "alert_history"("state");

-- CreateIndex
CREATE INDEX "idx_alerts_severity" ON "alert_history"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "device_groups_name_key" ON "device_groups"("name");

-- CreateIndex
CREATE INDEX "idx_polling_jobs_device" ON "polling_jobs"("device_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "idx_settings_category" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "idx_api_keys_prefix" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "idx_api_keys_user" ON "api_keys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "idx_tickets_status" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "idx_tickets_priority" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "idx_tickets_assignee" ON "tickets"("assignee_id");

-- CreateIndex
CREATE INDEX "idx_tickets_device" ON "tickets"("device_id");

-- CreateIndex
CREATE INDEX "idx_tickets_creator" ON "tickets"("creator_id");

-- CreateIndex
CREATE INDEX "idx_tickets_created" ON "tickets"("created_at");

-- CreateIndex
CREATE INDEX "idx_ticket_comments_ticket" ON "ticket_comments"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ticket_comments_parent" ON "ticket_comments"("parent_id");

-- CreateIndex
CREATE INDEX "idx_ticket_attachments_ticket" ON "ticket_attachments"("ticket_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interfaces" ADD CONSTRAINT "interfaces_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_device_group_id_fkey" FOREIGN KEY ("device_group_id") REFERENCES "device_groups"("group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("rule_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_group_members" ADD CONSTRAINT "device_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "device_groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_group_members" ADD CONSTRAINT "device_group_members_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polling_jobs" ADD CONSTRAINT "polling_jobs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alert_history"("alert_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ticket_comments"("comment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id") ON DELETE CASCADE ON UPDATE CASCADE;
