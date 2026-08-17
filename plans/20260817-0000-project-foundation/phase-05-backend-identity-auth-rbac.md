---
phase: 5
title: "Backend identity, authentication, and RBAC"
status: in-progress
priority: P1
effort: "large"
dependencies: [1, 2, 3]
---

# Phase 5: Backend Identity, Authentication, And RBAC

## Overview

The user authorized this extension after an uncommitted backend implementation was discovered. It covers only the existing identity/authentication and RBAC slice. It must not add hospital-domain, appointment, clinical, frontend-authentication, or deployment work.

## Requirements

- **Functional**: Provide registration, login, refresh-token rotation, logout, and current-user boundaries secured by JWT bearer tokens.
- **Functional**: Persist users, roles, permissions, join tables, and hashed refresh tokens through Flyway-managed PostgreSQL schema.
- **Functional**: Seed `PATIENT`, `DOCTOR`, and `ADMIN`; new registrations receive only `PATIENT`.
- **Non-functional**: Hash passwords with BCrypt; never return password hashes or raw refresh-token persistence; use UUID identifiers and UTC audit timestamps.
- **Non-functional**: Keep transport choice (cookie versus bearer-token handling in a browser) explicitly undecided until frontend authentication is authorized.

## Related Code Files

- **Modify/Create**: `apps/backend/src/main/**`
- **Modify/Create**: `apps/backend/src/test/**`
- **Modify/Create**: `apps/backend/src/main/resources/db/migration/**`
- **Modify**: `apps/backend/src/main/resources/application.yml`
- **Modify**: `docs/adr/ADR-002-authentication-strategy.md`
- **Modify**: `docs/database/schema-overview.md`

## Success Criteria

- [ ] `mvn test` passes with the configured Java runtime or reports an evidenced blocker. (`BLOCKED`: Docker Desktop engine unavailable for Testcontainers.)
- [ ] Flyway migration creates all identity/RBAC tables and seeded roles. (`BLOCKED`: PostgreSQL Testcontainer cannot start.)
- [x] Registration normalizes email, rejects duplicates, and never exposes a password hash.
- [x] Login rejects invalid credentials without user enumeration.
- [x] Refresh tokens rotate and reuse of a rotated token is rejected in source-level regression coverage.
- [x] Protected endpoints reject anonymous access and logout revokes active refresh tokens.
- [x] Backend YAML has no duplicate configuration keys and has no real secret committed.
- [x] ADR/schema docs match the implemented API and persistence behavior.

## Verification

1. Run `mvn test` in `apps/backend`.
2. Run focused MockMvc tests for register, login, refresh, logout, and anonymous denial.
3. Run migration tests against the test database profile.
4. Run a secret-pattern review without logging candidate values.
5. Run `git diff --check` before handoff or commit.

## Risks And Scope Guard

- JWT bearer tokens are an API boundary only; frontend token storage and browser session transport require a separate decision before UI implementation.
- Production secrets must be supplied exclusively through local/runtime environment configuration, not fallbacks committed to source.
- No rate limiting, MFA, OAuth, password-reset flow, user management, or hospital-domain authorization is included by this extension.
