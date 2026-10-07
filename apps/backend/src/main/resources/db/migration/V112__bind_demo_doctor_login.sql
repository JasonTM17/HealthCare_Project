-- V112: re-assert the demo doctor login bindings.
--
-- V56 binds the primary seeded doctor row (30000000-...-0001) to the demo
-- doctor user, and V58 later bound it to doctor@healthcare.com
-- (90000000-...-0023). The .local persona (doctor@healthcare.local,
-- 90000000-...-0002) was left without any ACTIVE doctors row, so every
-- /doctor/* endpoint that calls requireActiveDoctor answered 403 on the
-- hosted demo. This migration binds the secondary seeded doctor row
-- (30000000-...-0005 — the row V58 already treats as the .local demo doctor
-- for AI credits) to the .local user, idempotently and defensively: it never
-- steals a row bound to a different user and only reactivates a row whose
-- binding is already ours.

DO $$
DECLARE
    local_doctor_user uuid := '90000000-0000-0000-0000-000000000002';
    local_doctor_id   uuid := '30000000-0000-0000-0000-000000000005';
    bound_user        uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = local_doctor_user AND status = 'ACTIVE') THEN
        RAISE NOTICE 'V112: doctor@healthcare.local absent or inactive; skipping bind';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM doctors WHERE user_id = local_doctor_user AND active) THEN
        RAISE NOTICE 'V112: .local demo doctor already has an ACTIVE doctors row; skipping';
        RETURN;
    END IF;

    SELECT user_id INTO bound_user FROM doctors WHERE id = local_doctor_id;
    IF NOT FOUND THEN
        RAISE NOTICE 'V112: doctor row % not found; skipping bind', local_doctor_id;
        RETURN;
    END IF;

    IF bound_user IS NULL OR bound_user = local_doctor_user THEN
        UPDATE doctors
           SET user_id = local_doctor_user,
               active = TRUE
         WHERE id = local_doctor_id;
        RAISE NOTICE 'V112: bound doctor % to doctor@healthcare.local', local_doctor_id;
    ELSE
        RAISE NOTICE 'V112: doctor % already bound to another user (%); not stealing',
            local_doctor_id, bound_user;
    END IF;
END $$;
