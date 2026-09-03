-- ==============================================================================
-- V54: Patient & Doctor profile enhancements (avatar, medical history, achievements)
-- ==============================================================================

ALTER TABLE patient_profiles
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS medical_history TEXT,
    ADD COLUMN IF NOT EXISTS allergies TEXT,
    ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10);

ALTER TABLE doctors
    ADD COLUMN IF NOT EXISTS achievements TEXT;
