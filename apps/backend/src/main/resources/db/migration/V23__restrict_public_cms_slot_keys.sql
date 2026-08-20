-- Keep CMS content bound to the public route inventory shared with the
-- frontend editor. Private/authenticated paths such as admin, patient, and
-- doctor dashboards must not become publicly readable component slots.
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
