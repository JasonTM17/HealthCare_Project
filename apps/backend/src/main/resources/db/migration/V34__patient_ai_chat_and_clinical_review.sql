-- Additive patient-chat and clinical-content governance contract.
--
-- Spring/PostgreSQL remains the authority for patient chat history and for the
-- source revisions that may be presented to the AI service.  The migration is
-- deliberately append-only: V26/V27/V29/V30 are already applied contracts and
-- are not rewritten here.

-- Canonical JSON hashes are computed from PostgreSQL jsonb's deterministic text
-- representation.  The extension is already available in the Postgres images
-- used by the project and is required for a real SHA-256 (not an MD5 surrogate).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Patient conversation contract
-- ---------------------------------------------------------------------------

ALTER TABLE ai_conversations
    ADD COLUMN mode VARCHAR(32) NOT NULL DEFAULT 'HOSPITAL_SUPPORT',
    ADD COLUMN consent_version VARCHAR(64),
    ADD COLUMN consented_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE ai_conversations
    ADD CONSTRAINT ck_ai_conversations_mode
        CHECK (mode IN ('HOSPITAL_SUPPORT', 'SYMPTOM_TRIAGE', 'HEALTH_EDUCATION')),
    ADD CONSTRAINT ck_ai_conversations_consent_pair
        CHECK ((consent_version IS NULL) = (consented_at IS NULL)),
    ADD CONSTRAINT ck_ai_conversations_consent_version
        CHECK (consent_version IS NULL OR char_length(btrim(consent_version)) BETWEEN 1 AND 64);

ALTER TABLE ai_messages
    ADD COLUMN safety_action VARCHAR(32);

-- Persist the bounded, non-diagnostic triage summary so history reloads do
-- not silently lose the urgency/specialty contract.  Suggested actions remain
-- derived from the current catalog and are intentionally not stored.
ALTER TABLE ai_messages
    ADD COLUMN triage JSONB;

ALTER TABLE ai_messages
    ADD CONSTRAINT ck_ai_messages_safety_action
        CHECK (
            safety_action IS NULL
            OR safety_action IN (
                'ANSWER', 'REFUSE', 'EMERGENCY', 'HUMAN_HANDOFF',
                'INSUFFICIENT_EVIDENCE'
            )
        );

ALTER TABLE ai_messages
    ADD CONSTRAINT ck_ai_messages_triage
        CHECK (
            triage IS NULL
            OR (
                jsonb_typeof(triage) = 'object'
                AND pg_column_size(triage) <= 4096
            )
        );

CREATE INDEX idx_ai_conversations_mode_updated
    ON ai_conversations(mode, updated_at DESC, id DESC);

