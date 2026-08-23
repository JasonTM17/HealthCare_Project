ALTER TABLE ai_conversations
    ADD COLUMN in_flight_token UUID;

UPDATE ai_conversations
SET in_flight_token = gen_random_uuid()
WHERE in_flight = TRUE;

ALTER TABLE ai_conversations
    ADD CONSTRAINT ck_ai_conversations_processing_token
    CHECK (
        (in_flight = TRUE AND in_flight_token IS NOT NULL)
        OR
        (in_flight = FALSE AND in_flight_token IS NULL)
    );
