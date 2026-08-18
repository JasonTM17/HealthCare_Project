-- Expand the public hospital payloads so Stitch detail screens can render
-- structured, backend-owned content without inventing copy in the frontend.

ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS working_hours VARCHAR(255),
    ADD COLUMN IF NOT EXISTS emergency_hotline VARCHAR(50),
    ADD COLUMN IF NOT EXISTS map_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS amenities JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE packages
    ADD COLUMN IF NOT EXISTS target_audience VARCHAR(500),
    ADD COLUMN IF NOT EXISTS duration_days INTEGER,
    ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS preparation_steps JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS category VARCHAR(120),
    ADD COLUMN IF NOT EXISTS author_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS reading_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS related_specialty_slug VARCHAR(180),
    ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE specialties
    ADD COLUMN IF NOT EXISTS common_symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS preparation_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS care_pathway TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_related_specialty
    ON articles(related_specialty_slug);
