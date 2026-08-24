-- Database-owned monotonic cursor for the legacy operational catalog writer.
-- Governed clinical revisions use ai_content_review_heads; this sequence is
-- only a synchronization watermark and never an approval/eligibility value.
CREATE SEQUENCE ai_catalog_sync_revision_seq
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1;
