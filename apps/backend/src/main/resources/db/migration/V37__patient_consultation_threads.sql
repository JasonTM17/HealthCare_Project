-- Patient/doctor consultation thread contract.
--
-- One thread belongs to one appointment.  The appointment must be confirmed,
-- checked-in, in-progress or completed; the interaction window ends exactly
-- 30 days after the appointment visit.  Message-like content is retained for
-- 90 days.  Audit events intentionally have no content-retention deadline.

-- PostgreSQL requires a matching unique key for the composite appointment
-- identity FK below and for the care-plan linkage introduced in V39.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'appointments'::regclass
           AND conname = 'uq_appointments_patient_doctor_identity'
    ) THEN
        ALTER TABLE appointments
            ADD CONSTRAINT uq_appointments_patient_doctor_identity
            UNIQUE (id, patient_id, doctor_id);
    END IF;
END $$;

CREATE TABLE patient_consultation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL UNIQUE,
    patient_profile_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    subject VARCHAR(240) NOT NULL,
    consent_version VARCHAR(64),
    consented_at TIMESTAMP WITH TIME ZONE,
    consultation_open_until TIMESTAMP WITH TIME ZONE NOT NULL,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    first_response_due_at TIMESTAMP WITH TIME ZONE,
    first_responded_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_patient_consultation_thread_identity
        UNIQUE (id, patient_profile_id, doctor_id),
    CONSTRAINT fk_patient_consultation_thread_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_patient_consultation_thread_patient
        FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_patient_consultation_thread_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    CONSTRAINT ck_patient_consultation_thread_status CHECK (
        status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT',
                   'RESOLVED', 'CLOSED', 'EXPIRED')
    ),
    CONSTRAINT ck_patient_consultation_thread_subject CHECK (
        char_length(btrim(subject)) BETWEEN 1 AND 240
    ),
    CONSTRAINT ck_patient_consultation_thread_consent_pair CHECK (
        (consent_version IS NULL) = (consented_at IS NULL)
    ),
    CONSTRAINT ck_patient_consultation_thread_consent_version CHECK (
        consent_version IS NULL OR char_length(btrim(consent_version)) BETWEEN 1 AND 64
    ),
    CONSTRAINT ck_patient_consultation_thread_window CHECK (
        consultation_open_until > created_at
        AND retention_expires_at >= consultation_open_until
        AND (
            first_response_due_at IS NULL
            OR first_response_due_at <= consultation_open_until
        )
    ),
    CONSTRAINT ck_patient_consultation_thread_version CHECK (version >= 0),
    CONSTRAINT ck_patient_consultation_thread_response CHECK (
        first_responded_at IS NULL OR first_responded_at >= created_at
    )
);

CREATE TABLE patient_consultation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES patient_consultation_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_role VARCHAR(24) NOT NULL,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assignment_permission VARCHAR(24) NOT NULL DEFAULT 'METADATA_ONLY',
    assignment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_patient_consultation_participant UNIQUE (thread_id, user_id, participant_role),
    CONSTRAINT uq_patient_consultation_participant_identity UNIQUE (id, thread_id),
    CONSTRAINT ck_patient_consultation_participant_role CHECK (
        participant_role IN ('PATIENT', 'ASSIGNED_DOCTOR', 'HANDOFF_DOCTOR')
    ),
    CONSTRAINT ck_patient_consultation_participant_assignment CHECK (
        assignment_permission = 'METADATA_ONLY'
        AND jsonb_typeof(assignment_metadata) = 'object'
        AND pg_column_size(assignment_metadata) <= 8192
    ),
    CONSTRAINT ck_patient_consultation_participant_assigned_by CHECK (
        (participant_role = 'PATIENT' AND assigned_by_user_id IS NULL)
        OR (participant_role <> 'PATIENT' AND assigned_by_user_id IS NOT NULL)
    ),
    CONSTRAINT ck_patient_consultation_participant_dates CHECK (
        left_at IS NULL OR left_at >= joined_at
    ),
    CONSTRAINT ck_patient_consultation_participant_retention CHECK (
        retention_expires_at >= joined_at
        AND retention_expires_at <= joined_at + INTERVAL '90 days'
    )
);

