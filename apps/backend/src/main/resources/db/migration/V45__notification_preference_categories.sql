CREATE TABLE notification_preferences (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, category, channel),
    CONSTRAINT ck_notification_preference_category CHECK (
        category IN ('SECURITY', 'APPOINTMENT', 'PAYMENT', 'CLINICAL_UPDATE',
                     'CONSULTATION', 'CARE_PLAN', 'MARKETING')
    ),
    CONSTRAINT ck_notification_preference_channel CHECK (channel IN ('EMAIL', 'IN_APP')),
    CONSTRAINT ck_notification_preference_quiet_hours CHECK (
        (quiet_hours_start IS NULL AND quiet_hours_end IS NULL)
        OR (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
    ),
    CONSTRAINT ck_notification_preference_timezone CHECK (length(trim(timezone)) BETWEEN 1 AND 64)
);

CREATE INDEX idx_notification_preferences_user_category
    ON notification_preferences(user_id, category);

-- Materialize safe defaults for existing accounts. Security and transactional
-- categories stay enabled; marketing remains opt-in.
INSERT INTO notification_preferences (user_id, category, channel, enabled)
SELECT u.id, categories.category, channels.channel,
       CASE WHEN categories.category = 'MARKETING' THEN FALSE ELSE TRUE END
FROM users u
CROSS JOIN (VALUES
    ('SECURITY'), ('APPOINTMENT'), ('PAYMENT'), ('CLINICAL_UPDATE'),
    ('CONSULTATION'), ('CARE_PLAN'), ('MARKETING')
) AS categories(category)
CROSS JOIN (VALUES ('EMAIL'), ('IN_APP')) AS channels(channel)
ON CONFLICT (user_id, category, channel) DO NOTHING;

COMMENT ON TABLE notification_preferences IS
    'Per-user notification categories and channels. Security mail remains mandatory; locale beta is vi-VN.';
