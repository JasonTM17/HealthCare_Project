-- Moderated patient health Q&A workflow.
--
-- This is separate from the V26 AI transcript. Questions and answers remain
-- in Spring PostgreSQL, are retained for 90 days, and are never projected to
-- Supabase. Only normalized, PII-screened questions can enter moderation;
-- answer revisions are content-immutable and require an independent doctor
-- review before publication.

CREATE TABLE health_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_profile_id UUID NOT NULL
        REFERENCES patient_profiles(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    thread_id UUID REFERENCES patient_consultation_threads(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    topic_slug VARCHAR(180) NOT NULL,
    normalized_question VARCHAR(4000) NOT NULL,
    public_alias VARCHAR(80) NOT NULL,
    pii_scan_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    pii_scanned_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_MODERATION',
    moderator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    moderation_reason_code VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    deleted_at TIMESTAMP WITH TIME ZONE,
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_health_questions_topic_slug CHECK (
        topic_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        AND char_length(topic_slug) BETWEEN 1 AND 180
    ),
    CONSTRAINT ck_health_questions_normalized_question CHECK (
        char_length(btrim(normalized_question)) BETWEEN 1 AND 4000
        AND normalized_question !~ '[[:cntrl:]]'
        -- Email addresses.
        AND normalized_question !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
        -- Vietnamese/international mobile numbers (0xxxxxxxxx/+84).
        AND normalized_question !~* '(^|[^0-9])(?:\+?84|0)(?:3|5|7|8|9)[0-9]{8}([^0-9]|$)'
        -- Conservative 9-12 digit CCCD/identity-number guard.
        AND normalized_question !~ '(^|[^0-9])[0-9]{9,12}([^0-9]|$)'
    ),
    CONSTRAINT ck_health_questions_public_alias CHECK (
        public_alias ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{2,79}$'
    ),
    CONSTRAINT ck_health_questions_pii_scan_status CHECK (
        pii_scan_status IN ('PENDING', 'CLEAR', 'REDACTED', 'REJECTED')
    ),
    CONSTRAINT ck_health_questions_pii_scan_pair CHECK (
        (pii_scan_status = 'PENDING' AND pii_scanned_at IS NULL)
        OR (pii_scan_status <> 'PENDING' AND pii_scanned_at IS NOT NULL)
    ),
    CONSTRAINT ck_health_questions_status CHECK (
        status IN (
            'PENDING_MODERATION', 'AWAITING_DOCTOR', 'ANSWER_SUBMITTED',
            'PUBLISHED', 'REJECTED', 'CLOSED'
        )
    ),
    CONSTRAINT ck_health_questions_moderator_pair CHECK (
        (moderator_user_id IS NULL AND moderated_at IS NULL)
        OR (moderator_user_id IS NOT NULL AND moderated_at IS NOT NULL)
    ),
    CONSTRAINT ck_health_questions_moderation_reason CHECK (
        moderation_reason_code IS NULL
        OR moderation_reason_code IN ('PII_DETECTED', 'OUT_OF_SCOPE', 'DUPLICATE', 'SAFETY_REVIEW', 'OTHER')
    ),
    CONSTRAINT ck_health_questions_retention CHECK (
        retention_expires_at >= created_at
        AND retention_expires_at <= created_at + INTERVAL '90 days'
        AND (deleted_at IS NULL OR deleted_at >= created_at)
    ),
    CONSTRAINT ck_health_questions_publish_requires_clear_pii CHECK (
        status <> 'PUBLISHED' OR pii_scan_status = 'CLEAR'
    )
);

CREATE TABLE health_question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES health_questions(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    answer_text VARCHAR(4000) NOT NULL,
    answer_hash VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
    reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_reason_code VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    deleted_at TIMESTAMP WITH TIME ZONE,
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_health_question_answer_revision UNIQUE (question_id, revision),
    CONSTRAINT ck_health_question_answer_revision CHECK (revision > 0),
    CONSTRAINT ck_health_question_answer_text CHECK (
        char_length(btrim(answer_text)) BETWEEN 1 AND 4000
        AND answer_text !~ '[[:cntrl:]]'
    ),
    CONSTRAINT ck_health_question_answer_hash CHECK (
        answer_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_health_question_answer_status CHECK (
        status IN ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REVOKED')
    ),
    CONSTRAINT ck_health_question_answer_reviewer_pair CHECK (
        (reviewer_user_id IS NULL AND reviewed_at IS NULL)
        OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT ck_health_question_answer_no_self_approve CHECK (
        reviewer_user_id IS NULL OR reviewer_user_id <> doctor_user_id
    ),
    CONSTRAINT ck_health_question_answer_decision_pair CHECK (
        status = 'SUBMITTED'
        OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT ck_health_question_answer_review_reason CHECK (
        review_reason_code IS NULL
        OR review_reason_code IN ('APPROVED', 'CHANGES_REQUESTED', 'SAFETY_REVIEW', 'REVOKED')
    ),
    CONSTRAINT ck_health_question_answer_retention CHECK (
        retention_expires_at >= created_at
        AND retention_expires_at <= created_at + INTERVAL '90 days'
        AND (deleted_at IS NULL OR deleted_at >= created_at)
    )
);

CREATE TABLE health_question_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES health_questions(id) ON DELETE CASCADE,
    reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason_code VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    handled_by_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    handled_at TIMESTAMP WITH TIME ZONE,
    resolution_code VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
    synthetic_fixture BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_health_question_report_reason CHECK (
        reason_code IN (
            'PII_DETECTED', 'SAFETY_CONCERN', 'OUT_OF_SCOPE', 'DUPLICATE',
            'SPAM', 'LEGAL_REQUEST'
        )
    ),
    CONSTRAINT ck_health_question_report_status CHECK (
        status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')
    ),
    CONSTRAINT ck_health_question_report_admin_pair CHECK (
        (handled_by_admin_user_id IS NULL AND handled_at IS NULL)
        OR (handled_by_admin_user_id IS NOT NULL AND handled_at IS NOT NULL)
    ),
    CONSTRAINT ck_health_question_report_resolution_pair CHECK (
        (status IN ('RESOLVED', 'DISMISSED') AND resolution_code IS NOT NULL)
        OR (status IN ('OPEN', 'UNDER_REVIEW') AND resolution_code IS NULL)
    ),
    CONSTRAINT ck_health_question_report_resolution_code CHECK (
        resolution_code IS NULL
        OR resolution_code IN ('REMOVED', 'ESCALATED', 'DUPLICATE', 'DISMISSED', 'NO_ACTION')
    ),
    CONSTRAINT ck_health_question_report_retention CHECK (
        retention_expires_at >= created_at
        AND retention_expires_at <= created_at + INTERVAL '90 days'
    )
);

CREATE FUNCTION health_question_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    profile_user UUID;
    thread_patient UUID;
    appointment_patient UUID;
BEGIN
    SELECT user_id INTO profile_user
      FROM patient_profiles
     WHERE id = NEW.patient_profile_id;
    IF profile_user IS NULL OR profile_user <> NEW.author_user_id THEN
        RAISE EXCEPTION 'health question author must own the patient profile'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.thread_id IS NOT NULL THEN
        SELECT patient_profile_id INTO thread_patient
          FROM patient_consultation_threads
         WHERE id = NEW.thread_id;
        IF thread_patient IS NULL OR thread_patient <> NEW.patient_profile_id THEN
            RAISE EXCEPTION 'health question patient does not own the consultation thread'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.appointment_id IS NOT NULL THEN
        SELECT patient_id INTO appointment_patient
          FROM appointments
         WHERE id = NEW.appointment_id;
        IF appointment_patient IS NULL OR appointment_patient <> NEW.patient_profile_id THEN
            RAISE EXCEPTION 'health question patient does not own the appointment'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.moderator_user_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             JOIN users u ON u.id = ur.user_id
            WHERE ur.user_id = NEW.moderator_user_id
              AND r.code = 'ADMIN'
              AND u.status = 'ACTIVE'
       ) THEN
        RAISE EXCEPTION 'health question moderator must be an active ADMIN'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION health_question_answer_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    expected_hash VARCHAR(64);
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          JOIN users u ON u.id = ur.user_id
         WHERE ur.user_id = NEW.doctor_user_id
           AND r.code = 'DOCTOR'
           AND u.status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'health question answer author must be an active DOCTOR'
            USING ERRCODE = '42501';
    END IF;

    expected_hash := encode(digest(convert_to(NEW.answer_text, 'UTF8'), 'sha256'), 'hex');
    IF lower(NEW.answer_hash) <> expected_hash THEN
        RAISE EXCEPTION 'health question answer hash does not match immutable content'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.reviewer_user_id IS NOT NULL THEN
        IF NEW.reviewer_user_id = NEW.doctor_user_id THEN
            RAISE EXCEPTION 'answer author cannot approve their own revision'
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (
            SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              JOIN users u ON u.id = ur.user_id
             WHERE ur.user_id = NEW.reviewer_user_id
               AND r.code = 'DOCTOR'
               AND u.status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'answer reviewer must be an active DOCTOR'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.question_id <> OLD.question_id
           OR NEW.revision <> OLD.revision
           OR NEW.doctor_user_id <> OLD.doctor_user_id
           OR NEW.answer_text <> OLD.answer_text
           OR NEW.answer_hash <> OLD.answer_hash
           OR NEW.created_at <> OLD.created_at
           OR NEW.synthetic_fixture <> OLD.synthetic_fixture THEN
            RAISE EXCEPTION 'answer revisions are immutable'
                USING ERRCODE = '55006';
        END IF;
        IF OLD.status <> 'SUBMITTED'
           AND (
               NEW.status IS DISTINCT FROM OLD.status
               OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id
               OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
               OR NEW.review_reason_code IS DISTINCT FROM OLD.review_reason_code
           ) THEN
            RAISE EXCEPTION 'a decided answer revision cannot be decided twice'
                USING ERRCODE = '55006';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION health_question_report_admin_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NEW.handled_by_admin_user_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             JOIN users u ON u.id = ur.user_id
            WHERE ur.user_id = NEW.handled_by_admin_user_id
              AND r.code = 'ADMIN'
              AND u.status = 'ACTIVE'
       ) THEN
        RAISE EXCEPTION 'health question report handler must be an active ADMIN'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION health_question_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION health_question_answer_immutable_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('healthcare.retention_cleanup', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'health question answer revisions are immutable outside retention cleanup'
        USING ERRCODE = '55006';
END;
$$;

CREATE FUNCTION health_question_report_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('healthcare.retention_cleanup', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'health question reports are append-only outside retention cleanup'
        USING ERRCODE = '55006';
END;
$$;

CREATE TRIGGER trg_health_question_owner_guard
    BEFORE INSERT OR UPDATE ON health_questions
    FOR EACH ROW EXECUTE FUNCTION health_question_owner_guard();
CREATE TRIGGER trg_health_question_touch_updated_at
    BEFORE UPDATE ON health_questions
    FOR EACH ROW EXECUTE FUNCTION health_question_touch_updated_at();
CREATE TRIGGER trg_health_question_answer_guard
    BEFORE INSERT OR UPDATE ON health_question_answers
    FOR EACH ROW EXECUTE FUNCTION health_question_answer_guard();
CREATE TRIGGER trg_health_question_answer_immutable_delete
    BEFORE DELETE ON health_question_answers
    FOR EACH ROW EXECUTE FUNCTION health_question_answer_immutable_delete();
CREATE TRIGGER trg_health_question_report_admin_guard
    BEFORE INSERT OR UPDATE ON health_question_reports
    FOR EACH ROW EXECUTE FUNCTION health_question_report_admin_guard();
CREATE TRIGGER trg_health_question_report_immutable
    BEFORE UPDATE OR DELETE ON health_question_reports
    FOR EACH ROW EXECUTE FUNCTION health_question_report_immutable();

REVOKE EXECUTE ON FUNCTION health_question_owner_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION health_question_answer_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION health_question_report_admin_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION health_question_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION health_question_answer_immutable_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION health_question_report_immutable() FROM PUBLIC;

CREATE INDEX idx_health_questions_patient_created
    ON health_questions(patient_profile_id, created_at DESC, id DESC);
CREATE INDEX idx_health_questions_thread_status
    ON health_questions(thread_id, status, created_at DESC, id DESC);
CREATE INDEX idx_health_questions_topic_status
    ON health_questions(topic_slug, status, created_at DESC, id DESC);
CREATE INDEX idx_health_questions_retention
    ON health_questions(retention_expires_at, id);
CREATE INDEX idx_health_question_answers_question_revision
    ON health_question_answers(question_id, revision DESC, id DESC);
CREATE INDEX idx_health_question_answers_retention
    ON health_question_answers(retention_expires_at, id);
CREATE INDEX idx_health_question_reports_question_created
    ON health_question_reports(question_id, created_at DESC, id DESC);
CREATE INDEX idx_health_question_reports_open
    ON health_question_reports(status, created_at, id)
    WHERE status IN ('OPEN', 'UNDER_REVIEW');
CREATE INDEX idx_health_question_reports_retention
    ON health_question_reports(retention_expires_at, id);

-- V36 adds the nullable CMS link before this migration can create the target
-- question table; add the FK here so published FAQ rows cannot point at a
-- missing intake record.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'fk_faqs_origin_question'
    ) THEN
        ALTER TABLE faqs
            ADD CONSTRAINT fk_faqs_origin_question
            FOREIGN KEY (origin_question_id)
            REFERENCES health_questions(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON TABLE health_questions IS
    'Patient health Q&A intake; normalized PII-screened text, exact moderation state, 90-day retention.';
COMMENT ON TABLE health_question_answers IS
    'Immutable SHA-256 answer revisions; only an independent active DOCTOR may review/approve.';
COMMENT ON TABLE health_question_reports IS
    'ADMIN-routed report with enum reason only; no sensitive free-text report body.';
