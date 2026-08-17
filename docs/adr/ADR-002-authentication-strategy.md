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

## JWT policy

- The current defaults are a 15-minute access token (`900` seconds) and a 7-day refresh token (`604800` seconds).
- The enforced maximums are 1 hour (`3600` seconds) for access tokens and 30 days (`2592000` seconds) for refresh tokens. Both values must be positive, and the refresh-token TTL cannot be shorter than the access-token TTL.
- JWT secrets must contain at least 32 UTF-8 bytes, must not be a committed placeholder, and must not be an obvious low-entropy value: fewer than 8 distinct code points or an exact repeated pattern of 8 code points or fewer is rejected.
- Tokens require a UUID subject, non-empty token ID and type, issued-at and expiration claims, and an expiration after issued-at. Access tokens also require a non-empty email claim. Issued-at may be at most 30 seconds in the future to tolerate small clock skew.
