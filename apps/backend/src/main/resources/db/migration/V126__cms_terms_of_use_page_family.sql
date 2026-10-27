-- Register the "dieu-khoan-su-dung" (Terms of Use) public page family so its
-- PAGE_LAYOUT slot passes the canonical slot/component contract. Replacing the
-- function in place keeps the existing CHECK constraints bound to the same OID.
CREATE OR REPLACE FUNCTION cms_page_slot_component_valid(slot TEXT, component TEXT)
RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE PARALLEL SAFE
AS $contract$
    SELECT
        (
            slot ~ '^(homepage|about|branches|specialties|doctors|services|packages|articles|careers|search|dat-lich|contact|faq|huong-dan|tra-cuu)\.(hero|body|sidebar|footer)$'
            AND (
                component IS NULL
                OR (split_part(slot, '.', 2) = 'hero' AND component = 'HERO')
                OR (split_part(slot, '.', 2) = 'body' AND component IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
                OR (split_part(slot, '.', 2) = 'sidebar' AND component IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE', 'IMAGE_CARD'))
                OR (split_part(slot, '.', 2) = 'footer' AND component IN ('RICH_TEXT', 'CTA_BANNER', 'NOTICE'))
            )
        )
        OR (
            (
                slot ~ '^(homepage|about|branches|specialties|doctors|services|packages|articles|careers|search|dat-lich|contact|faq|huong-dan|tra-cuu|benh-pho-bien|gop-y|chinh-sach-bao-mat|dieu-khoan-su-dung)\.layout$'
                OR slot ~ '^(branches|specialties|doctors|services|packages|articles|benh-pho-bien)\.detail-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.layout$'
            )
            AND (component IS NULL OR component = 'PAGE_LAYOUT')
        );
$contract$;
