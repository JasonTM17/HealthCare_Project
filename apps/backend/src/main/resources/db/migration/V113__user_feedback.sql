-- V113: authenticated user feedback ("góp ý") inbox.
--
-- Visitors can read every public page, but only signed-in users may submit
-- product feedback: the row is owned by the account so the care team can
-- correlate reports with real usage and reply through the verified channel.
CREATE TABLE IF NOT EXISTS user_feedback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category    VARCHAR(32) NOT NULL,
    subject     VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'NEW',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_feedback_category CHECK (category IN (
        'GENERAL', 'UI_UX', 'BUG_REPORT', 'FEATURE_REQUEST', 'SERVICE_QUALITY'
    )),
    CONSTRAINT chk_user_feedback_status CHECK (status IN ('NEW', 'TRIAGED', 'RESOLVED')),
    CONSTRAINT chk_user_feedback_message_len CHECK (char_length(message) BETWEEN 10 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_created
    ON user_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feedback_status_created
    ON user_feedback (status, created_at DESC);
