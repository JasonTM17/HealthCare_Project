---
title: "Clinical records and authorization repair"
description: "Repair the existing untracked clinical overlay without widening the foundation baseline."
status: in-progress
priority: P1
effort: "multi-phase"
branch: main
tags: [clinical, authorization, flyway, spring-boot]
created: 2026-08-17
---

# Clinical records and authorization repair

## Overview

This plan repairs the clinical records/prescriptions overlay currently present
as untracked backend source. The foundation commits remain the exact base; no
clinical source is treated as mergeable until the schema, identity model,
authorization matrix, regression tests, and review evidence agree.

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
| 2 | [Phase 2: Clinical schema and compile repair](./phase-02-clinical-schema-and-compile-repair.md) | In progress |
| 3 | [Phase 3: Identity and authorization boundaries](./phase-03-identity-and-authorization-boundaries.md) | Pending |
| 4 | [Phase 4: Regression and integration coverage](./phase-04-regression-and-integration-coverage.md) | Pending |
| 5 | [Phase 5: Documentation and release gates](./phase-05-documentation-and-release-gates.md) | Pending |

## Success Criteria

- [ ] `mvn -DskipTests compile` succeeds with the clinical source present.
- [ ] Exactly one canonical clinical migration follows committed `V4__appointments.sql`; no duplicate table creation remains.
- [ ] `spring.jpa.hibernate.ddl-auto=validate` passes against a fresh V1–V5 database.
- [ ] Clinical GET/POST endpoints enforce role and object ownership; cross-patient and cross-doctor negative tests return 403/404 as designed.
- [ ] Clinical controllers return DTOs rather than bidirectional JPA entities.
- [ ] Backend regression suite passes in an explicitly configured PostgreSQL environment; unavailable provider/container runs are reported as NOT_RUN/BLOCKED.
- [ ] Frontend lint, typecheck, and tests remain green; no push/PR or production claim is made.

## Scope and authority

- Base: `1faffbd671a2d8c1bfca01b18fbed6f7aeb8ba52` on `main`.
- In scope: current untracked `apps/backend/src/main/java/com/healthcare/clinical/**`, one new clinical migration, identity linkage needed for ownership, clinical tests, and concise scope documentation.
- Out of scope: deployment, real patient data, compliance certification, provider calls, push/PR, and broad cleanup of unrelated hook logs.
- User authority: the user explicitly approved full repair of the clinical overlay; reviewers remain read-only and do not authorize merge.

## Risks and rollback

- Existing local databases may have transient clinical migrations; never rewrite an applied migration. Validate the fresh database first and report upgrade implications.
- Authorization changes can break undocumented callers; preserve public response contracts where possible and add explicit 401/403 tests.
- If a verification gate fails, keep the exact failure and re-diagnose; do not weaken the gate or hide the clinical overlay.

<!-- slug: clinical-records-and-authorization-repair -->
