---
title: Security Review — HealthCare Backend
date: 2026-08-17
scope: apps/backend Spring Boot + apps/ai-service FastAPI
verdict: PASS with noted gaps
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
| 8 | Input validation | Jakarta Validation on request DTOs; slug uniqueness enforced | PASS |
| 9 | Rate limiting | No rate limiter on auth endpoints | LOW (foundation phase) |
| 10 | HTTPS/TLS | Not configured (local dev) | INFO |

## Recommendations (post-foundation)

- Add rate limiting (Bucket4j/Resilience4j) to `/api/v1/auth/*`.
- Enforce HTTPS in production profile.
- Add audit logging for sensitive operations (record creation, prescription).
- Set `SameSite` cookie policy if switching to cookie-based tokens.

## Verdict

No critical or high-severity issues. The auth/RBAC and object-level
authorization boundaries are correctly implemented for the foundation
scope.
