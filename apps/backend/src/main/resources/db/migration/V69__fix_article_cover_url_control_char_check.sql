-- V69: repair the ck_articles_cover_image_url check regex.
--
-- V36 added the constraint with a double-escaped POSIX class
-- ('[\\x00-\\x1F\\x7F]' inside a plain SQL literal).  PostgreSQL kept the
-- literal backslashes, so the deployed character class banned the printable
-- characters '\', 'x', '0', '1', '7' and 'F' instead of control characters.
-- Any cover URL containing those characters (digits such as "5-...",
-- ".jpgx", https hosts with "x", …) was rejected with a misleading
-- constraint violation, breaking admin article publishing.
--
-- The repaired class is [\x01-\x1F\x7F] written as an E'' literal so the
-- regex engine receives single-backslash hex escapes.  \x00 is excluded
-- because NUL bytes cannot be stored in a PostgreSQL text column anyway.

ALTER TABLE articles DROP CONSTRAINT IF EXISTS ck_articles_cover_image_url;

ALTER TABLE articles ADD CONSTRAINT ck_articles_cover_image_url CHECK (
    cover_image_url IS NULL OR (
        char_length(btrim(cover_image_url)) BETWEEN 1 AND 500
        AND cover_image_url !~ E'[\\x01-\\x1F\\x7F]'
    )
);
