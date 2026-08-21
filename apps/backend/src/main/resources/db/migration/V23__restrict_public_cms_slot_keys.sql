-- Keep CMS content bound to the public route inventory shared with the
-- frontend editor. Private/authenticated paths such as admin, patient, and
-- doctor dashboards must not become publicly readable component slots.
DO $$
DECLARE
    allowed_public_slot_key CONSTANT TEXT :=
        '^(homepage|about|branches|specialties|doctors|services|packages|articles|careers|search|dat-lich|contact|faq|huong-dan|tra-cuu)\.(hero|body|sidebar|footer)$';
    invalid_content_count INTEGER;
    invalid_change_count INTEGER;
    invalid_content_examples TEXT;
    invalid_change_examples TEXT;
BEGIN
    SELECT COUNT(*)
    INTO invalid_content_count
    FROM cms_contents
    WHERE slot_key !~ allowed_public_slot_key;

    SELECT COUNT(*)
    INTO invalid_change_count
    FROM cms_content_changes
    WHERE slot_key !~ allowed_public_slot_key;

    SELECT COALESCE(STRING_AGG(slot_key, ', '), '(none)')
    INTO invalid_content_examples
    FROM (
        SELECT DISTINCT slot_key
        FROM cms_contents
        WHERE slot_key !~ allowed_public_slot_key
        ORDER BY slot_key
        LIMIT 5
    ) invalid_contents;

    SELECT COALESCE(STRING_AGG(slot_key, ', '), '(none)')
    INTO invalid_change_examples
    FROM (
        SELECT DISTINCT slot_key
        FROM cms_content_changes
        WHERE slot_key !~ allowed_public_slot_key
        ORDER BY slot_key
        LIMIT 5
    ) invalid_changes;

    IF invalid_content_count > 0 OR invalid_change_count > 0 THEN
        RAISE EXCEPTION
            'V23 preflight failed: found legacy CMS slot keys outside the public route inventory (% cms_contents rows, % cms_content_changes rows). Repair or explicitly reassign/delete private slots before migration; V23 never deletes production CMS data. Examples: cms_contents=[%], cms_content_changes=[%]',
            invalid_content_count,
            invalid_change_count,
            invalid_content_examples,
            invalid_change_examples
            USING ERRCODE = 'check_violation';
    END IF;
END $$;

ALTER TABLE cms_contents
    ADD CONSTRAINT ck_cms_contents_public_slot_key
        CHECK (
            slot_key ~ '^(homepage|about|branches|specialties|doctors|services|packages|articles|careers|search|dat-lich|contact|faq|huong-dan|tra-cuu)\.(hero|body|sidebar|footer)$'
        );

ALTER TABLE cms_content_changes
    ADD CONSTRAINT ck_cms_content_changes_public_slot_key
        CHECK (
            slot_key ~ '^(homepage|about|branches|specialties|doctors|services|packages|articles|careers|search|dat-lich|contact|faq|huong-dan|tra-cuu)\.(hero|body|sidebar|footer)$'
        );