CREATE UNIQUE INDEX uq_patient_consultation_patient_participant
    ON patient_consultation_participants(thread_id)
    WHERE participant_role = 'PATIENT';
CREATE UNIQUE INDEX uq_patient_consultation_assigned_doctor
    ON patient_consultation_participants(thread_id)
    WHERE participant_role = 'ASSIGNED_DOCTOR';

CREATE TABLE patient_consultation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES patient_consultation_threads(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_role_snapshot VARCHAR(16) NOT NULL,
    author_participant_id UUID,
    sequence_number BIGINT NOT NULL,
    body VARCHAR(4000) NOT NULL,
    message_kind VARCHAR(24) NOT NULL DEFAULT 'TEXT',
    idempotency_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_patient_consultation_message_identity UNIQUE (id, thread_id),
    CONSTRAINT uq_patient_consultation_message_sequence UNIQUE (thread_id, sequence_number),
    CONSTRAINT uq_patient_consultation_message_idempotency
        UNIQUE (thread_id, author_user_id, idempotency_key),
    CONSTRAINT fk_patient_consultation_message_participant
        FOREIGN KEY (author_participant_id, thread_id)
        REFERENCES patient_consultation_participants(id, thread_id)
        ON DELETE SET NULL (author_participant_id),
    CONSTRAINT ck_patient_consultation_message_role CHECK (
        author_role_snapshot IN ('PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM')
    ),
    CONSTRAINT ck_patient_consultation_message_sequence CHECK (sequence_number > 0),
    CONSTRAINT ck_patient_consultation_message_body CHECK (
        char_length(btrim(body)) BETWEEN 1 AND 4000
    ),
    CONSTRAINT ck_patient_consultation_message_kind CHECK (
        message_kind IN ('TEXT', 'SYSTEM', 'QUESTION', 'ANSWER', 'HANDOFF')
    ),
    CONSTRAINT ck_patient_consultation_message_retention CHECK (
        retention_expires_at >= created_at
        AND retention_expires_at <= created_at + INTERVAL '90 days'
    )
);

CREATE TABLE patient_consultation_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES patient_consultation_threads(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,
    private_object_key VARCHAR(512) NOT NULL,
    actual_mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    scan_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_patient_consultation_attachment_message
        FOREIGN KEY (message_id, thread_id)
        REFERENCES patient_consultation_messages(id, thread_id) ON DELETE CASCADE,
    CONSTRAINT ck_patient_consultation_attachment_object_key CHECK (
        private_object_key LIKE 'private/consultations/%'
        AND char_length(private_object_key) BETWEEN 1 AND 512
        AND private_object_key !~ '[[:cntrl:]]'
        AND private_object_key NOT LIKE '%..%'
        AND position(chr(92) IN private_object_key) = 0
    ),
    CONSTRAINT ck_patient_consultation_attachment_mime CHECK (
        actual_mime_type IN ('image/jpeg', 'image/png', 'application/pdf')
    ),
    CONSTRAINT ck_patient_consultation_attachment_size CHECK (
        size_bytes BETWEEN 1 AND 10485760
    ),
    CONSTRAINT ck_patient_consultation_attachment_hash CHECK (
        sha256_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_patient_consultation_attachment_scan CHECK (
        scan_status IN ('PENDING', 'CLEAN', 'REJECTED')
    ),
    CONSTRAINT ck_patient_consultation_attachment_retention CHECK (
        retention_expires_at >= created_at
        AND retention_expires_at <= created_at + INTERVAL '90 days'
    )
);

CREATE TABLE patient_consultation_read_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES patient_consultation_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id UUID,
    last_read_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_patient_consultation_read_state UNIQUE (thread_id, user_id),
    CONSTRAINT fk_patient_consultation_read_message
        FOREIGN KEY (last_read_message_id, thread_id)
        REFERENCES patient_consultation_messages(id, thread_id)
        ON DELETE SET NULL (last_read_message_id),
    CONSTRAINT ck_patient_consultation_read_state_retention CHECK (
        retention_expires_at >= updated_at
        AND retention_expires_at <= updated_at + INTERVAL '90 days'
    )
);

