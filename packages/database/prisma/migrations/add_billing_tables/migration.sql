-- ─── SaaS Billing Tables ────────────────────────────────
-- Migration: add_billing_tables
-- Date: 2026-03-17

-- Enums
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id       SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  contact_email   VARCHAR(255) NOT NULL,
  contact_phone   VARCHAR(50),
  company         VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  plan_id              SERIAL PRIMARY KEY,
  name                 VARCHAR(100) NOT NULL UNIQUE,
  slug                 VARCHAR(100) NOT NULL UNIQUE,
  description          TEXT,
  price_monthly        INTEGER NOT NULL DEFAULT 0,
  price_yearly         INTEGER,
  currency             VARCHAR(5) NOT NULL DEFAULT 'IDR',
  max_devices          INTEGER NOT NULL DEFAULT 5,
  max_servers          INTEGER NOT NULL DEFAULT 2,
  max_url_monitors     INTEGER NOT NULL DEFAULT 3,
  max_users            INTEGER NOT NULL DEFAULT 1,
  data_retention_days  INTEGER NOT NULL DEFAULT 7,
  min_polling_interval INTEGER NOT NULL DEFAULT 600,
  features             JSONB NOT NULL DEFAULT '{}',
  is_public            BOOLEAN NOT NULL DEFAULT true,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id      SERIAL PRIMARY KEY,
  tenant_id            INTEGER NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  plan_id              INTEGER NOT NULL REFERENCES plans(plan_id) ON DELETE RESTRICT,
  status               subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at        TIMESTAMP(3),
  current_period_start TIMESTAMP(3) NOT NULL,
  current_period_end   TIMESTAMP(3) NOT NULL,
  cancelled_at         TIMESTAMP(3),
  created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  payment_id           SERIAL PRIMARY KEY,
  subscription_id      INTEGER NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
  midtrans_order_id    VARCHAR(100) NOT NULL UNIQUE,
  midtrans_trans_id    VARCHAR(100),
  snap_token           VARCHAR(255),
  snap_redirect_url    VARCHAR(512),
  amount               INTEGER NOT NULL,
  currency             VARCHAR(5) NOT NULL DEFAULT 'IDR',
  status               payment_status NOT NULL DEFAULT 'pending',
  payment_type         VARCHAR(50),
  paid_at              TIMESTAMP(3),
  raw_notification     JSONB,
  created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id           SERIAL PRIMARY KEY,
  invoice_number       VARCHAR(50) NOT NULL UNIQUE,
  tenant_id            INTEGER NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  subscription_id      INTEGER NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
  amount               INTEGER NOT NULL,
  currency             VARCHAR(5) NOT NULL DEFAULT 'IDR',
  period_start         TIMESTAMP(3) NOT NULL,
  period_end           TIMESTAMP(3) NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  paid_at              TIMESTAMP(3),
  created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);

-- Add tenant_id to users (nullable for backwards compat)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Seed default plans
INSERT INTO plans (name, slug, description, price_monthly, price_yearly, max_devices, max_servers, max_url_monitors, max_users, data_retention_days, min_polling_interval, features, sort_order)
VALUES
  ('Starter',       'starter',       'Free tier for small setups',  0,         0,          5,   2,   3,    1,   7,   600, '{"alertEmail":true}', 0),
  ('Professional',  'professional',  'For growing businesses',      499000,    4990000,    25,  10,  20,   5,   30,  300, '{"alertEmail":true,"alertTelegram":true,"ticketing":true,"mapView":true,"wireless":true,"uptimeSla":true}', 1),
  ('Business',      'business',      'Advanced features + AI',      1499000,   14990000,   100, 50,  100,  15,  90,  60,  '{"alertEmail":true,"alertTelegram":true,"alertWebhook":true,"ticketing":true,"mapView":true,"wireless":true,"uptimeSla":true,"aiAnalytics":true,"aiReports":true,"devops":true,"remoteTerminal":true,"deviceCompare":true,"auditLog":true,"apiAccess":true}', 2),
  ('Enterprise',    'enterprise',    'Unlimited everything',        3999000,   39990000,   -1,  -1,  -1,   -1,  365, 30,  '{"alertEmail":true,"alertTelegram":true,"alertWebhook":true,"ticketing":true,"mapView":true,"wireless":true,"uptimeSla":true,"aiAnalytics":true,"aiReports":true,"devops":true,"remoteTerminal":true,"deviceCompare":true,"auditLog":true,"apiAccess":true,"whiteLabel":true,"sso":true,"dedicatedInfra":true}', 3)
ON CONFLICT (slug) DO NOTHING;
