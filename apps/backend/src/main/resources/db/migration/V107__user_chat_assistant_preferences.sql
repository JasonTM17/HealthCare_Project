-- Per-account assistant configuration. One row per user already exists in
-- user_preferences; these columns hold the patient-chat defaults the server
-- reads at message time (the browser never enforces them).
ALTER TABLE user_preferences
    ADD COLUMN chat_default_mode VARCHAR(32) NOT NULL DEFAULT 'HOSPITAL_SUPPORT',
    ADD COLUMN chat_tone VARCHAR(16) NOT NULL DEFAULT 'than_thien',
    ADD COLUMN chat_personalized BOOLEAN NOT NULL DEFAULT FALSE;
