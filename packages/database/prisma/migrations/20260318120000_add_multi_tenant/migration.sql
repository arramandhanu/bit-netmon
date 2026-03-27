-- Multi-Tenant Migration
-- Create billing & tenant tables, then add tenantId columns to existing tables

-- Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('trial','active','past_due','suspended','cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending','paid','failed','expired','refunded');
    END IF;
END$$;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    company VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
    plan_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price_monthly INTEGER DEFAULT 0,
    price_yearly INTEGER,
    currency VARCHAR(5) DEFAULT 'IDR',
    max_devices INTEGER DEFAULT 5,
    max_servers INTEGER DEFAULT 2,
    max_url_monitors INTEGER DEFAULT 3,
    max_users INTEGER DEFAULT 1,
    data_retention_days INTEGER DEFAULT 7,
    min_polling_interval INTEGER DEFAULT 600,
    features JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(plan_id) ON DELETE RESTRICT,
    status subscription_status DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
    midtrans_order_id VARCHAR(100) NOT NULL UNIQUE,
    midtrans_trans_id VARCHAR(100),
    snap_token VARCHAR(255),
    snap_redirect_url VARCHAR(512),
    amount INTEGER NOT NULL,
    currency VARCHAR(5) DEFAULT 'IDR',
    status payment_status DEFAULT 'pending',
    payment_type VARCHAR(50),
    paid_at TIMESTAMPTZ,
    raw_notification JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    currency VARCHAR(5) DEFAULT 'IDR',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
DO $$
BEGIN
    -- Users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
        ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified') THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='verification_token') THEN
        ALTER TABLE users ADD COLUMN verification_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='verification_expires') THEN
        ALTER TABLE users ADD COLUMN verification_expires TIMESTAMPTZ;
    END IF;

    -- Devices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='tenant_id') THEN
        ALTER TABLE devices ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;

    -- Locations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='locations' AND column_name='tenant_id') THEN
        ALTER TABLE locations ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;

    -- Server Monitors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='server_monitors' AND column_name='tenant_id') THEN
        ALTER TABLE server_monitors ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;

    -- URL Monitors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='url_monitors' AND column_name='tenant_id') THEN
        ALTER TABLE url_monitors ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;

    -- Device Groups
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_groups' AND column_name='tenant_id') THEN
        ALTER TABLE device_groups ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;

    -- Alert Rules
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alert_rules' AND column_name='tenant_id') THEN
        ALTER TABLE alert_rules ADD COLUMN tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;
END$$;

-- Create TenantInvitation table
CREATE TABLE IF NOT EXISTS tenant_invitations (
    invitation_id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    invited_by_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_server_monitors_tenant ON server_monitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_url_monitors_tenant ON url_monitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_groups_tenant ON device_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON tenant_invitations(token);
