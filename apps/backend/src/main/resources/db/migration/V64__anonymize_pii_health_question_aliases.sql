-- The public alias is rendered on the unauthenticated listing, but only the
-- question body was PII-scanned at write time. Phone numbers are pure digits
-- and pass the alias CHECK constraint, so existing rows can leak contact
-- data. Replace any digit-run aliases with an anonymized display name that
-- still satisfies ck_health_questions_public_alias.
UPDATE health_questions
   SET public_alias = 'Nguoi hoi ' || upper(substring(md5(id::text) FROM 1 FOR 6))
 WHERE public_alias ~ '(^|[^0-9])((\+?84|0)(3|5|7|8|9)[0-9]{8}|[0-9]{9,12})($|[^0-9])';
