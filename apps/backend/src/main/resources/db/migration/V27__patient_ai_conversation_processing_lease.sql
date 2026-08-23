ALTER TABLE ai_conversations
    ADD COLUMN in_flight_started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE ai_conversations
    ADD CONSTRAINT ck_ai_conversations_processing_lease
    CHECK (
        (in_flight = TRUE AND in_flight_started_at IS NOT NULL)
        OR
        (in_flight = FALSE AND in_flight_started_at IS NULL)
    );

CREATE INDEX idx_ai_conversations_stale_processing
    ON ai_conversations(in_flight_started_at, id)
    WHERE in_flight = TRUE;
