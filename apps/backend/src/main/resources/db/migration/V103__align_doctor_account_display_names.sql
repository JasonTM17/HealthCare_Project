-- ==============================================================================
-- V101__align_doctor_account_display_names.sql
--
-- Round-10 matrix finding F-4: the doctor portal account chip and the article
-- author payload read users.display_name, which for seeded doctor accounts is
-- still the placeholder "Bác sĩ Local" rather than the linked doctor's real
-- name. Consequences observed live: the topbar shows a placeholder on pages
-- that do not fetch the profile, and saving an article would overwrite the
-- public author credit with "Bác sĩ Local".
--
-- Only placeholder-shaped display names are touched, and only where the user
-- is actually linked to a doctor with a real name. Runs once; on a fresh chain
-- with no seeded doctors the block is a no-op.
-- ==============================================================================

DO $$
DECLARE
    aligned_count integer;
BEGIN
    UPDATE users u
       SET display_name = d.full_name
      FROM doctors d
     WHERE d.user_id = u.id
       AND u.display_name LIKE 'Bác sĩ %'
       AND d.full_name IS NOT NULL
       AND btrim(d.full_name) <> ''
       AND u.display_name IS DISTINCT FROM d.full_name;

    GET DIAGNOSTICS aligned_count = ROW_COUNT;

    IF aligned_count = 0 THEN
        RAISE NOTICE 'V101: no placeholder doctor display names to align';
    ELSIF aligned_count > 50 THEN
        RAISE EXCEPTION 'V101 guard failed: % doctor display names matched, expected a handful',
            aligned_count;
    ELSE
        RAISE NOTICE 'V101: aligned % doctor display name(s)', aligned_count;
    END IF;
END $$;
