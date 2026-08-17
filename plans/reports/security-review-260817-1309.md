---
title: Security Review — HealthCare Backend
date: 2026-08-17
scope: apps/backend Spring Boot + apps/ai-service FastAPI
verdict: PASS for local foundation with noted gaps
---

# Security Review

## Scope

Authentication/authorization, token handling, object-level access, CORS,
error handling, file uploads, AI endpoints.

## Findings

| # | Area | Finding | Severity |
|---|------|---------|----------|
| 1 | Password exposure | No password hash in any DTO or API response | PASS |
| 2 | Refresh tokens | Reuse detection + family-wide revocation on theft; pessimistic lock on rotation; SHA-256 hashed storage | PASS |
| 3 | JWT | Access/refresh token-type claims enforced in filter and refresh; short-lived access (15m), 7d refresh | PASS |
| 4 | Object-level auth | Clinical records: patient/doctor ownership checks via `requireLinkedPatient`/`requireLinkedDoctor`/`ensureDoctorCanAccessPatient`; files: `@PreAuthorize` role gates | PASS |
| 5 | CORS | Explicit allowlist from env, no wildcard; credentials enabled | PASS |
| 6 | Error handling | Generic 500 message, no stack traces leaked, structured `ApiError` | PASS |
| 7 | RAG ingest | Token-protected, disabled by default | PASS |
| 8 | Input validation | Jakarta Validation on auth, appointment, and AI gateway request DTOs; slug uniqueness enforced | PASS |
| 9 | Rate limiting | No rate limiter on auth endpoints | LOW (foundation phase) |
| 10 | HTTPS/TLS | Not configured (local dev) | INFO |
| 11 | Appointment integrity | Active doctor + schedule/slot validation, advisory lock, and V8 pending/active uniqueness index | PASS (local path) |
| 12 | AI service boundary | Backend gateway is authenticated; direct FastAPI routes require `AI_SERVICE_TOKEN` when configured and Compose binds the port to loopback | LOCAL-ONLY |

## Recommendations (post-foundation)

- Add rate limiting (Bucket4j/Resilience4j) to `/api/v1/auth/*`.
- Enforce HTTPS in production profile.
- Add audit logging for sensitive operations (record creation, prescription).
- Set `SameSite` cookie policy if switching to cookie-based tokens.

## Verdict

No critical or high-severity issues were found for the bounded local foundation
path. The review is not production approval: Testcontainers/live provider
execution, TLS, rate limiting, and non-loopback deployment isolation remain
separate gates. Set a non-empty `AI_SERVICE_TOKEN` for shared/staging use.