CREATE TABLE patient_consultation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES patient_consultation_threads(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role_snapshot VARCHAR(16),
    event_type VARCHAR(32) NOT NULL,
    correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_patient_consultation_event_correlation UNIQUE (thread_id, correlation_id),
    CONSTRAINT ck_patient_consultation_event_type CHECK (
        event_type IN ('ASSIGNMENT', 'HANDOFF', 'READ_FILE', 'STATUS_CHANGE',
                       'SCAN_RESULT', 'RETENTION', 'CREATED', 'MESSAGE_SENT')
    ),
    CONSTRAINT ck_patient_consultation_event_role CHECK (
        actor_role_snapshot IS NULL
        OR actor_role_snapshot IN ('PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM')
    ),
    CONSTRAINT ck_patient_consultation_event_metadata CHECK (
        jsonb_typeof(metadata) = 'object' AND pg_column_size(metadata) <= 16384
    )
);

CREATE FUNCTION patient_consultation_thread_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION patient_consultation_thread_window_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    appointment_status VARCHAR(32);
    appointment_at TIMESTAMP WITH TIME ZONE;
    expected_open TIMESTAMP WITH TIME ZONE;
    expected_retention TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT status, appointment_time
      INTO appointment_status, appointment_at
      FROM appointments
     WHERE id = NEW.appointment_id
       AND patient_id = NEW.patient_profile_id
       AND doctor_id = NEW.doctor_id;
    IF appointment_at IS NULL OR appointment_status NOT IN
        ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED') THEN
        RAISE EXCEPTION 'consultation requires a confirmed/check-in/completed appointment'
            USING ERRCODE = '42501';
    END IF;
    expected_open := appointment_at + INTERVAL '30 days';
    expected_retention := appointment_at + INTERVAL '90 days';
    IF TG_OP = 'INSERT' THEN
        NEW.consultation_open_until := expected_open;
        NEW.retention_expires_at := expected_retention;
    ELSE
        IF NEW.consultation_open_until <> OLD.consultation_open_until
           OR NEW.retention_expires_at <> OLD.retention_expires_at THEN
            RAISE EXCEPTION 'consultation window and retention deadline are database-owned'
                USING ERRCODE = '23514';
        END IF;
        IF NEW.version <> OLD.version + 1 THEN
            RAISE EXCEPTION 'consultation optimistic version must advance by one'
                USING ERRCODE = '40001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION patient_consultation_participant_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    thread_patient UUID;
    thread_doctor UUID;
    expected_user UUID;
