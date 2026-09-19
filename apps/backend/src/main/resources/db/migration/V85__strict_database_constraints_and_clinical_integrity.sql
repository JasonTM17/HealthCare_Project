-- ============================================================================
-- V85__strict_database_constraints_and_clinical_integrity.sql
-- 1. Enforce strict clinical constraints on doctor schedules (time windows, durations, ISO day).
-- 2. Enforce check constraints on ratings, prices, and appointment status enums.
-- 3. Enforce data validity constraints on articles and clinical entities.
-- 4. Create optimized compound performance indexes for high-traffic query paths.
-- ============================================================================

-- 1. DOCTOR SCHEDULES CONSTRAINTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_doctor_schedules_time_window'
    ) THEN
        ALTER TABLE doctor_schedules
        ADD CONSTRAINT check_doctor_schedules_time_window
        CHECK (start_time < end_time);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_doctor_schedules_slot_duration'
    ) THEN
        ALTER TABLE doctor_schedules
        ADD CONSTRAINT check_doctor_schedules_slot_duration
        CHECK (slot_duration_minutes > 0 AND slot_duration_minutes <= 240);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_doctor_schedules_day_of_week'
    ) THEN
        ALTER TABLE doctor_schedules
        ADD CONSTRAINT check_doctor_schedules_day_of_week
        CHECK (day_of_week BETWEEN 1 AND 7);
    END IF;
END $$;

-- 2. CLINICAL PRICING & RATING CONSTRAINTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_doctors_rating_range'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'doctors'
          AND column_name = 'rating'
    ) THEN
        ALTER TABLE doctors
        ADD CONSTRAINT check_doctors_rating_range
        CHECK (rating >= 0.0 AND rating <= 5.0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_packages_price_positive'
    ) THEN
        ALTER TABLE packages
        ADD CONSTRAINT check_packages_price_positive
        CHECK (price >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_services_price_positive'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'services'
          AND column_name = 'price'
    ) THEN
        ALTER TABLE services
        ADD CONSTRAINT check_services_price_positive
        CHECK (price >= 0);
    END IF;
END $$;

-- 3. APPOINTMENTS CLINICAL STATUS & TIME ORDER CONSTRAINTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_appointments_status_valid'
    ) THEN
        ALTER TABLE appointments
        ADD CONSTRAINT check_appointments_status_valid
        CHECK (status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_appointments_time_order'
    ) THEN
        ALTER TABLE appointments
        ADD CONSTRAINT check_appointments_time_order
        CHECK (end_time > start_time);
    END IF;
END $$;

-- 4. ARTICLES VALIDITY CONSTRAINTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_articles_slug_non_empty'
    ) THEN
        ALTER TABLE articles
        ADD CONSTRAINT check_articles_slug_non_empty
        CHECK (length(btrim(slug)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_articles_title_non_empty'
    ) THEN
        ALTER TABLE articles
        ADD CONSTRAINT check_articles_title_non_empty
        CHECK (length(btrim(title)) > 0);
    END IF;
END $$;

-- 5. PERFORMANCE COMPOUND INDEXES
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_lookup 
ON doctor_schedules (doctor_id, branch_id, day_of_week, active);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_status 
ON appointments (doctor_id, appointment_date, status);

CREATE INDEX IF NOT EXISTS idx_doctor_branches_composite 
ON doctor_branches (doctor_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_articles_specialty_published
ON articles (related_specialty_slug, published_at);
