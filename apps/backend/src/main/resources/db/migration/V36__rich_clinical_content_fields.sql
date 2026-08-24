-- Additive clinical-content vocabulary for article, specialty and FAQ sources.
--
-- V34 owns immutable AI revisions and doctor approval.  These columns enrich
-- the source projection; they do not grant eligibility or bypass that review
-- workflow.  Every JSON field is bounded and must remain an array/object so a
-- malformed CMS payload cannot enter the canonical revision snapshot.

ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS content_language VARCHAR(12) NOT NULL DEFAULT 'vi',
    ADD COLUMN IF NOT EXISTS content_kind VARCHAR(24) NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(200),
    ADD COLUMN IF NOT EXISTS seo_description VARCHAR(500),
    ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS audience VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN IF NOT EXISTS topic_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS warning_signs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS prevention_tips JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS when_to_seek_care TEXT,
    ADD COLUMN IF NOT EXISTS source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS clinical_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS clinical_disclaimer VARCHAR(2000),
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_reviewed_by UUID,
    ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE specialties
    ADD COLUMN IF NOT EXISTS clinical_overview TEXT,
    ADD COLUMN IF NOT EXISTS common_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS preventive_care JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS when_to_seek_care TEXT,
    ADD COLUMN IF NOT EXISTS source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS clinical_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_reviewed_by UUID;

