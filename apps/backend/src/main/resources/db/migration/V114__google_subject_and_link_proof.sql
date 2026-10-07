-- Existing accounts remain unbound; email is never a provider identity.
ALTER TABLE users ADD COLUMN google_subject VARCHAR(255);
ALTER TABLE users ADD CONSTRAINT uq_users_google_subject UNIQUE (google_subject);
ALTER TABLE users ADD CONSTRAINT ck_users_google_subject_nonblank
    CHECK (google_subject IS NULL OR length(trim(google_subject)) > 0);

ALTER TABLE auth_otp_challenges ADD COLUMN google_subject VARCHAR(255);
ALTER TABLE auth_otp_challenges ADD COLUMN discard_untrusted_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE auth_otp_challenges DROP CONSTRAINT ck_auth_otp_challenge_purpose;
ALTER TABLE auth_otp_challenges ADD CONSTRAINT ck_auth_otp_challenge_purpose
    CHECK (purpose IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'GOOGLE_LINK'));
ALTER TABLE auth_otp_challenges ADD CONSTRAINT ck_auth_otp_google_subject
    CHECK ((purpose = 'GOOGLE_LINK' AND google_subject IS NOT NULL
            AND length(trim(google_subject)) > 0)
        OR (purpose <> 'GOOGLE_LINK' AND google_subject IS NULL));
