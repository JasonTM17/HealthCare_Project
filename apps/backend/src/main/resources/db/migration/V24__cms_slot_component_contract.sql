DO $$
DECLARE
    invalid_content_count INTEGER;
    invalid_change_count INTEGER;
    invalid_content_examples TEXT;
    invalid_change_examples TEXT;
BEGIN
    SELECT COUNT(*)
    INTO invalid_content_count
    FROM cms_contents
    WHERE NOT (
        (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
        OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
        OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
        OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
    );

    SELECT COUNT(*)
    INTO invalid_change_count
    FROM cms_content_changes
    WHERE component_type IS NOT NULL
        AND NOT (
            (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
            OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
            OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
            OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
        );

    SELECT COALESCE(STRING_AGG(slot_key || '=' || component_type, ', '), '(none)')
    INTO invalid_content_examples
    FROM (
        SELECT DISTINCT slot_key, component_type
        FROM cms_contents
        WHERE NOT (
            (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
            OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
            OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
            OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
        )
        ORDER BY slot_key, component_type
        LIMIT 5
    ) invalid_contents;

    SELECT COALESCE(STRING_AGG(slot_key || '=' || component_type, ', '), '(none)')
    INTO invalid_change_examples
    FROM (
        SELECT DISTINCT slot_key, component_type
        FROM cms_content_changes
        WHERE component_type IS NOT NULL
            AND NOT (
                (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
                OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
                OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
                OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
            )
        ORDER BY slot_key, component_type
        LIMIT 5
    ) invalid_changes;

    IF invalid_content_count > 0 OR invalid_change_count > 0 THEN
        RAISE EXCEPTION
            'V24 preflight failed: found legacy CMS slot/component combinations that do not satisfy the new slot contract (% cms_contents rows, % cms_content_changes rows). Repair or explicitly reassign/delete invalid CMS rows before migration; V24 never deletes production CMS data. Examples: cms_contents=[%], cms_content_changes=[%]',
            invalid_content_count,
            invalid_change_count,
            invalid_content_examples,
            invalid_change_examples
            USING ERRCODE = 'check_violation';
    END IF;
END $$;

ALTER TABLE cms_contents
    ADD CONSTRAINT ck_cms_contents_slot_component_type
    CHECK (
        (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
        OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
        OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
        OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
    );

ALTER TABLE cms_content_changes
    ADD CONSTRAINT ck_cms_content_changes_slot_component_type
    CHECK (
        component_type IS NULL
        OR (split_part(slot_key, '.', 2) = 'hero' AND component_type = 'HERO')
        OR (split_part(slot_key, '.', 2) = 'body' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
        OR (split_part(slot_key, '.', 2) = 'sidebar' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
        OR (split_part(slot_key, '.', 2) = 'footer' AND component_type IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
    );
