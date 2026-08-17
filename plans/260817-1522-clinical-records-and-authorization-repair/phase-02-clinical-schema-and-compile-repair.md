---
title: "Phase 2: Clinical schema and compile repair"
status: completed
---

# Phase 2: Clinical schema and compile repair

## Overview

Create one forward-only V5 migration for the clinical tables and make the
untracked clinical source compile against the committed domain model. The
schema must match the JPA mappings without modifying an already-applied V4.

## Requirements

- [x] V5 creates medical records, prescriptions, prescription items, and diagnostic results once.
- [x] Existing V1-V4 tables remain unchanged and Hibernate mappings validate against V5.
- [x] Clinical source compiles with the actual exception package, Doctor model, and repository APIs.

## Implementation Steps

1. Reconcile table names, UUIDs, nullability, timestamps, indexes, and foreign-key order against V1-V4 and the entities.
2. Replace the duplicate/absent migration situation with a single new V5 migration.
3. Fix compile errors and remove direct entity serialization from the eventual controller boundary.
4. Run compile and migration/schema checks before authorization changes are accepted.

## Todo

- [x] Add the canonical clinical V5 migration.
- [x] Repair entity/repository/service/controller compilation.
- [x] Record exact compile and schema verification output.

## Success Criteria

Done when `mvn -DskipTests compile` passes with the clinical source present and
the migration has no duplicate table creation or V4 edits.
