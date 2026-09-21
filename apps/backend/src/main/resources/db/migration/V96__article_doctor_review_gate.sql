-- ==============================================================================
-- V96__article_doctor_review_gate.sql
--
-- Doctor-authored articles used to go live the moment the doctor saved them:
-- the admin could not tell a staff-written article from a doctor submission
-- and had no way to approve or reject one. Add an explicit review gate:
--
--   * review_status PENDING -> visible only in the doctor/admin portals
--               APPROVED    -> eligible for the public catalog
--               REJECTED    -> kept for the author with a reviewer trail
--   * reviewed_at / reviewed_by record who decided and when.
--
-- Every row that exists today was already public, so the backfill keeps them
-- APPROVED: the gate only raises the bar for NEW doctor submissions, it never
-- silently unpublishes live content. Admin-authored articles stay APPROVED.
-- ==============================================================================

ALTER TABLE articles
    ADD COLUMN review_status VARCHAR(16) NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN review_reason VARCHAR(500),
    ADD COLUMN review_decided_at TIMESTAMPTZ,
    ADD COLUMN review_decided_by UUID REFERENCES users(id);

ALTER TABLE articles
    ADD CONSTRAINT ck_articles_review_status
    CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- The public catalog filters on this column on every list and detail read.
CREATE INDEX idx_articles_public_review
    ON articles (content_kind, review_status, active, published_at DESC);

-- Review-decided-* is filled by the review endpoint going forward; the
-- backfilled default intentionally has no decider because no human approved
-- them here. These are distinct from last_reviewed_at/last_reviewed_by, which
-- track the clinical-accuracy review, not the publication gate.
COMMENT ON COLUMN articles.review_status IS
    'PENDING (doctor submission awaiting admin review), APPROVED (public), REJECTED (declined, visible to author/admin only)';