CREATE TABLE ai_message_feedback (
    assistant_message_id UUID PRIMARY KEY,
    -- Ownership is intentionally resolved through the assistant message's
    -- conversation and Spring authorization; user_id is not duplicated here.
    rating VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ai_message_feedback_message
        FOREIGN KEY (assistant_message_id)
        REFERENCES ai_messages(id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_message_feedback_rating
        CHECK (rating IN ('HELPFUL', 'NOT_HELPFUL'))
);

CREATE INDEX idx_ai_message_feedback_updated
    ON ai_message_feedback(updated_at DESC, assistant_message_id);

CREATE FUNCTION ai_message_feedback_validate_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_role VARCHAR(16);
    target_status VARCHAR(24);
BEGIN
    SELECT role, status
      INTO target_role, target_status
      FROM ai_messages
     WHERE id = NEW.assistant_message_id;

    IF target_role IS DISTINCT FROM 'ASSISTANT'
       OR target_status IS DISTINCT FROM 'COMPLETED' THEN
        RAISE EXCEPTION
            'feedback is allowed only for a completed assistant message'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_message_feedback_validate_target
    BEFORE INSERT OR UPDATE ON ai_message_feedback
    FOR EACH ROW
    EXECUTE FUNCTION ai_message_feedback_validate_target();

-- ---------------------------------------------------------------------------
-- Immutable source revisions and current eligibility heads
-- ---------------------------------------------------------------------------

CREATE TABLE ai_content_revisions (
    source_type VARCHAR(16) NOT NULL,
    source_id UUID NOT NULL,
    content_revision BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    content_snapshot JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_ai_content_revisions
        PRIMARY KEY (source_type, source_id, content_revision),
    CONSTRAINT uq_ai_content_revisions_hash
        UNIQUE (source_type, source_id, content_revision, content_hash),
    CONSTRAINT ck_ai_content_revisions_source_type
        CHECK (source_type IN ('SPECIALTY', 'ARTICLE', 'FAQ')),
    CONSTRAINT ck_ai_content_revisions_revision
        CHECK (content_revision > 0),
    CONSTRAINT ck_ai_content_revisions_hash
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_ai_content_revisions_snapshot
        CHECK (jsonb_typeof(content_snapshot) = 'object'),
    CONSTRAINT ck_ai_content_revisions_snapshot_size
        CHECK (pg_column_size(content_snapshot) <= 131072)
);

CREATE FUNCTION ai_content_revisions_validate_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    computed_hash VARCHAR(64);
BEGIN
    computed_hash := encode(
        digest(convert_to(NEW.content_snapshot::text, 'UTF8'), 'sha256'),
        'hex'
    );

    IF lower(NEW.content_hash) IS DISTINCT FROM computed_hash THEN
        RAISE EXCEPTION
            'content_hash does not match canonical content_snapshot'
            USING ERRCODE = '23514';
    END IF;

    NEW.content_hash := computed_hash;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_content_revisions_validate_hash
    BEFORE INSERT OR UPDATE ON ai_content_revisions
    FOR EACH ROW
    EXECUTE FUNCTION ai_content_revisions_validate_hash();

CREATE FUNCTION ai_content_revisions_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'ai_content_revisions is append-only'
        USING ERRCODE = '55006';
END;
$$;

CREATE TRIGGER trg_ai_content_revisions_immutable
    BEFORE UPDATE OR DELETE ON ai_content_revisions
    FOR EACH ROW
    EXECUTE FUNCTION ai_content_revisions_immutable();

CREATE TABLE ai_content_review_heads (
    source_type VARCHAR(16) NOT NULL,
    source_id UUID NOT NULL,
    content_revision BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    eligibility_revision BIGINT NOT NULL DEFAULT 1,
    eligibility_state VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    current_approval_round BIGINT,
    edited_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_ai_content_review_heads
        PRIMARY KEY (source_type, source_id),
    CONSTRAINT fk_ai_content_review_heads_revision
        FOREIGN KEY (source_type, source_id, content_revision, content_hash)
        REFERENCES ai_content_revisions(
            source_type, source_id, content_revision, content_hash
        ) ON DELETE RESTRICT,
    CONSTRAINT ck_ai_content_review_heads_source_type
        CHECK (source_type IN ('SPECIALTY', 'ARTICLE', 'FAQ')),
    CONSTRAINT ck_ai_content_review_heads_content_revision
        CHECK (content_revision > 0),
    CONSTRAINT ck_ai_content_review_heads_hash
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_ai_content_review_heads_eligibility_revision
        CHECK (eligibility_revision > 0),
    CONSTRAINT ck_ai_content_review_heads_state
        CHECK (
            eligibility_state IN (
                'DRAFT', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED',
                'REVOKED', 'EXPIRED'
            )
        ),
    CONSTRAINT ck_ai_content_review_heads_round
        CHECK (current_approval_round IS NULL OR current_approval_round > 0),
    CONSTRAINT ck_ai_content_review_heads_approval_metadata
        CHECK (
            (
                eligibility_state IN ('APPROVED', 'EXPIRED')
                AND current_approval_round IS NOT NULL
                AND approved_at IS NOT NULL
                AND approval_expires_at IS NOT NULL
            )
            OR (
                eligibility_state IN ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'REVOKED')
                AND approved_at IS NULL
                AND approval_expires_at IS NULL
            )
        )
);

CREATE FUNCTION ai_content_review_heads_monotonic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.content_revision < OLD.content_revision THEN
        RAISE EXCEPTION 'content_revision cannot move backwards'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.eligibility_revision < OLD.eligibility_revision THEN
        RAISE EXCEPTION 'eligibility_revision cannot move backwards'
            USING ERRCODE = '23514';
    END IF;

    IF (
        NEW.content_revision IS DISTINCT FROM OLD.content_revision
        OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
        OR NEW.eligibility_state IS DISTINCT FROM OLD.eligibility_state
        OR NEW.current_approval_round IS DISTINCT FROM OLD.current_approval_round
        OR NEW.edited_by IS DISTINCT FROM OLD.edited_by
        OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
        OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
        OR NEW.approval_expires_at IS DISTINCT FROM OLD.approval_expires_at
    ) AND NEW.eligibility_revision <= OLD.eligibility_revision THEN
        RAISE EXCEPTION
            'eligibility_revision must advance for an eligibility or content change'
            USING ERRCODE = '23514';
    END IF;

    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_content_review_heads_monotonic
    BEFORE UPDATE ON ai_content_review_heads
    FOR EACH ROW
    EXECUTE FUNCTION ai_content_review_heads_monotonic();

