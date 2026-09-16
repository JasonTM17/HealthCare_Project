-- Admin catalog delete snapshots reuse the immutable content revision tables for
-- non-clinical catalog rows too. These source types are recorded for audit and
-- recovery only; clinical review queues continue to filter to SPECIALTY/ARTICLE/FAQ.

ALTER TABLE ai_content_revisions DROP CONSTRAINT ck_ai_content_revisions_source_type;
ALTER TABLE ai_content_revisions
    ADD CONSTRAINT ck_ai_content_revisions_source_type
        CHECK (source_type IN ('SPECIALTY', 'ARTICLE', 'FAQ', 'DOCTOR', 'SERVICE', 'BRANCH', 'PACKAGE'));

ALTER TABLE ai_content_review_heads DROP CONSTRAINT ck_ai_content_review_heads_source_type;
ALTER TABLE ai_content_review_heads
    ADD CONSTRAINT ck_ai_content_review_heads_source_type
        CHECK (source_type IN ('SPECIALTY', 'ARTICLE', 'FAQ', 'DOCTOR', 'SERVICE', 'BRANCH', 'PACKAGE'));

ALTER TABLE ai_content_review_events DROP CONSTRAINT ck_ai_content_review_events_source_type;
ALTER TABLE ai_content_review_events
    ADD CONSTRAINT ck_ai_content_review_events_source_type
        CHECK (source_type IN ('SPECIALTY', 'ARTICLE', 'FAQ', 'DOCTOR', 'SERVICE', 'BRANCH', 'PACKAGE'));
