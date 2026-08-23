-- Durable, server-owned metadata queue for the one-way Spring -> Supabase
-- synchronisation path. The source projection is resolved by trusted server
-- code; this table deliberately stores no payload or patient identity.
CREATE TABLE sync_outbox_events (
    event_id UUID PRIMARY KEY,
    cursor BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    entity_classification VARCHAR(32) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(16) NOT NULL,
    revision BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    -- The JDBC adapter supplies this value on INSERT. A BEFORE trigger below
    -- canonicalizes it, preserving database-generated idempotency semantics
    -- while remaining compatible with that parameterized INSERT contract.
    idempotency_key VARCHAR(128) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    correlation_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE,
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    lease_token UUID,
    worker_id UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    last_error VARCHAR(2000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_sync_outbox_cursor UNIQUE (cursor),
    CONSTRAINT uq_sync_outbox_idempotency UNIQUE (idempotency_key),
    CONSTRAINT uq_sync_outbox_entity_revision
        UNIQUE (entity_classification, entity_type, entity_id, revision),

    CONSTRAINT ck_sync_outbox_entity_classification
        CHECK (entity_classification IN ('PUBLIC_CATALOG', 'DEIDENTIFIED_CLINICAL')),
    CONSTRAINT ck_sync_outbox_entity_type
        CHECK (entity_type ~ '^[a-z][a-z0-9_]{0,63}$'),
    CONSTRAINT ck_sync_outbox_operation
        CHECK (operation IN ('UPSERT', 'TOMBSTONE')),
    CONSTRAINT ck_sync_outbox_revision
        CHECK (revision > 0),
    CONSTRAINT ck_sync_outbox_content_hash
        CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_sync_outbox_idempotency_format
        CHECK (idempotency_key ~ '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*:[0-9a-f-]{36}:[0-9]+:(UPSERT|TOMBSTONE)$'),
    CONSTRAINT ck_sync_outbox_status
        CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'RETRYABLE', 'DEAD_LETTER')),
    CONSTRAINT ck_sync_outbox_attempt_count
        CHECK (attempt_count >= 0),
    CONSTRAINT ck_sync_outbox_last_error_length
        CHECK (last_error IS NULL OR char_length(last_error) <= 2000),
    CONSTRAINT ck_sync_outbox_processing_lease
        CHECK (
            (
                status = 'PROCESSING'
                AND claimed_at IS NOT NULL
                AND lease_expires_at IS NOT NULL
                AND lease_token IS NOT NULL
                AND acknowledged_at IS NULL
            )
            OR (
                status <> 'PROCESSING'
                AND lease_expires_at IS NULL
                AND lease_token IS NULL
            )
        ),
    CONSTRAINT ck_sync_outbox_status_timestamps
        CHECK (
            (status = 'PENDING' AND claimed_at IS NULL AND acknowledged_at IS NULL)
            OR (status = 'PROCESSED' AND acknowledged_at IS NOT NULL)
            OR (status IN ('PROCESSING', 'RETRYABLE', 'DEAD_LETTER') AND acknowledged_at IS NULL)
        ),
    CONSTRAINT ck_sync_outbox_lease_window
        CHECK (
            lease_expires_at IS NULL
            OR claimed_at IS NOT NULL
               AND lease_expires_at > claimed_at
        ),
    CONSTRAINT ck_sync_outbox_ack_after_claim
        CHECK (
            acknowledged_at IS NULL
            OR claimed_at IS NULL
            OR acknowledged_at >= claimed_at
        )
    );

-- Keep the canonical key and audit timestamps server-generated. The adapter
-- intentionally owns only the lease token; worker_id remains optional audit
-- metadata because the current port does not persist it per event.
CREATE FUNCTION sync_outbox_events_derive_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.idempotency_key := lower(NEW.entity_classification)
        || ':' || NEW.entity_type
        || ':' || NEW.entity_id::text
        || ':' || NEW.revision::text
        || ':' || NEW.operation;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'PROCESSING' THEN
            NEW.claimed_at := NEW.updated_at;
        ELSIF NEW.status = 'PENDING' THEN
            NEW.claimed_at := NULL;
        END IF;

        IF NEW.status = 'PROCESSED' THEN
            NEW.acknowledged_at := COALESCE(NEW.acknowledged_at, NEW.updated_at);
        ELSE
            NEW.acknowledged_at := NULL;
        END IF;
    ELSE
        IF NEW.status = 'PROCESSING'
            AND (
                OLD.status <> 'PROCESSING'
                OR NEW.lease_token IS DISTINCT FROM OLD.lease_token
                OR NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at
            ) THEN
            NEW.claimed_at := NEW.updated_at;
        END IF;

        IF NEW.status = 'PROCESSED'
            AND OLD.status <> 'PROCESSED' THEN
            NEW.acknowledged_at := COALESCE(NEW.acknowledged_at, NEW.updated_at);
        ELSIF NEW.status <> 'PROCESSED' THEN
            NEW.acknowledged_at := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_outbox_events_derive_metadata
    BEFORE INSERT OR UPDATE ON sync_outbox_events
    FOR EACH ROW
    EXECUTE FUNCTION sync_outbox_events_derive_metadata();

-- Cursor-ordered reads for new and retryable work. The separate lease index
-- allows a worker to reclaim abandoned PROCESSING rows without scanning the
-- full queue.
CREATE INDEX idx_sync_outbox_claimable_cursor
    ON sync_outbox_events (cursor, available_at)
    WHERE status IN ('PENDING', 'RETRYABLE');

CREATE INDEX idx_sync_outbox_expired_leases
    ON sync_outbox_events (lease_expires_at, cursor)
    WHERE status = 'PROCESSING';

CREATE INDEX idx_sync_outbox_dead_letters
    ON sync_outbox_events (updated_at DESC, cursor)
    WHERE status = 'DEAD_LETTER';

CREATE INDEX idx_sync_outbox_entity_latest
    ON sync_outbox_events (entity_classification, entity_type, entity_id, revision DESC);

CREATE INDEX idx_sync_outbox_correlation
    ON sync_outbox_events (correlation_id);
