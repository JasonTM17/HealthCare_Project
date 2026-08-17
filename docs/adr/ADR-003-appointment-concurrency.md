# ADR-003: Branch-aware appointment slots and concurrency invariants

- Status: Accepted for the local foundation
- Date: 2026-08-17

## Context

A doctor can work at more than one hospital branch. A clock time such as
`09:00` is therefore not a complete slot identifier when a response combines
multiple branch schedules. Application-only branch checks also leave direct
database writers able to create a schedule or appointment for an unassigned
doctor/branch pair.

## Decision

- Persisted schedules and schedule exceptions are branch-scoped.
- `GET /api/v1/appointments/doctors/{doctorId}/slots` accepts an optional
  `branchId` query parameter. A branch-scoped request returns only that
  branch's slots. A request without `branchId` keeps the legacy all-branch
  view, but every persisted slot includes its `branchId` in the response.
- The branchless local/demo fallback is used only when the doctor has no active
  persisted schedule. It never satisfies a request explicitly scoped to a
  branch.
- `appointments.branch_id` remains nullable for the legacy/demo flow. When it
  is present, Flyway V10 enforces the `(doctor_id, branch_id)` relationship to
  `doctor_branches`; the same invariant is enforced for schedules and
  exceptions.
- Active appointment overlap is protected by the existing PostgreSQL advisory
  lock and V7–V9 active-slot/interval constraints. The invariant is keyed by
  doctor/date/time rather than branch because one doctor cannot attend two
  overlapping branches.
- Integration tests use a disposable PostgreSQL 16 Testcontainer by default,
  so Flyway, PostgreSQL constraints, and advisory-lock behavior are exercised
  without mutating a developer's application database. `TEST_DB_URL` is an
  explicit external-database escape hatch and must point to a dedicated test
  database.

## Consequences

Clients that book a persisted schedule must send the selected `branchId` in
the hold request. Existing clients that only use the branchless demo schedule
continue to work. Clients consuming the all-branch slot view must use the
returned `branchId` together with `startTime`, not `startTime` alone.

This is a local-development foundation, not a claim of production healthcare
compliance, external notification delivery, or deployment readiness.
