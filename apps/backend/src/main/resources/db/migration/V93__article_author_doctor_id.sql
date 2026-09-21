-- V93: bind doctor-authored articles to a doctor identity instead of a
-- display-name string.
--
-- Ownership of doctor articles was enforced by comparing the free-text
-- `articles.author_name` against the logged-in doctor's display name.  A
-- rename silently revoked access and two doctors sharing a name let either
-- one claim the other's articles.  This migration adds a stable
-- `author_doctor_id` reference; `author_name` stays as the display label.
--
-- The backfill mirrors the historical tolerant name matching (exact match on
-- full/display name, or academic-title-stripped bidirectional containment)
-- but only claims an article when the name resolves to EXACTLY ONE doctor:
-- ambiguous rows stay NULL so the runtime legacy fallback keeps deciding.

ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS author_doctor_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_articles_author_doctor_id') THEN
        ALTER TABLE articles
            ADD CONSTRAINT fk_articles_author_doctor_id
            FOREIGN KEY (author_doctor_id) REFERENCES doctors(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ownership lookups filter by the caller's doctor id; the column is also the
-- FK side of doctors(id), so it carries an index per project convention.
CREATE INDEX IF NOT EXISTS idx_articles_author_doctor
    ON articles(author_doctor_id);

-- Guarded backfill: re-running touches nothing because only rows whose
-- author_doctor_id is still NULL are considered.
WITH doctor_names AS (
    SELECT d.id AS doctor_id,
           CASE
               WHEN btrim(d.full_name) <> '' THEN lower(btrim(d.full_name))
               ELSE lower(btrim(u.display_name))
           END AS full_name,
           CASE
               WHEN u.display_name IS NOT NULL AND btrim(u.display_name) <> ''
                   THEN lower(btrim(u.display_name))
           END AS alt_name,
           nullif(
               lower(regexp_replace(
                   btrim(d.full_name),
                   '^(GS\.TS\.BS|PGS\.TS\.BS|TS\.BS|ThS\.BS|BS\.CKII|BS\.CKI|GS|PGS|TS|ThS|BS|Bác sĩ)\.?\s*',
                   '',
                   'i'
               )),
               ''
           ) AS pure_name
    FROM doctors d
    LEFT JOIN users u ON u.id = d.user_id
),
article_names AS (
    SELECT a.id AS article_id,
           lower(btrim(a.author_name)) AS author_name,
           nullif(
               lower(regexp_replace(
                   btrim(a.author_name),
                   '^(GS\.TS\.BS|PGS\.TS\.BS|TS\.BS|ThS\.BS|BS\.CKII|BS\.CKI|GS|PGS|TS|ThS|BS|Bác sĩ)\.?\s*',
                   '',
                   'i'
               )),
               ''
           ) AS pure_name
    FROM articles a
    WHERE a.author_name IS NOT NULL AND btrim(a.author_name) <> ''
),
matches AS (
    SELECT an.article_id, dn.doctor_id
    FROM article_names an
    JOIN doctor_names dn
      ON dn.full_name = an.author_name
      OR dn.alt_name = an.author_name
      OR (
           dn.pure_name IS NOT NULL
           AND (
               dn.pure_name = an.pure_name
               OR (
                   an.pure_name IS NOT NULL
                   AND (
                       position(dn.pure_name IN an.pure_name) > 0
                       OR position(an.pure_name IN dn.pure_name) > 0
                   )
               )
           )
       )
)
UPDATE articles a
SET author_doctor_id = resolved.doctor_id
FROM (
    -- min(uuid) does not exist in Postgres; HAVING guarantees exactly one
    -- distinct doctor_id per article, so the text-cast min is a deterministic
    -- pick of that single value.
    SELECT m.article_id, min(m.doctor_id::text)::uuid AS doctor_id
    FROM matches m
    GROUP BY m.article_id
    HAVING count(DISTINCT m.doctor_id) = 1
) resolved
WHERE a.id = resolved.article_id
  AND a.author_doctor_id IS NULL;

-- Note: rows touched by the backfill fire trg_articles_rich_content_touch and
-- therefore get one version/updated_at bump.  That is accepted bookkeeping
-- noise; suppressing the trigger during a Flyway migration was judged riskier
-- than an extra revision number on seeded articles.
