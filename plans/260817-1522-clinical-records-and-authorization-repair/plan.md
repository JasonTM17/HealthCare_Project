---
title: "Clinical records and adjacent safety repair"
description: "Reconcile the clinical overlay and close the bounded security, storage, frontend, and AI findings discovered during review."
status: completed
priority: P1
effort: "multi-phase"
branch: main
tags: [clinical, authorization, flyway, spring-boot]
created: 2026-08-17
---

# Clinical records and authorization repair

## Overview

This plan started from a clinical records/prescriptions overlay that had drifted
from the foundation. It now records the completed reconciliation of the V5
clinical schema, identity/ownership boundaries, and regression coverage, plus
the bounded appointment, MinIO, frontend catalog, notification, and AI/RAG
hardening that was required by the review findings. The repository remains a
local educational foundation; this plan does not authorize production use.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Make the clinical backend compile against one canonical V5 schema. | P1 |
| 2 | Prevent unauthenticated access and patient/doctor IDOR across clinical reads and writes. | P1 |
| 3 | Prove migration, Hibernate mapping, API behavior, and negative authorization cases with reproducible tests. | P1 |
| 4 | Keep the foundation scope honest and report integration limits without production claims. | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Snapshot and contract](./phase-01-start.md) | Completed |
| 2 | [Phase 2: Clinical schema and compile repair](./phase-02-clinical-schema-and-compile-repair.md) | Completed |
| 3 | [Phase 3: Identity and authorization boundaries](./phase-03-identity-and-authorization-boundaries.md) | Completed |
| 4 | [Phase 4: Regression and integration coverage](./phase-04-regression-and-integration-coverage.md) | Completed |
| 5 | [Phase 5: Documentation and release gates](./phase-05-documentation-and-release-gates.md) | Completed |

## Success Criteria

- [x] `mvn -DskipTests compile` succeeds with the clinical source present.
- [x] Exactly one canonical clinical migration follows committed `V4__appointments.sql`; no duplicate table creation remains.
- [x] `spring.jpa.hibernate.ddl-auto=validate` passes against a fresh V1–V8 database.
- [x] Clinical GET/POST endpoints enforce role and object ownership; cross-patient and cross-doctor negative tests return 403/404 as designed.
- [x] Clinical controllers return DTOs rather than bidirectional JPA entities.
- [x] Backend regression suite passes in an explicitly configured PostgreSQL environment; the Docker Java/Testcontainers provider remains NOT_RUN.
- [x] Frontend lint, typecheck, test, and build gates remain green; AI pytest/Ruff/mypy remain green; no push/PR or production claim is made.

## Scope and authority

- Base: `1faffbd671a2d8c1bfca01b18fbed6f7aeb8ba52` on `main`.
- In scope: current `apps/backend/src/main/java/com/healthcare/clinical/**`, one new clinical migration, identity linkage needed for ownership, clinical tests, and bounded review-driven fixes in appointments, storage, frontend catalog, notifications, and AI/RAG.
- Out of scope: deployment, real patient data, compliance certification, provider calls, push/PR, and broad cleanup of unrelated hook logs.
- User authority: the user explicitly approved full repair of the clinical overlay; reviewers remain read-only and do not authorize merge.

## Risks and rollback

- Existing local databases may have transient clinical migrations; never rewrite an applied migration. Validate the fresh database first and report upgrade implications.
- Authorization changes can break undocumented callers; preserve public response contracts where possible and add explicit 401/403 tests.
- If a verification gate fails, keep the exact failure and re-diagnose; do not weaken the gate or hide the clinical overlay.

## Evidence snapshot

- Backend: `mvn test` passed 65/65 on PostgreSQL 18.1 database
  `healthcare_repair_final_20260817`; Flyway validated/applied V1–V8 and
  Hibernate ran with `ddl-auto=validate`. `mvn -DskipTests compile` passed.
- Frontend: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, and
  `npm run build` passed; the articles page now reads the articles API rather
  than the packages API.
- AI service: 22 pytest tests, Ruff, and mypy passed. DeepSeek/provider calls
  were not exercised with a live credential; local deterministic fallback was
  exercised. RAG ingestion is disabled and token-protected by default.
- Infrastructure: `docker compose -f infrastructure/docker-compose.yml
  config --quiet` passed. The local PostgreSQL and MinIO services were
  available for the backend run; the true Java Testcontainers provider was not
  accepted because the Docker named-pipe probe returned HTTP 400.
- Current review must bind to the exact final `HEAD`, changed paths, and the
  preserved unrelated `.claude/hooks/.logs/hook-log.jsonl` modification.

<!-- slug: clinical-records-and-authorization-repair -->
