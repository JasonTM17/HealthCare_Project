-- Only the five fixed synthetic rows of the reviewed dashboard demonstration.
-- This does not enable the generic beta allowlist or remote AI. Data is applied
-- separately in one collision-checked, audited transaction; deletion/reseeding
-- is not a supported operation. Existing V39 behavior is retained below.
CREATE OR REPLACE FUNCTION enforce_synthetic_fixture_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    guard_row BOOLEAN;
    owned_row BOOLEAN := FALSE;
    valid_owned BOOLEAN := FALSE;
BEGIN
    IF TG_TABLE_SCHEMA = 'public' THEN
        IF TG_TABLE_NAME = 'users' THEN
            owned_row := NEW.id IN ('18eb4aa3-6d44-5991-aa1a-4a6f93eae9e3'::uuid, '4821fd5a-71e8-5cd3-9daa-bf7f77aa54e7'::uuid)
                OR (TG_OP = 'UPDATE' AND OLD.id IN ('18eb4aa3-6d44-5991-aa1a-4a6f93eae9e3'::uuid, '4821fd5a-71e8-5cd3-9daa-bf7f77aa54e7'::uuid));
            IF owned_row THEN
                valid_owned := NEW.synthetic_fixture AND NEW.is_demo AND NEW.email_verified
                    AND NEW.google_subject IS NULL
                    AND CASE NEW.id
                        WHEN '18eb4aa3-6d44-5991-aa1a-4a6f93eae9e3'::uuid THEN
                            NEW.status = 'ACTIVE' AND NEW.email = 'dashboard-patient@fixture.invalid'
                        WHEN '4821fd5a-71e8-5cd3-9daa-bf7f77aa54e7'::uuid THEN
                            NEW.status = 'DISABLED' AND NEW.email = 'dashboard-disabled@fixture.invalid'
                        ELSE FALSE END;
            END IF;
        ELSIF TG_TABLE_NAME = 'patient_profiles' THEN
            owned_row := NEW.id = 'b41a19a6-74b9-5e8a-97ea-65eb80a45e9d'::uuid
                OR (TG_OP = 'UPDATE' AND OLD.id = 'b41a19a6-74b9-5e8a-97ea-65eb80a45e9d'::uuid);
            IF owned_row THEN
                valid_owned := NEW.synthetic_fixture AND NEW.user_id = '18eb4aa3-6d44-5991-aa1a-4a6f93eae9e3'::uuid;
            END IF;
        ELSIF TG_TABLE_NAME = 'appointments' THEN
            owned_row := NEW.id = '8ef669c2-1381-5813-b85a-3a1b547632fb'::uuid
                OR (TG_OP = 'UPDATE' AND OLD.id = '8ef669c2-1381-5813-b85a-3a1b547632fb'::uuid);
            IF owned_row THEN
                valid_owned := NEW.synthetic_fixture
                    AND NEW.patient_id = 'b41a19a6-74b9-5e8a-97ea-65eb80a45e9d'::uuid
                    AND NEW.doctor_id = '6c030bfb-8e22-56cc-95ba-6906b8b618a2'::uuid
                    AND NEW.branch_id = 'd13cad67-4ef1-5f42-92a9-7b842af73b7c'::uuid
                    AND NEW.package_id = 'af17f1da-d5d0-5b62-adf0-56bb42e980d2'::uuid
                    AND NEW.specialty_id IS NULL AND NEW.status IN ('CONFIRMED', 'CANCELLED')
                    AND EXISTS (SELECT 1 FROM doctors d WHERE d.id=NEW.doctor_id AND NOT d.active AND d.user_id IS NULL)
                    AND EXISTS (SELECT 1 FROM branches b WHERE b.id=NEW.branch_id AND NOT b.active)
                    AND EXISTS (SELECT 1 FROM packages p WHERE p.id=NEW.package_id AND NOT p.active AND p.price>0);
                IF TG_OP = 'UPDATE' THEN
                    valid_owned := valid_owned AND NEW.appointment_date=OLD.appointment_date
                        AND NEW.start_time=OLD.start_time AND NEW.end_time=OLD.end_time
                        AND NEW.appointment_time=OLD.appointment_time
                        AND (OLD.status <> 'CANCELLED' OR NEW.status='CANCELLED');
                END IF;
            END IF;
        ELSIF TG_TABLE_NAME = 'health_questions' THEN
            owned_row := NEW.id = '7ae5d5ff-35f4-550c-9bed-5f97313a925b'::uuid
                OR (TG_OP = 'UPDATE' AND OLD.id = '7ae5d5ff-35f4-550c-9bed-5f97313a925b'::uuid);
            IF owned_row THEN
                valid_owned := NEW.synthetic_fixture
                    AND NEW.patient_profile_id = 'b41a19a6-74b9-5e8a-97ea-65eb80a45e9d'::uuid
                    AND NEW.author_user_id = '18eb4aa3-6d44-5991-aa1a-4a6f93eae9e3'::uuid
                    AND NEW.thread_id IS NULL AND NEW.appointment_id IS NULL
                    AND NEW.status='PENDING_MODERATION' AND NEW.pii_scan_status='CLEAR';
            END IF;
        END IF;
    END IF;
    IF owned_row THEN
        IF TG_OP='UPDATE' THEN
            valid_owned := valid_owned AND OLD.synthetic_fixture AND NEW.id=OLD.id;
        END IF;
        IF valid_owned IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'Dashboard demonstration identity or stored graph is immutable'
                USING ERRCODE='42501';
        END IF;
        RETURN NEW;
    END IF;

    -- Original V39 generic guard: unchanged for every non-owned row/table.
    IF NEW.synthetic_fixture THEN
        IF TG_OP = 'INSERT' THEN
            NULL;
        ELSIF TG_OP = 'UPDATE' AND NOT OLD.synthetic_fixture THEN
            NULL;
        ELSE
            RETURN NEW;
        END IF;
        UPDATE synthetic_beta_guard
           SET rows_written = rows_written + 1,
               updated_at = CURRENT_TIMESTAMP
         WHERE guard_id
           AND allowlist_state = 'ENABLED'
           AND environment IN ('LOCAL', 'TEST', 'STAGING')
           AND expires_at > CURRENT_TIMESTAMP
           AND rows_written < row_budget
         RETURNING guard_id INTO guard_row;
        IF guard_row IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'synthetic_fixture requires an active bounded allowlist'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
