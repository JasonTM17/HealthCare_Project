-- CMS content is intentionally V12: the branch-scheduling candidate owns V10/V11.
CREATE TABLE cms_contents (
    id UUID PRIMARY KEY,
    slot_key VARCHAR(120) NOT NULL UNIQUE,
    component_type VARCHAR(40) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(16) NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_cms_contents_slot_key CHECK (slot_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
    CONSTRAINT ck_cms_contents_component_type CHECK (
        component_type IN ('HERO', 'RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD')
    ),
    CONSTRAINT ck_cms_contents_payload_object CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT ck_cms_contents_payload_size CHECK (pg_column_size(payload) <= 32768),
    CONSTRAINT ck_cms_contents_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ck_cms_contents_version CHECK (version > 0)
);

CREATE INDEX idx_cms_contents_status_slot ON cms_contents(status, slot_key);

-- Only public visibility changes are recorded. Draft-only edits never leak into
-- the public cursor; an unpublish emits published=false so clients can refetch.
CREATE TABLE cms_content_changes (
    id BIGSERIAL PRIMARY KEY,
    content_id UUID NOT NULL REFERENCES cms_contents(id) ON DELETE CASCADE,
    slot_key VARCHAR(120) NOT NULL,
    content_version BIGINT NOT NULL,
    published BOOLEAN NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_cms_content_changes_slot_key CHECK (slot_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
    CONSTRAINT ck_cms_content_changes_version CHECK (content_version > 0)
);

CREATE INDEX idx_cms_content_changes_cursor ON cms_content_changes(id);
CREATE INDEX idx_cms_content_changes_slot ON cms_content_changes(slot_key, id);
