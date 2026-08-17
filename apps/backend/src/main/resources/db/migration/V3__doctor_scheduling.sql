CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_schedule_day_of_week CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT ck_schedule_time_range CHECK (start_time < end_time),
    CONSTRAINT ck_schedule_slot_duration CHECK (slot_duration_minutes > 0)
);

CREATE TABLE doctor_schedule_exceptions (
    id UUID PRIMARY KEY,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    exception_date DATE NOT NULL,
    type VARCHAR(32) NOT NULL,
    custom_start_time TIME,
    custom_end_time TIME,
    reason VARCHAR(255),
    CONSTRAINT ck_exception_type CHECK (type IN ('CUSTOM_HOURS', 'BLOCKED', 'LEAVE'))
);

CREATE INDEX idx_schedules_doctor_branch ON doctor_schedules(doctor_id, branch_id);
CREATE INDEX idx_schedules_active ON doctor_schedules(active);
CREATE INDEX idx_exceptions_doctor_date ON doctor_schedule_exceptions(doctor_id, exception_date);
