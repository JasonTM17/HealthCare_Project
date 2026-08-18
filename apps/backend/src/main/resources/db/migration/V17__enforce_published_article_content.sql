-- Public articles are rendered as reading material, so an active published row
-- must contain both a summary and a body. Preserve sparse legacy rows as
-- inactive drafts instead of exposing an empty public card.

UPDATE articles
SET active = FALSE,
    published_at = NULL
WHERE active = TRUE
  AND published_at IS NOT NULL
  AND (
      NULLIF(BTRIM(summary), '') IS NULL
      OR NULLIF(BTRIM(body), '') IS NULL
  );

ALTER TABLE articles
    ADD CONSTRAINT ck_articles_published_content
    CHECK (
        published_at IS NULL
        OR (
            NULLIF(BTRIM(summary), '') IS NOT NULL
            AND NULLIF(BTRIM(body), '') IS NOT NULL
        )
    );
