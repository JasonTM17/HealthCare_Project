-- Clinical overlay for the committed V1-V4 foundation.
-- Legacy doctors/patients remain valid because account links are nullable.

ALTER TABLE doctors
    ADD COLUMN user_id UUID,
    ADD CONSTRAINT fk_doctors_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_doctors_user_id
    ON doctors(user_id)
    WHERE user_id IS NOT NULL;

ALTER TABLE patient_profiles
    ADD COLUMN user_id UUID,
    ADD CONSTRAINT fk_patient_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_patient_profiles_user_id
    ON patient_profiles(user_id)
    WHERE user_id IS NOT NULL;

CREATE TABLE medical_records (
    id UUID PRIMARY KEY,
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    icd10_code VARCHAR(20),
    icd10_name VARCHAR(255),
    diagnosis VARCHAR(2000) NOT NULL,
    symptoms_summary VARCHAR(2000),
    blood_pressure_systolic INT,
    blood_pressure_diastolic INT,
    heart_rate INT,
    temperature NUMERIC(4,1),
    weight_kg NUMERIC(5,2),
    height_cm NUMERIC(5,2),
    treatment_plan VARCHAR(3000),
    doctor_notes VARCHAR(2000),
    follow_up_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_medical_records_patient_created
    ON medical_records(patient_id, created_at DESC);
CREATE INDEX idx_medical_records_doctor_created
    ON medical_records(doctor_id, created_at DESC);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY,
    medical_record_id UUID REFERENCES medical_records(id) ON DELETE CASCADE,
    prescription_code VARCHAR(40) NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    diagnosis_summary VARCHAR(500),
    general_advice VARCHAR(2000),
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prescriptions_patient_created
    ON prescriptions(patient_id, created_at DESC);
CREATE INDEX idx_prescriptions_doctor_created
    ON prescriptions(doctor_id, created_at DESC);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY,
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    active_ingredient VARCHAR(255),
    dosage VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    frequency VARCHAR(150) NOT NULL,
    duration_days INT NOT NULL,
    total_quantity INT NOT NULL,
    usage_note VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prescription_items_prescription
    ON prescription_items(prescription_id);

CREATE TABLE diagnostic_results (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    test_name VARCHAR(200) NOT NULL,
    result VARCHAR(4000),
    file_url VARCHAR(500),
    test_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diagnostic_results_patient_date
    ON diagnostic_results(patient_id, test_date DESC);
CREATE INDEX idx_diagnostic_results_doctor_date
    ON diagnostic_results(doctor_id, test_date DESC);
