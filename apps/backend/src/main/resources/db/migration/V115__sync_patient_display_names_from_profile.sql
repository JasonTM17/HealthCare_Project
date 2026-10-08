-- ==============================================================================
-- V115__sync_patient_display_names_from_profile.sql
--
-- Stale-header defect: the portal header, navbar account chip, dashboard
-- greeting and comment composer all read users.display_name, but the patient
-- profile editor persisted the new name only to patient_profiles.full_name.
-- updateProfile now keeps both columns in step; this one-time backfill repairs
-- accounts that were renamed before the sync existed. Profiles carry the
-- patient-edited name, so it is the authoritative source here.
--
-- Only user-linked profiles are touched, and rows whose names already match
-- are skipped. Runs once; on a fresh chain with no divergent rows the block
-- is a no-op.
-- ==============================================================================

DO $$
DECLARE
    aligned_count integer;
BEGIN
    UPDATE users u
       SET display_name = pp.full_name,
           updated_at = CURRENT_TIMESTAMP
      FROM patient_profiles pp
     WHERE pp.user_id = u.id
       AND pp.full_name IS NOT NULL
       AND btrim(pp.full_name) <> ''
       AND u.display_name IS DISTINCT FROM pp.full_name;

    GET DIAGNOSTICS aligned_count = ROW_COUNT;

    IF aligned_count = 0 THEN
        RAISE NOTICE 'V115: patient display names already aligned with profiles';
    ELSE
        RAISE NOTICE 'V115: aligned % patient display name(s) to the profile name', aligned_count;
    END IF;
END $$;
