-- V70__demo_boundary_foundation.sql
-- Phase 02 (HC-01): tag the shared synthetic demo personas so the runtime can
-- enforce the demo trust boundary. D-01 ruling: isolated/resettable synthetic
-- personas with high-impact financial/security mutations disabled; production
-- (non-demo) deployments must not leave known demo principals active.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- The seeded healthcare.com/.local personas are the only shared demo
-- identities; every other account is an ordinary user.
UPDATE users SET is_demo = TRUE
WHERE email IN (
    'admin@healthcare.com',
    'doctor@healthcare.com',
    'patient@healthcare.com',
    'admin@healthcare.local',
    'doctor@healthcare.local',
    'patient@healthcare.local'
);

CREATE INDEX IF NOT EXISTS users_is_demo_active_idx
    ON users (is_demo)
    WHERE is_demo AND status = 'ACTIVE';
