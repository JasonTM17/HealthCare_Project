---
title: "Phase 4: Regression and integration coverage"
status: completed
---

# Phase 4: Regression and integration coverage

## Overview

Prove the repaired boundary with focused service/controller tests, migration
checks, and the existing frontend gates. Keep Testcontainers optional because
the current desktop environment has not been accepted as a valid Testcontainers
Docker provider.

## Requirements

- [x] Backend compile and focused integration tests run against explicitly configured PostgreSQL.
- [x] Test cleanup respects clinical foreign keys without widening the foundation test contract.
- [x] Frontend lint, typecheck, test, and build gates remain green.

## Implementation Steps

1. Extend the integration cleanup boundary for clinical children when V5 is present.
2. Add API tests for unauthenticated, same-owner, and cross-owner cases.
3. Run migration/Hibernate validation and the full backend test suite where infrastructure permits.
4. Run frontend checks and diff/secret/static gates.

## Todo

- [x] Add deterministic clinical fixtures and negative authorization tests.
- [x] Run backend and frontend validation commands.
- [x] Mark unavailable Docker/live-service checks honestly as NOT_RUN/BLOCKED.

## Success Criteria

Done when the required focused tests pass, the broader suite result is recorded
with its exact environment, and no test change weakens an existing gate.
