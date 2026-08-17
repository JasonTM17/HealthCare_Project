# ADR-002: Authentication Strategy

## Status

Accepted for the backend identity foundation. Frontend session transport remains undecided.

## Context

The platform will need patients, doctors, and admins. Authentication must be secure before protected healthcare features are added.

## Decision

Use application-owned email/password authentication with BCrypt password hashes, JWT bearer access tokens, server-side role checks, refresh-token rotation, and database-backed RBAC tables. The backend exposes registration, login, refresh, logout, and current-user endpoints. New registrations receive only the `PATIENT` role.

## Consequences

- Password hashes must never be returned from APIs or logs.
- Refresh-token rotation, reuse rejection, and logout revocation are covered by backend regression tests.
- Cookie vs bearer-token transport remains a user-facing security decision before frontend auth forms are implemented.
