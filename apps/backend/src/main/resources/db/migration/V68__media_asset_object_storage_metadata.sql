-- V68__media_asset_object_storage_metadata.sql
-- Allow media asset rows to reference public object storage while retaining
-- legacy inline BYTEA rows until an operator-owned backfill is performed.

ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS object_key VARCHAR(512);

ALTER TABLE media_assets
    ALTER COLUMN data DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_object_key
    ON media_assets(object_key)
    WHERE object_key IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_media_assets_storage_present'
          AND conrelid = 'media_assets'::regclass
    ) THEN
        ALTER TABLE media_assets
            ADD CONSTRAINT chk_media_assets_storage_present
            CHECK (data IS NOT NULL OR object_key IS NOT NULL) NOT VALID;
    END IF;
END $$;

ALTER TABLE media_assets
    VALIDATE CONSTRAINT chk_media_assets_storage_present;