CREATE INDEX idx_ai_content_review_heads_state
    ON ai_content_review_heads(eligibility_state, updated_at DESC);

CREATE INDEX idx_ai_content_review_heads_expiry
    ON ai_content_review_heads(approval_expires_at, source_type, source_id)
    WHERE eligibility_state IN ('APPROVED', 'EXPIRED');

CREATE INDEX idx_ai_content_review_heads_eligibility_revision
    ON ai_content_review_heads(source_type, source_id, eligibility_revision DESC);

-- ---------------------------------------------------------------------------
-- Independent review rounds and append-only audit events
-- ---------------------------------------------------------------------------

CREATE TABLE ai_content_approval_rounds (
    source_type VARCHAR(16) NOT NULL,
    source_id UUID NOT NULL,
    content_revision BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    approval_round BIGINT NOT NULL,
    state VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    reviewer_role VARCHAR(16),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    reason VARCHAR(2000),

    CONSTRAINT pk_ai_content_approval_rounds
        PRIMARY KEY (source_type, source_id, content_revision, approval_round),
    CONSTRAINT fk_ai_content_approval_rounds_revision
        FOREIGN KEY (source_type, source_id, content_revision, content_hash)
        REFERENCES ai_content_revisions(
            source_type, source_id, content_revision, content_hash
        ) ON DELETE RESTRICT,
    CONSTRAINT ck_ai_content_approval_rounds_source_type
        CHECK (source_type IN ('SPECIALTY', 'ARTICLE', 'FAQ')),
    CONSTRAINT ck_ai_content_approval_rounds_revision
        CHECK (content_revision > 0 AND approval_round > 0),
    CONSTRAINT ck_ai_content_approval_rounds_hash
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_ai_content_approval_rounds_state
        CHECK (state IN ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REVOKED', 'EXPIRED')),
    CONSTRAINT ck_ai_content_approval_rounds_reviewer_role
        CHECK (reviewer_role IS NULL OR reviewer_role IN ('DOCTOR', 'SYSTEM')),
    CONSTRAINT ck_ai_content_approval_rounds_independent_reviewer
        CHECK (reviewed_by IS NULL OR reviewed_by <> submitted_by),
    CONSTRAINT ck_ai_content_approval_rounds_state_shape
        CHECK (
            (
                state = 'SUBMITTED'
                AND reviewed_by IS NULL
                AND reviewer_role IS NULL
                AND decided_at IS NULL
                AND expires_at IS NULL
            )
            OR (
                state IN ('APPROVED', 'EXPIRED')
                AND reviewed_by IS NOT NULL
                AND reviewer_role = 'DOCTOR'
                AND decided_at IS NOT NULL
                AND expires_at IS NOT NULL
            )
            OR (
                state IN ('CHANGES_REQUESTED', 'REVOKED')
                AND reviewed_by IS NOT NULL
                AND reviewer_role = 'DOCTOR'
                AND decided_at IS NOT NULL
                AND expires_at IS NULL
            )
        ),
    CONSTRAINT ck_ai_content_approval_rounds_reason
        CHECK (
            state NOT IN ('CHANGES_REQUESTED', 'REVOKED')
            OR char_length(btrim(coalesce(reason, ''))) BETWEEN 1 AND 2000
        )
);

CREATE FUNCTION ai_content_approval_rounds_derive_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.state = 'SUBMITTED' THEN
        NEW.decided_at := NULL;
        NEW.expires_at := NULL;
    ELSE
        NEW.decided_at := COALESCE(NEW.decided_at, CURRENT_TIMESTAMP);
        IF NEW.state = 'APPROVED' THEN
            NEW.expires_at := COALESCE(
                NEW.expires_at,
                NEW.decided_at + INTERVAL '180 days'
            );
        ELSIF NEW.state = 'EXPIRED' THEN
            -- Expiry sweep transitions an already-approved round to EXPIRED.
            -- Preserve the original deadline; deriving a fresh 180-day window
            -- here would silently resurrect an expired approval.
            NEW.expires_at := COALESCE(
                NEW.expires_at,
                CASE WHEN TG_OP = 'UPDATE' THEN OLD.expires_at END,
                NEW.decided_at + INTERVAL '180 days'
            );
        ELSE
            NEW.expires_at := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_content_approval_rounds_derive_expiry
    BEFORE INSERT OR UPDATE ON ai_content_approval_rounds
    FOR EACH ROW
    EXECUTE FUNCTION ai_content_approval_rounds_derive_expiry();

CREATE INDEX idx_ai_content_approval_rounds_pending
    ON ai_content_approval_rounds(submitted_at, source_type, source_id)
    WHERE state = 'SUBMITTED';

CREATE INDEX idx_ai_content_approval_rounds_expiry
    ON ai_content_approval_rounds(expires_at, source_type, source_id)
    WHERE state IN ('APPROVED', 'EXPIRED');

CREATE INDEX idx_ai_content_approval_rounds_reviewer
    ON ai_content_approval_rounds(reviewed_by, decided_at DESC)
    WHERE reviewed_by IS NOT NULL;

CREATE TABLE ai_content_review_events (
    event_id UUID PRIMARY KEY,
    source_type VARCHAR(16) NOT NULL,
    source_id UUID NOT NULL,
    content_revision BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    eligibility_revision BIGINT NOT NULL,
    approval_round BIGINT,
    event_type VARCHAR(24) NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    actor_role VARCHAR(16) NOT NULL,
    correlation_id UUID NOT NULL,
    reason VARCHAR(2000),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ai_content_review_events_revision
        FOREIGN KEY (source_type, source_id, content_revision, content_hash)
        REFERENCES ai_content_revisions(
            source_type, source_id, content_revision, content_hash
        ) ON DELETE RESTRICT,
    CONSTRAINT ck_ai_content_review_events_source_type
        CHECK (source_type IN ('SPECIALTY', 'ARTICLE', 'FAQ')),
    CONSTRAINT ck_ai_content_review_events_revision
        CHECK (content_revision > 0 AND eligibility_revision > 0),
    CONSTRAINT ck_ai_content_review_events_hash
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_ai_content_review_events_approval_round
        CHECK (approval_round IS NULL OR approval_round > 0),
    CONSTRAINT ck_ai_content_review_events_type
        CHECK (
            event_type IN (
                'EDITED', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED',
                'REVOKED', 'INVALIDATED', 'EXPIRED'
            )
        ),
    CONSTRAINT ck_ai_content_review_events_actor_role
        CHECK (actor_role IN ('ADMIN', 'DOCTOR', 'SYSTEM')),
    CONSTRAINT ck_ai_content_review_events_actor
        CHECK (actor_role = 'SYSTEM' OR actor_id IS NOT NULL),
    CONSTRAINT ck_ai_content_review_events_reason
        CHECK (
            event_type NOT IN ('CHANGES_REQUESTED', 'REVOKED', 'INVALIDATED')
            OR char_length(btrim(coalesce(reason, ''))) BETWEEN 1 AND 2000
        ),
    CONSTRAINT ck_ai_content_review_events_metadata
        CHECK (jsonb_typeof(metadata) = 'object' AND pg_column_size(metadata) <= 32768),
    CONSTRAINT uq_ai_content_review_events_idempotency
        UNIQUE (source_type, source_id, eligibility_revision, event_type, correlation_id)
);

CREATE FUNCTION ai_content_review_events_validate_actor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    submitter UUID;
BEGIN
    IF NEW.event_type = 'APPROVED' THEN
        IF NEW.actor_role <> 'DOCTOR' OR NEW.actor_id IS NULL THEN
            RAISE EXCEPTION 'approval events require a doctor actor'
                USING ERRCODE = '23514';
        END IF;

        IF NEW.approval_round IS NULL THEN
            RAISE EXCEPTION 'approval events require an approval round'
                USING ERRCODE = '23514';
        END IF;

        SELECT submitted_by
          INTO submitter
          FROM ai_content_approval_rounds
         WHERE source_type = NEW.source_type
           AND source_id = NEW.source_id
           AND content_revision = NEW.content_revision
           AND approval_round = NEW.approval_round;

        IF submitter IS NULL THEN
            RAISE EXCEPTION 'approval event references an unknown approval round'
                USING ERRCODE = '23514';
        END IF;

        IF submitter = NEW.actor_id THEN
            RAISE EXCEPTION 'submitter cannot approve their own revision'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_content_review_events_validate_actor
    BEFORE INSERT ON ai_content_review_events
    FOR EACH ROW
    EXECUTE FUNCTION ai_content_review_events_validate_actor();

CREATE FUNCTION ai_content_review_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'ai_content_review_events is append-only'
        USING ERRCODE = '55006';
END;
$$;

CREATE TRIGGER trg_ai_content_review_events_immutable
    BEFORE UPDATE OR DELETE ON ai_content_review_events
    FOR EACH ROW
    EXECUTE FUNCTION ai_content_review_events_immutable();

CREATE INDEX idx_ai_content_review_events_timeline
    ON ai_content_review_events(source_type, source_id, occurred_at DESC, event_id);

CREATE INDEX idx_ai_content_review_events_correlation
    ON ai_content_review_events(correlation_id);

-- ---------------------------------------------------------------------------
-- Compatibility metadata for the existing Spring -> Supabase outbox
-- ---------------------------------------------------------------------------

ALTER TABLE sync_outbox_events
    ADD COLUMN source_revision BIGINT,
    ADD COLUMN eligibility_revision BIGINT;

ALTER TABLE sync_outbox_events
    ADD CONSTRAINT ck_sync_outbox_source_revision
        CHECK (source_revision IS NULL OR source_revision > 0),
    ADD CONSTRAINT ck_sync_outbox_eligibility_revision
        CHECK (eligibility_revision IS NULL OR eligibility_revision > 0);

CREATE INDEX idx_sync_outbox_eligibility_revision
    ON sync_outbox_events(
        entity_classification, entity_type, entity_id, eligibility_revision DESC
    )
    WHERE eligibility_revision IS NOT NULL;

COMMENT ON COLUMN sync_outbox_events.source_revision IS
    'Canonical source content revision for governed AI projections; nullable for legacy events';
COMMENT ON COLUMN sync_outbox_events.eligibility_revision IS
    'Database-owned eligibility revision; use with content_hash for idempotent projection updates';
COMMENT ON TABLE ai_content_revisions IS
    'Immutable, canonical, non-patient source snapshots used by governed patient-chat retrieval';
COMMENT ON TABLE ai_content_review_heads IS
    'Current source/eligibility head. Missing or DRAFT heads are never AI-eligible.';
COMMENT ON TABLE ai_content_approval_rounds IS
    'Independent doctor review rounds; APPROVED expiry is derived as exactly 180 days';
COMMENT ON TABLE ai_content_review_events IS
    'Append-only governance audit with no patient message or identity payload';

-- ---------------------------------------------------------------------------
-- Safe legacy bootstrap: existing catalog rows are explicit DRAFT revisions.
-- They have no author/approval and therefore cannot enter patient-chat context
-- until an ADMIN submits and an independent DOCTOR approves a new round.
-- ---------------------------------------------------------------------------

WITH source_rows(source_type, source_id, content_snapshot) AS (
    SELECT
        'SPECIALTY',
        s.id,
        jsonb_build_object(
            'active', s.active,
            'care_pathway', s.care_pathway,
            'common_symptoms', s.common_symptoms,
            'description', s.description,
            'id', s.id::text,
            'name', s.name,
            'preparation_steps', s.preparation_steps,
            'slug', s.slug
        )
    FROM specialties s
    UNION ALL
    SELECT
        'ARTICLE',
        a.id,
        jsonb_build_object(
            'active', a.active,
            'author_name', a.author_name,
            'body', a.body,
            'category', a.category,
            'id', a.id::text,
            'published_at', a.published_at,
            'reading_minutes', a.reading_minutes,
            'related_specialty_slug', a.related_specialty_slug,
            'sections', a.sections,
            'slug', a.slug,
            'summary', a.summary,
            'title', a.title
        )
    FROM articles a
    UNION ALL
    SELECT
        'FAQ',
        f.id,
        jsonb_build_object(
            'active', f.active,
            'answer', f.answer,
            'id', f.id::text,
            'question', f.question
        )
    FROM faqs f
)
INSERT INTO ai_content_revisions(
    source_type, source_id, content_revision, content_hash,
    content_snapshot, created_by
)
SELECT
    source_type,
    source_id,
    1,
    encode(digest(convert_to(content_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
    content_snapshot,
    NULL
FROM source_rows
ON CONFLICT (source_type, source_id, content_revision) DO NOTHING;

INSERT INTO ai_content_review_heads(
    source_type, source_id, content_revision, content_hash,
    eligibility_revision, eligibility_state
)
SELECT
    r.source_type,
    r.source_id,
    r.content_revision,
    r.content_hash,
    1,
    'DRAFT'
FROM ai_content_revisions r
WHERE r.content_revision = 1
ON CONFLICT (source_type, source_id) DO NOTHING;
