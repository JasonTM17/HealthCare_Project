CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    in_flight BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_ai_conversations_status
        CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_ai_conversations_title
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 160)
);

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    request_message_id UUID REFERENCES ai_messages(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    content TEXT NOT NULL,
    sequence_number BIGINT NOT NULL,
    idempotency_key VARCHAR(128),
    disclaimer VARCHAR(1000),
    provenance VARCHAR(32),
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ck_ai_messages_role
        CHECK (role IN ('USER', 'ASSISTANT')),
    CONSTRAINT ck_ai_messages_status
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_ai_messages_sequence
        CHECK (sequence_number > 0),
    CONSTRAINT ck_ai_messages_content
        CHECK (char_length(content) BETWEEN 1 AND 10000),
    CONSTRAINT ck_ai_messages_user_shape
        CHECK (
            (role = 'USER' AND request_message_id IS NULL AND idempotency_key IS NOT NULL)
            OR
            (role = 'ASSISTANT' AND request_message_id IS NOT NULL AND idempotency_key IS NULL)
        ),
    CONSTRAINT ck_ai_messages_provenance
        CHECK (provenance IS NULL OR provenance IN ('local_provider', 'remote_provider', 'local_fallback'))
);

CREATE INDEX idx_ai_conversations_user_updated
    ON ai_conversations(user_id, updated_at DESC, id DESC);
CREATE INDEX idx_ai_conversations_expiry
    ON ai_conversations(expires_at, id);
CREATE INDEX idx_ai_messages_conversation_sequence
    ON ai_messages(conversation_id, sequence_number DESC);
CREATE UNIQUE INDEX uq_ai_messages_conversation_sequence
    ON ai_messages(conversation_id, sequence_number);
CREATE UNIQUE INDEX uq_ai_messages_conversation_idempotency
    ON ai_messages(conversation_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX uq_ai_messages_request_reply
    ON ai_messages(request_message_id)
    WHERE request_message_id IS NOT NULL;
