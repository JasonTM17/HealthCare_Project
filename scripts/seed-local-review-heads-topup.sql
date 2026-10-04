-- ============================================================================
-- LOCAL-ONLY governed top-up: create APPROVED review heads + rounds for
-- seeded clinical content that predates the review workflow, so the clinical
-- projection sync (AiClinicalProjectionIndexService) can index it.
--
-- Contract notes:
-- * content_hash replicates EXACTLY the live-canonical fence computed inside
--   CURRENT_APPROVED_SOURCES (sha256 of the canonical jsonb_build_object per
--   source type). A mismatched hash is silently skipped by the sync.
-- * submitted_by / reviewed_by reuse the seeded demo reviewer pair from the
--   V92-era approved rounds (submitter != reviewer, reviewer is an ACTIVE
--   DOCTOR), matching the independence rule enforced by the review API.
-- * Idempotent: rows with an existing head are skipped, so re-running never
--   resets an approval.
--
-- Execution lock: run ONLY against this compose project's postgres container,
-- e.g.
--   docker exec -i infrastructure-postgres-1 psql -U healthcare -d healthcare \
--     -v ON_ERROR_STOP=1 -f - < scripts/seed-local-review-heads-topup.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH params AS (
    SELECT '90000000-0000-0000-0000-000000000025'::uuid AS submitter,
           '90000000-0000-0000-0000-000000000023'::uuid AS reviewer
),
targets AS (
    SELECT 'ARTICLE'::varchar(16) AS source_type, a.id AS source_id,
           encode(digest(convert_to(jsonb_build_object(
               'active', a.active,
               'author_name', a.author_name,
               'body', a.body,
               'category', a.category,
               'id', a.id::text,
               'reading_minutes', a.reading_minutes,
               'related_specialty_slug', a.related_specialty_slug,
               'published_at', a.published_at,
               'sections', a.sections,
               'slug', a.slug,
               'summary', a.summary,
               'title', a.title
           )::text, 'UTF8'), 'sha256'), 'hex') AS content_hash,
           jsonb_build_object(
               'active', a.active,
               'author_name', a.author_name,
               'body', a.body,
               'category', a.category,
               'id', a.id::text,
               'reading_minutes', a.reading_minutes,
               'related_specialty_slug', a.related_specialty_slug,
               'published_at', a.published_at,
               'sections', a.sections,
               'slug', a.slug,
               'summary', a.summary,
               'title', a.title
           ) AS snapshot
      FROM articles a
     WHERE a.active
       AND a.published_at IS NOT NULL
       AND a.id IN (
           '60000000-0000-0000-0000-000000000001',
           '60000000-0000-0000-0000-000000000002',
           '60000000-0000-0000-0000-000000000003',
           'a1000000-0000-0000-0000-000000000003',
           'a1000000-0000-0000-0000-000000000004'
       )
    UNION ALL
    SELECT 'FAQ'::varchar(16), f.id,
           encode(digest(convert_to(jsonb_build_object(
               'active', f.active,
               'answer', f.answer,
               'id', f.id::text,
               'question', f.question
           )::text, 'UTF8'), 'sha256'), 'hex'),
           jsonb_build_object(
               'active', f.active,
               'answer', f.answer,
               'id', f.id::text,
               'question', f.question
           )
      FROM faqs f
     WHERE f.active
       AND f.id IN (
           '70000000-0000-0000-0000-000000000001',
           '70000000-0000-0000-0000-000000000002',
           '70000000-0000-0000-0000-000000000003',
           '70000000-0000-0000-0000-000000000004'
       )
),
ins_revisions AS (
    -- Heads carry a FK into the revision ledger; the snapshot is the same
    -- canonical jsonb whose sha256 forms the hash.
    INSERT INTO ai_content_revisions (
        source_type, source_id, content_revision, content_hash,
        content_snapshot, created_by
    )
    SELECT t.source_type, t.source_id, 1, t.content_hash, t.snapshot, p.submitter
      FROM targets t CROSS JOIN params p
     WHERE NOT EXISTS (
         SELECT 1 FROM ai_content_revisions r
          WHERE r.source_type = t.source_type
            AND r.source_id = t.source_id
            AND r.content_revision = 1
       )
    RETURNING 1
),
seeded AS (
    INSERT INTO ai_content_review_heads (
        source_type, source_id, content_revision, content_hash,
        eligibility_revision, eligibility_state, current_approval_round,
        submitted_at, approved_at, approval_expires_at
    )
    SELECT t.source_type, t.source_id, 1, t.content_hash, 1, 'APPROVED', 1,
           now(), now(), now() + interval '180 days'
      FROM targets t
     WHERE NOT EXISTS (
         SELECT 1 FROM ai_content_review_heads h
          WHERE h.source_type = t.source_type AND h.source_id = t.source_id
     )
    RETURNING source_type, source_id, content_hash
)
INSERT INTO ai_content_approval_rounds (
    source_type, source_id, content_revision, content_hash, approval_round,
    state, submitted_by, reviewed_by, reviewer_role,
    submitted_at, decided_at, expires_at, reason
)
SELECT s.source_type, s.source_id, 1, s.content_hash, 1,
       'APPROVED', p.submitter, p.reviewer, 'DOCTOR',
       now(), now(), now() + interval '180 days',
       'Local governed top-up: seeded clinical content approved through the canonical snapshot fence.'
  FROM seeded s
 CROSS JOIN params p;

-- Report what is now eligible (should list the 9 topped-up docs).
SELECT h.source_type, h.source_id, h.eligibility_state
  FROM ai_content_review_heads h
 WHERE (h.source_type = 'ARTICLE' AND h.source_id IN (
           '60000000-0000-0000-0000-000000000001',
           '60000000-0000-0000-0000-000000000002',
           '60000000-0000-0000-0000-000000000003',
           'a1000000-0000-0000-0000-000000000003',
           'a1000000-0000-0000-0000-000000000004'))
    OR (h.source_type = 'FAQ' AND h.source_id IN (
           '70000000-0000-0000-0000-000000000001',
           '70000000-0000-0000-0000-000000000002',
           '70000000-0000-0000-0000-000000000003',
           '70000000-0000-0000-0000-000000000004'))
 ORDER BY h.source_type, h.source_id;
