---
phase: 3
title: "Clinical safety B1-B7 (split 3a/3b/3c per Kongming)"
status: pending
priority: P1
effort: "6h"
dependencies: ["phase-01-baseline-and-production-blockers"]
---

# Phase 03 — Clinical safety and doctor workflow correctness

## Overview
Split into three independently shippable commits (Kongming condition). Each must
keep seeded demo clinical data loading (Wukong gate 2) and the appointment state
machine (`CONFIRMED→CHECKED_IN→IN_PROGRESS→COMPLETED`) regression-green.

## 3a — Encounter scoping + honest validation (B2, B3, B5, B6, B7)
- Server: diagnostic-result + record writes require a current-day active
  appointment/encounter relationship (replace "any prior/active relationship" at
  `ClinicalService.java:460-474`); manual patient-UUID write path removed/locked.
- DTO `@Size(max=2000)` on diagnosis (matches DB `VARCHAR(2000)`); precise 400
  validation error instead of duplicate-record 409.
- Queue label matches statuses (exclude `PENDING_CONFIRMATION` from "đã xác thực").
- AI credits: never invent `?? 150`; show "đang cập nhật" when absent.
- Business time: preserve time-of-day for test dates.

## 3b — Minimal lab-order model (B1)
- Additive Flyway: `diagnostic_orders` (or order columns) with status; result
  publication requires an order; UI adds "Chỉ định xét nghiệm" step. Smallest
  model that makes publish-without-order impossible.

## 3c — Prescription structure + audit (B4)
- Multi-item prescriptions with dose/frequency/duration/instructions validation;
  `PRESCRIBE` added to `clinical_access_audit` action CHECK (additive migration
  V-new); audit record written on prescription create.

## Related Code Files
- `apps/backend/.../clinical/**` (service, DTOs, controller), `appointment/**`
- `apps/backend/src/main/resources/db/migration/V7x__*.sql` (additive)
- `apps/frontend/app/doctor/dashboard/page.tsx`, `lib/api-client.ts`, `lib/business-time.ts`
- Backend tests: ClinicalService/Authorization/PortalController; FE doctor tests

## Success Criteria
- [ ] Regression: prior-patient arbitrary diagnostic write rejected 403/404;
      >2000-char diagnosis → 400 field error; publish without order → 409/400;
      prescription create writes PRESCRIBE audit row; seed data loads post-migration.
- [ ] `./mvnw test` targeted green; FE doctor gates green.

## Risk Assessment
Clinical disruption → additive migrations, forward-only, deploy low-traffic;
rollback = revert commit before migration runs (Render pin previous image).