BEGIN
    SELECT patient_profile_id, doctor_id
      INTO thread_patient, thread_doctor
      FROM patient_consultation_threads
     WHERE id = NEW.thread_id;
    IF thread_patient IS NULL THEN
        RAISE EXCEPTION 'consultation thread does not exist' USING ERRCODE = '23503';
    END IF;
    IF NEW.participant_role = 'PATIENT' THEN
        SELECT user_id INTO expected_user FROM patient_profiles WHERE id = thread_patient;
        IF expected_user IS NULL OR expected_user <> NEW.user_id THEN
            RAISE EXCEPTION 'patient participant does not match the consultation owner'
                USING ERRCODE = '42501';
        END IF;
    ELSIF NEW.participant_role = 'ASSIGNED_DOCTOR' THEN
        SELECT user_id INTO expected_user FROM doctors WHERE id = thread_doctor;
        IF expected_user IS NULL OR expected_user <> NEW.user_id THEN
            RAISE EXCEPTION 'assigned doctor participant does not match the appointment'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1
              FROM doctors d
              JOIN users u ON u.id = d.user_id
              JOIN user_roles ur ON ur.user_id = u.id
              JOIN roles r ON r.id = ur.role_id
             WHERE u.id = NEW.user_id
               AND d.active
               AND u.status = 'ACTIVE'
               AND r.code = 'DOCTOR'
        ) THEN
            RAISE EXCEPTION 'handoff participant must be an active DOCTOR'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION patient_consultation_message_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('healthcare.retention_cleanup', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'consultation messages are immutable outside retention cleanup'
        USING ERRCODE = '55006';
END;
$$;

CREATE FUNCTION patient_consultation_attachment_limit_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    attachment_count INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT count(*) INTO attachment_count
          FROM patient_consultation_attachments
         WHERE message_id = NEW.message_id;
        IF attachment_count >= 3 THEN
            RAISE EXCEPTION 'a consultation message may have at most three attachments'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION patient_consultation_event_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'consultation audit events are append-only'
        USING ERRCODE = '55006';
END;
$$;

CREATE TRIGGER trg_patient_consultation_thread_touch_updated_at
    BEFORE UPDATE ON patient_consultation_threads
    FOR EACH ROW EXECUTE FUNCTION patient_consultation_thread_touch_updated_at();
CREATE TRIGGER trg_patient_consultation_thread_window_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_threads
    FOR EACH ROW EXECUTE FUNCTION patient_consultation_thread_window_guard();
CREATE TRIGGER trg_patient_consultation_participant_guard
    BEFORE INSERT OR UPDATE ON patient_consultation_participants
    FOR EACH ROW EXECUTE FUNCTION patient_consultation_participant_guard();
CREATE TRIGGER trg_patient_consultation_message_immutable
    BEFORE UPDATE OR DELETE ON patient_consultation_messages
    FOR EACH ROW EXECUTE FUNCTION patient_consultation_message_immutable();
CREATE TRIGGER trg_patient_consultation_attachment_limit
    BEFORE INSERT ON patient_consultation_attachments
    FOR EACH ROW EXECUTE FUNCTION patient_consultation_attachment_limit_guard();
CREATE TRIGGER trg_patient_consultation_event_immutable
    BEFORE UPDATE OR DELETE ON patient_consultation_events
    FOR EACH ROW EXECUTE FUNCTION patient_consultation_event_immutable();

REVOKE EXECUTE ON FUNCTION patient_consultation_thread_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_consultation_thread_window_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_consultation_participant_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_consultation_message_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_consultation_attachment_limit_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patient_consultation_event_immutable() FROM PUBLIC;

CREATE INDEX idx_patient_consultation_threads_patient_status
    ON patient_consultation_threads(patient_profile_id, status, updated_at DESC, id DESC);
CREATE INDEX idx_patient_consultation_threads_doctor_status
    ON patient_consultation_threads(doctor_id, status, updated_at DESC, id DESC);
CREATE INDEX idx_patient_consultation_threads_window
    ON patient_consultation_threads(consultation_open_until, id)
    WHERE status IN ('OPEN', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_PATIENT');
CREATE INDEX idx_patient_consultation_threads_retention
    ON patient_consultation_threads(retention_expires_at, id);
CREATE INDEX idx_patient_consultation_participants_user
    ON patient_consultation_participants(user_id, thread_id);
CREATE INDEX idx_patient_consultation_messages_thread_sequence
    ON patient_consultation_messages(thread_id, sequence_number DESC, id DESC);
CREATE INDEX idx_patient_consultation_messages_retention
    ON patient_consultation_messages(retention_expires_at, id);
CREATE INDEX idx_patient_consultation_attachments_message
    ON patient_consultation_attachments(message_id, created_at, id);
CREATE INDEX idx_patient_consultation_attachments_retention
    ON patient_consultation_attachments(retention_expires_at, id);
CREATE INDEX idx_patient_consultation_read_states_user
    ON patient_consultation_read_states(user_id, thread_id);
CREATE INDEX idx_patient_consultation_read_states_retention
    ON patient_consultation_read_states(retention_expires_at, id);
CREATE INDEX idx_patient_consultation_events_thread_time
    ON patient_consultation_events(thread_id, occurred_at DESC, id DESC);

COMMENT ON TABLE patient_consultation_threads IS
    'Exactly one thread per appointment; visit-to-30-day window, 90-day content retention, optimistic versioning.';
COMMENT ON COLUMN patient_consultation_participants.assignment_permission IS
    'Coordinator assignment is metadata-only; it grants no transcript or attachment access.';
COMMENT ON TABLE patient_consultation_events IS
    'Append-only assignment/handoff/read-file/status/scan/retention audit; retained outside 90-day content cleanup.';
