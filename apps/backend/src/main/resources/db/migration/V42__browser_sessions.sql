CREATE TABLE browser_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_secret_hash VARCHAR(64) NOT NULL UNIQUE,
    csrf_secret_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    idle_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
    absolute_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        DEFAULT (CURRENT_TIMESTAMP + INTERVAL '12 hours'),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(64),
    CONSTRAINT ck_browser_sessions_session_hash
        CHECK (session_secret_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_browser_sessions_csrf_hash
        CHECK (csrf_secret_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_browser_sessions_time_order
        CHECK (
            last_seen_at >= created_at
            AND idle_expires_at > created_at
            AND absolute_expires_at > created_at
            AND idle_expires_at <= absolute_expires_at
            AND (revoked_at IS NULL OR revoked_at >= created_at)
        ),
    CONSTRAINT ck_browser_sessions_revocation_reason
        CHECK (
            (revoked_at IS NULL AND revoked_reason IS NULL)
            OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)
        )
);

CREATE INDEX idx_browser_sessions_user_active
    ON browser_sessions(user_id, absolute_expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_browser_sessions_idle_expiry
    ON browser_sessions(idle_expires_at)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE browser_sessions IS
    'Opaque browser sessions. Only SHA-256 hashes are persisted; raw session and CSRF secrets live in Secure cookies.';

COMMENT ON COLUMN browser_sessions.session_secret_hash IS
    'SHA-256 hex digest of __Host-healthcare_session; never the raw cookie value.';

COMMENT ON COLUMN browser_sessions.csrf_secret_hash IS
    'SHA-256 hex digest of __Host-healthcare_csrf; never the raw token value.';
