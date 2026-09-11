ALTER TABLE packages ADD COLUMN display_order INTEGER;
ALTER TABLE packages ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE faqs ADD COLUMN display_order INTEGER;

WITH ranked AS (SELECT id, ROW_NUMBER() OVER (ORDER BY name, id) - 1 AS position FROM packages)
UPDATE packages p SET display_order = ranked.position FROM ranked WHERE ranked.id = p.id;

WITH ranked AS (SELECT id, ROW_NUMBER() OVER (ORDER BY question, id) - 1 AS position FROM faqs)
UPDATE faqs f SET display_order = ranked.position FROM ranked WHERE ranked.id = f.id;

ALTER TABLE packages ALTER COLUMN display_order SET NOT NULL;
ALTER TABLE packages ALTER COLUMN display_order SET DEFAULT 0;
ALTER TABLE faqs ALTER COLUMN display_order SET NOT NULL;
ALTER TABLE faqs ALTER COLUMN display_order SET DEFAULT 0;
ALTER TABLE packages ADD CONSTRAINT ck_packages_display_order_nonnegative CHECK (display_order >= 0);
ALTER TABLE packages ADD CONSTRAINT ck_packages_version_nonnegative CHECK (version >= 0);
ALTER TABLE faqs ADD CONSTRAINT ck_faqs_display_order_nonnegative CHECK (display_order >= 0);
CREATE INDEX idx_packages_display_order ON packages(display_order, id);
CREATE INDEX idx_faqs_display_order ON faqs(display_order, id);
