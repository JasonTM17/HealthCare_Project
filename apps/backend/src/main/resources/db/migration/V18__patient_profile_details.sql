ALTER TABLE patient_profiles
    ADD COLUMN date_of_birth DATE,
    ADD COLUMN gender VARCHAR(20) NOT NULL DEFAULT 'UNSPECIFIED',
    ADD COLUMN address VARCHAR(500),
    ADD COLUMN emergency_contact_name VARCHAR(160),
    ADD COLUMN emergency_contact_phone VARCHAR(20),
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD CONSTRAINT ck_patient_profile_gender
        CHECK (gender IN ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'));
