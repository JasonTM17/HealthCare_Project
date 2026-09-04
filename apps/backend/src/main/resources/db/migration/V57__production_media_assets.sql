-- V57__production_media_assets.sql
-- Production media storage in PostgreSQL for article cover images, doctor portraits, and patient avatars

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    data BYTEA NOT NULL,
    uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    uploader_role VARCHAR(32) NOT NULL DEFAULT 'USER',
    purpose VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_assets_uploader_id ON media_assets(uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_purpose ON media_assets(purpose);
