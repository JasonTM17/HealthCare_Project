# ADR-002: Authentication Strategy

## Status

Proposed for implementation phase.

## Context

The platform will need patients, doctors, and admins. Authentication must be secure before protected healthcare features are added.

## Decision

Use application-owned email/password authentication with BCrypt password hashes, server-side role checks, refresh-token rotation, and database-backed RBAC tables. The foundation migration creates identity/RBAC tables but does not expose registration or login endpoints yet.

## Consequences

- Password hashes must never be returned from APIs or logs.
- Refresh-token reuse and revocation behavior need dedicated tests in the auth phase.
- Cookie vs bearer-token transport remains a user-facing security decision before frontend auth forms are implemented.
