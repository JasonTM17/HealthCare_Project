---
title: "Clinical overlay diagnosis"
status: completed
---

# Diagnosis

## Reproduction

From `apps/backend`, the pre-repair compile and source inspection were run on
2026-08-17 against the foundation snapshot before the clinical overlay was
reconciled.

## Observed symptoms

- `ClinicalService` imports a non-existent `com.healthcare.common.exception` package.
- `Doctor` has no `getTitle()` method.
- Portal controllers call repository methods with the wrong signature and call a
  missing prescription lookup method.
- Clinical source has no canonical V5 migration in the current workspace.
- `SecurityConfig` permits `/api/v1/clinical/**`, and portal identity is derived
  from an email username as if it were a UUID.
- Portal controllers expose bidirectional JPA entities directly.

## Root causes

The clinical files were introduced as an untracked overlay while the foundation
commits intentionally removed the earlier incomplete clinical package and V5.
The overlay therefore drifted from the actual domain model, repository API,
security identity contract, and migration lineage. The permission rule also
left the new routes outside the foundation's authenticated boundary.

## Blast radius

The issue blocks backend compilation and would make clinical reads either
unauthenticated, IDOR-prone, or dependent on invalid identity parsing. It does
not require changing the committed foundation migrations V1-V4.

## Resolution and acceptance

The accepted repair uses one new forward-only V5, explicit nullable user links
for legacy profiles, service-owned identity/ownership checks, DTO responses,
and focused negative authorization tests. The final backend suite passed 58/58
on an explicitly configured PostgreSQL 16.15 database with Flyway V1-V6 and
Hibernate validation. Docker/Testcontainers availability and production
provider/compliance claims remain separate evidence gates.
