-- ==============================================================================
-- Flyway Migration V3: Appointment Booking Engine & Doctor Schedules
-- ==============================================================================

-- 1. Patient Profiles (Separate administrative medical record from raw auth user)
CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(180) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(20),
    id_card_number VARCHAR(30),
    health_insurance_number VARCHAR(50),
    address VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_profiles_phone ON patient_profiles(phone);
CREATE INDEX idx_patient_profiles_user_id ON patient_profiles(user_id);

-- 2. Doctor Schedules (Working shifts and timetable)
CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT NOT NULL DEFAULT 30,
    max_patients_per_slot INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctor_schedules_lookup ON doctor_schedules(doctor_id, day_of_week, active);

-- 3. Appointments / Bookings
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code VARCHAR(40) NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    specialty_id UUID REFERENCES specialties(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CONFIRMATION', 
    -- Statuses: PENDING_CONFIRMATION, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW
    hold_expires_at TIMESTAMPTZ,
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMPTZ,
    reason_for_visit TEXT,
    notes TEXT,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID_DIRECT, PAID_ONLINE
    cancellation_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compound index for rapid slot conflict detection & concurrency checks
CREATE INDEX idx_appointments_slot_check ON appointments(doctor_id, appointment_date, start_time, status);
CREATE INDEX idx_appointments_patient ON appointments(patient_id, appointment_date);
CREATE INDEX idx_appointments_booking_code ON appointments(booking_code);
CREATE INDEX idx_appointments_hold_expiry ON appointments(status, hold_expires_at);

-- Seed baseline sample doctor schedules (Mon-Fri 08:00-12:00 and 13:30-17:00)
-- For all seeded doctors across all branches
DO $$
DECLARE
    doc_rec RECORD;
    br_id UUID;
    d_day INT;
BEGIN
    SELECT id INTO br_id FROM branches LIMIT 1;
    FOR doc_rec IN SELECT id FROM doctors LOOP
        FOR d_day IN 1..5 LOOP
            -- Morning shift 08:00 - 11:30
            INSERT INTO doctor_schedules (doctor_id, branch_id, day_of_week, start_time, end_time, slot_duration_minutes)
            VALUES (doc_rec.id, br_id, d_day, '08:00:00', '11:30:00', 30);
            -- Afternoon shift 13:30 - 17:00
            INSERT INTO doctor_schedules (doctor_id, branch_id, day_of_week, start_time, end_time, slot_duration_minutes)
            VALUES (doc_rec.id, br_id, d_day, '13:30:00', '17:00:00', 30);
        END LOOP;
    END LOOP;
END $$;
