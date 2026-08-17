CREATE TABLE medical_records (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    diagnosis VARCHAR(1000),
    notes VARCHAR(4000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY,
    medical_record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    medication VARCHAR(200) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    instructions VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE diagnostic_results (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    test_name VARCHAR(200) NOT NULL,
    result VARCHAR(4000),
    file_url VARCHAR(500),
    test_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX idx_prescriptions_record ON prescriptions(medical_record_id);
CREATE INDEX idx_diagnostic_patient ON diagnostic_results(patient_id);
