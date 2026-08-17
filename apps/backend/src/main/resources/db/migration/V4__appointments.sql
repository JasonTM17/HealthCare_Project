CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY,
    full_name VARCHAR(160) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(320)
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY,
    booking_code VARCHAR(32) UNIQUE,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    specialty_id UUID REFERENCES specialties(id) ON DELETE RESTRICT,
    package_id UUID REFERENCES packages(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
    reason_for_visit VARCHAR(1000),
    notes VARCHAR(2000),
    cancellation_reason VARCHAR(500),
    hold_expires_at TIMESTAMP WITH TIME ZONE,
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_appointment_status CHECK (status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    CONSTRAINT ck_payment_status CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED'))
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_time ON appointments(doctor_id, appointment_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_booking_code ON appointments(booking_code);
CREATE INDEX idx_patient_profiles_phone ON patient_profiles(phone);
