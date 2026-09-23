-- ==============================================================================
-- V100__hide_demo_and_e2e_public_content.sql
--
-- Public-content hygiene (Kongming §2 / Advisor WS2). The public hospital pages
-- carried synthetic content that makes a real deployment look broken:
--
--   1. the V67 branch demo doctors ("Bác sĩ mẫu <ordinal> - <specialty>", the
--      Bác sĩ mẫu 1..8 set duplicated per active branch), active and therefore
--      listed on the public /doctors page;
--   2. leftover Playwright E2E fixture articles whose slugs start with 'e2e-'
--      (e.g. 'e2e-round7-nhip-tim-cham---khi-nao-can-gap-bac-si'), still
--      published + APPROVED and therefore featured on the public homepage.
--
-- NO ROWS ARE DELETED. Demo doctors are hidden through the same visibility
-- flag the admin "Tạm ẩn" control flips (doctors.active, the predicate every
-- public doctor query already carries); e2e articles are unpublished by
-- clearing published_at. review_status is deliberately untouched so the
-- admin/doctor review trail stays intact. scheduled_publish_at is cleared in
-- the same statement, otherwise ArticlePublicationSweeper would republish any
-- fixture that still carried a due schedule within one sweep tick of V100.
--
-- Counts observed on production at write time (2026-09-23): eight V67 demo
-- personas per active branch (within the 8..32 bound below) and a handful of
-- published 'e2e-*' fixture articles (within 1..20). Exact totals are
-- environment-specific, so each statement is a guarded DO block: when
-- candidate rows exist, the affected count must land inside the stated bounds
-- or the migration aborts (RAISE EXCEPTION) instead of mass-updating. A fresh
-- migration chain legitimately has zero candidates -- V67 cross-joins the
-- branch/specialty catalog that only V95 seeds, so no 'Bác sĩ mẫu' row exists
-- before the runtime does -- and each block then skips with a NOTICE instead
-- of failing every fresh deployment and Testcontainers schema.
-- ==============================================================================

-- 1) Hide the V67 branch demo doctors using the existing visibility flag.
DO $$
DECLARE
    candidate_count integer;
    affected_count integer;
BEGIN
    SELECT count(*) INTO candidate_count
      FROM doctors
     WHERE full_name LIKE 'Bác sĩ mẫu %'
       AND active = TRUE;

    IF candidate_count = 0 THEN
        RAISE NOTICE 'V100: no active "Bác sĩ mẫu" doctor rows present; skipping demo-doctor hiding.';
        RETURN;
    END IF;

    UPDATE doctors
       SET active = FALSE
     WHERE full_name LIKE 'Bác sĩ mẫu %'
       AND active = TRUE;
    GET DIAGNOSTICS affected_count = ROW_COUNT;

    IF affected_count NOT BETWEEN 8 AND 32 THEN
        RAISE EXCEPTION USING
            MESSAGE = 'V100 guard failed: hid ' || affected_count ||
                ' demo doctor rows, outside the expected bounds [8, 32].',
            HINT = 'The V67 "Bác sĩ mẫu N - <specialty>" naming or the branch catalog has drifted. '
                'Inspect the doctors table before retrying; this migration never deletes rows.';
    END IF;

    RAISE NOTICE 'V100: hid % demo doctor row(s); no rows were deleted.', affected_count;
END $$;

-- 2) Unpublish the leftover e2e fixture articles (review_status untouched).
DO $$
DECLARE
    candidate_count integer;
    affected_count integer;
BEGIN
    SELECT count(*) INTO candidate_count
      FROM articles
     WHERE slug LIKE 'e2e-%'
       AND published_at IS NOT NULL;

    IF candidate_count = 0 THEN
        RAISE NOTICE 'V100: no published "e2e-*" fixture articles present; skipping unpublish.';
        RETURN;
    END IF;

    UPDATE articles
       SET published_at = NULL,
           scheduled_publish_at = NULL
     WHERE slug LIKE 'e2e-%'
       AND published_at IS NOT NULL;
    GET DIAGNOSTICS affected_count = ROW_COUNT;

    IF affected_count NOT BETWEEN 1 AND 20 THEN
        RAISE EXCEPTION USING
            MESSAGE = 'V100 guard failed: unpublished ' || affected_count ||
                ' e2e fixture articles, outside the expected bounds [1, 20].',
            HINT = 'Either the e2e- slug convention now matches far more than the fixture set or the schema has drifted. '
                'Inspect articles.slug before retrying; this migration never deletes rows.';
    END IF;

    RAISE NOTICE 'V100: unpublished % e2e fixture article(s); no rows were deleted.', affected_count;
END $$;