ALTER TABLE faqs
    ADD COLUMN IF NOT EXISTS category VARCHAR(120),
    ADD COLUMN IF NOT EXISTS topic_slug VARCHAR(180),
    ADD COLUMN IF NOT EXISTS origin_question_id UUID,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS published_by UUID,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS audience VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN IF NOT EXISTS topic_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS related_specialty_slug VARCHAR(180),
    ADD COLUMN IF NOT EXISTS source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS clinical_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS clinical_disclaimer VARCHAR(2000),
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_reviewed_by UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_content_kind') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_content_kind
            CHECK (content_kind IN ('GENERAL', 'DISEASE_GUIDE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_tags') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_tags CHECK (
            jsonb_typeof(tags) = 'array' AND pg_column_size(tags) <= 32768
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_version') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_version CHECK (version > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_cover_image_url') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_cover_image_url CHECK (
            cover_image_url IS NULL OR (
                char_length(btrim(cover_image_url)) BETWEEN 1 AND 500
                AND cover_image_url !~ '[\\x00-\\x1F\\x7F]'
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_articles_last_reviewed_by') THEN
        ALTER TABLE articles
            ADD CONSTRAINT fk_articles_last_reviewed_by
            FOREIGN KEY (last_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_specialties_last_reviewed_by') THEN
        ALTER TABLE specialties
            ADD CONSTRAINT fk_specialties_last_reviewed_by
            FOREIGN KEY (last_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_faqs_last_reviewed_by') THEN
        ALTER TABLE faqs
            ADD CONSTRAINT fk_faqs_last_reviewed_by
            FOREIGN KEY (last_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_content_language') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_content_language
            CHECK (content_language ~ '^[a-z]{2}(-[A-Z]{2})?$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_audience') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_audience
            CHECK (audience IN ('GENERAL', 'PATIENT', 'CAREGIVER', 'PROFESSIONAL'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_rich_arrays') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_rich_arrays CHECK (
            jsonb_typeof(topic_tags) = 'array'
            AND jsonb_typeof(key_takeaways) = 'array'
            AND jsonb_typeof(warning_signs) = 'array'
            AND jsonb_typeof(prevention_tips) = 'array'
            AND jsonb_typeof(source_references) = 'array'
            AND pg_column_size(topic_tags) <= 32768
            AND pg_column_size(key_takeaways) <= 32768
            AND pg_column_size(warning_signs) <= 32768
            AND pg_column_size(prevention_tips) <= 32768
            AND pg_column_size(source_references) <= 32768
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_clinical_metadata') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_clinical_metadata CHECK (
            jsonb_typeof(clinical_metadata) = 'object' AND pg_column_size(clinical_metadata) <= 65536
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_articles_review_pair') THEN
        ALTER TABLE articles ADD CONSTRAINT ck_articles_review_pair CHECK (
            (last_reviewed_at IS NULL) = (last_reviewed_by IS NULL)
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_specialties_rich_arrays') THEN
        ALTER TABLE specialties ADD CONSTRAINT ck_specialties_rich_arrays CHECK (
            jsonb_typeof(common_conditions) = 'array'
            AND jsonb_typeof(red_flags) = 'array'
            AND jsonb_typeof(preventive_care) = 'array'
            AND jsonb_typeof(source_references) = 'array'
            AND pg_column_size(common_conditions) <= 32768
            AND pg_column_size(red_flags) <= 32768
            AND pg_column_size(preventive_care) <= 32768
            AND pg_column_size(source_references) <= 32768
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_specialties_clinical_metadata') THEN
        ALTER TABLE specialties ADD CONSTRAINT ck_specialties_clinical_metadata CHECK (
            jsonb_typeof(clinical_metadata) = 'object' AND pg_column_size(clinical_metadata) <= 65536
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_specialties_review_pair') THEN
        ALTER TABLE specialties ADD CONSTRAINT ck_specialties_review_pair CHECK (
            (last_reviewed_at IS NULL) = (last_reviewed_by IS NULL)
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_faqs_audience') THEN
        ALTER TABLE faqs ADD CONSTRAINT ck_faqs_audience
            CHECK (audience IN ('GENERAL', 'PATIENT', 'CAREGIVER', 'PROFESSIONAL'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_faqs_topic_arrays') THEN
        ALTER TABLE faqs ADD CONSTRAINT ck_faqs_topic_arrays CHECK (
            jsonb_typeof(topic_tags) = 'array'
            AND jsonb_typeof(source_references) = 'array'
            AND pg_column_size(topic_tags) <= 32768
            AND pg_column_size(source_references) <= 32768
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_faqs_clinical_metadata') THEN
        ALTER TABLE faqs ADD CONSTRAINT ck_faqs_clinical_metadata CHECK (
            jsonb_typeof(clinical_metadata) = 'object' AND pg_column_size(clinical_metadata) <= 65536
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_faqs_sort_order') THEN
        ALTER TABLE faqs ADD CONSTRAINT ck_faqs_sort_order CHECK (sort_order >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_faqs_version') THEN
        ALTER TABLE faqs ADD CONSTRAINT ck_faqs_version CHECK (version > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_faqs_review_pair') THEN
        ALTER TABLE faqs ADD CONSTRAINT ck_faqs_review_pair CHECK (
            (last_reviewed_at IS NULL) = (last_reviewed_by IS NULL)
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_faqs_published_by') THEN
        ALTER TABLE faqs
            ADD CONSTRAINT fk_faqs_published_by
            FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION hospital_article_rich_content_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW IS DISTINCT FROM OLD THEN
        NEW.updated_at := CURRENT_TIMESTAMP;
        IF TG_OP = 'UPDATE' THEN
            NEW.version := OLD.version + 1;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION hospital_faq_rich_content_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW IS DISTINCT FROM OLD THEN
        NEW.updated_at := CURRENT_TIMESTAMP;
        IF TG_OP = 'UPDATE' THEN
            NEW.version := OLD.version + 1;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_articles_rich_content_touch ON articles;
CREATE TRIGGER trg_articles_rich_content_touch
    BEFORE INSERT OR UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION hospital_article_rich_content_touch();
DROP TRIGGER IF EXISTS trg_faqs_rich_content_touch ON faqs;
CREATE TRIGGER trg_faqs_rich_content_touch
    BEFORE INSERT OR UPDATE ON faqs
    FOR EACH ROW EXECUTE FUNCTION hospital_faq_rich_content_touch();

REVOKE EXECUTE ON FUNCTION hospital_article_rich_content_touch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION hospital_faq_rich_content_touch() FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_articles_clinical_topic_tags
    ON articles USING GIN(topic_tags);
CREATE INDEX IF NOT EXISTS idx_articles_content_kind_publish
    ON articles(content_kind, scheduled_publish_at, published_at DESC, id)
    WHERE active;
CREATE INDEX IF NOT EXISTS idx_articles_updated_version
    ON articles(updated_at DESC, version DESC, id);
CREATE INDEX IF NOT EXISTS idx_articles_clinical_review
    ON articles(last_reviewed_at DESC, id)
    WHERE active AND published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_featured
    ON articles(featured, published_at DESC, id)
    WHERE active AND published_at IS NOT NULL AND featured;

CREATE INDEX IF NOT EXISTS idx_specialties_common_conditions
    ON specialties USING GIN(common_conditions);
CREATE INDEX IF NOT EXISTS idx_specialties_clinical_review
    ON specialties(last_reviewed_at DESC, id)
    WHERE active;

CREATE INDEX IF NOT EXISTS idx_faqs_category_order
    ON faqs(category, sort_order, id)
    WHERE active;
CREATE INDEX IF NOT EXISTS idx_faqs_related_specialty
    ON faqs(related_specialty_slug)
    WHERE active;
CREATE INDEX IF NOT EXISTS idx_faqs_topic_tags
    ON faqs USING GIN(topic_tags);
CREATE INDEX IF NOT EXISTS idx_faqs_topic_slug
    ON faqs(topic_slug, published_at DESC, id)
    WHERE active;
CREATE INDEX IF NOT EXISTS idx_faqs_updated_version
    ON faqs(updated_at DESC, version DESC, id);

COMMENT ON COLUMN articles.clinical_metadata IS
    'Bounded source metadata; approval eligibility remains owned by V34 review heads.';
COMMENT ON COLUMN specialties.clinical_metadata IS
    'Bounded source metadata; approval eligibility remains owned by V34 review heads.';
COMMENT ON COLUMN faqs.clinical_metadata IS
    'Bounded source metadata; approval eligibility remains owned by V34 review heads.';
