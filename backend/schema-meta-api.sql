-- Schema for Meta WhatsApp Cloud API support
-- Adds 'meta' provider and required fields for Meta Business API

-- Add meta-specific columns to connections
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'connections' AND column_name = 'meta_token'
    ) THEN
        ALTER TABLE connections ADD COLUMN meta_token TEXT;
        COMMENT ON COLUMN connections.meta_token IS 'Meta WhatsApp Cloud API permanent token';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'connections' AND column_name = 'meta_phone_number_id'
    ) THEN
        ALTER TABLE connections ADD COLUMN meta_phone_number_id VARCHAR(100);
        COMMENT ON COLUMN connections.meta_phone_number_id IS 'Meta Phone Number ID';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'connections' AND column_name = 'meta_waba_id'
    ) THEN
        ALTER TABLE connections ADD COLUMN meta_waba_id VARCHAR(100);
        COMMENT ON COLUMN connections.meta_waba_id IS 'WhatsApp Business Account ID';
    END IF;
END $$;

-- Update provider constraint to allow 'meta'
DO $$
BEGIN
    -- Drop existing constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'connections_provider_chk'
    ) THEN
        ALTER TABLE connections DROP CONSTRAINT connections_provider_chk;
    END IF;

    ALTER TABLE connections
    ADD CONSTRAINT connections_provider_chk
    CHECK (provider IN ('evolution', 'wapi', 'meta'));

    -- Drop and re-create required fields constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'connections_provider_required_fields_chk'
    ) THEN
        ALTER TABLE connections DROP CONSTRAINT connections_provider_required_fields_chk;
    END IF;

    ALTER TABLE connections
    ADD CONSTRAINT connections_provider_required_fields_chk
    CHECK (
        (provider = 'wapi' AND wapi_token IS NOT NULL)
        OR (provider = 'evolution' AND api_url IS NOT NULL AND api_key IS NOT NULL AND instance_name IS NOT NULL)
        OR (provider = 'meta' AND meta_token IS NOT NULL AND meta_phone_number_id IS NOT NULL AND meta_waba_id IS NOT NULL)
    );
END $$;

-- Meta message templates cache table
CREATE TABLE IF NOT EXISTS meta_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    meta_template_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'pt_BR',
    category VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDING',
    components JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_meta_templates_connection ON meta_message_templates(connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_templates_org ON meta_message_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_meta_templates_status ON meta_message_templates(status);
