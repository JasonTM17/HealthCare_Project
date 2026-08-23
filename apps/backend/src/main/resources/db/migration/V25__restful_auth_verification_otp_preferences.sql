ALTER TABLE users
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;

-- Existing local and operationally seeded accounts remain usable after the
-- rollout. New registrations explicitly opt out of the migration default.
UPDATE users
SET email_verified_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE email_verified = TRUE
  AND email_verified_at IS NULL;

CREATE TABLE auth_otp_challenges (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(32) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_auth_otp_challenge_purpose
        CHECK (purpose IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),
    CONSTRAINT ck_auth_otp_challenge_attempts
        CHECK (attempts >= 0 AND attempts <= 5)
);

CREATE INDEX idx_auth_otp_challenges_user_purpose
    ON auth_otp_challenges(user_id, purpose, consumed_at, created_at DESC);
CREATE INDEX idx_auth_otp_challenges_expires_at
    ON auth_otp_challenges(expires_at);

CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    appointment_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
    locale VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
