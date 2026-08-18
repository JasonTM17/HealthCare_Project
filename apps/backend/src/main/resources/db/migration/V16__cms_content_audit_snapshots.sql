-- Preserve an admin-visible snapshot for every public CMS change. Existing V12
-- rows remain readable as metadata-only history; new rows carry enough state
-- to support a safe, version-checked rollback.
ALTER TABLE cms_content_changes
    ADD COLUMN actor_email VARCHAR(320),
    ADD COLUMN component_type VARCHAR(40),
    ADD COLUMN status VARCHAR(16),
    ADD COLUMN payload JSONB,
    ADD COLUMN previous_payload JSONB,
    ADD COLUMN public_event BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE cms_content_changes
    ADD CONSTRAINT ck_cms_content_changes_component_type
        CHECK (component_type IS NULL OR component_type IN ('HERO', 'RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD')),
    ADD CONSTRAINT ck_cms_content_changes_status
        CHECK (status IS NULL OR status IN ('DRAFT', 'PUBLISHED')),
    ADD CONSTRAINT ck_cms_content_changes_payload_object
        CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object'),
    ADD CONSTRAINT ck_cms_content_changes_previous_payload_object
        CHECK (previous_payload IS NULL OR jsonb_typeof(previous_payload) = 'object');

CREATE INDEX idx_cms_content_changes_history
    ON cms_content_changes(slot_key, id DESC);
