---
title: "Phase 3: Identity and authorization boundaries"
status: completed
---

# Phase 3: Identity and authorization boundaries

## Overview

Bind patient and doctor portal access to authenticated user identities and keep
administrative overrides explicit. Every clinical read/write must fail closed
for missing identity or mismatched ownership.

## Requirements

- [x] Patient and doctor profiles have explicit nullable user links for legacy rows.
- [x] Clinical routes require authentication and role/object ownership checks.
- [x] Controllers return DTOs that expose only the intended clinical fields.

## Implementation Steps

1. Add user linkage to the canonical schema and entities without breaking legacy seed rows.
2. Resolve the authenticated account to exactly one patient/doctor profile.
3. Enforce appointment patient/doctor consistency when creating a record.
4. Add negative 401/403/404 coverage for cross-owner access and unlinked accounts.

## Todo

- [x] Remove clinical `permitAll` and add endpoint-level role/ownership guards.
- [x] Implement patient and doctor portal service methods using linked identities.
- [x] Add DTO mapping and avoid bidirectional JPA entity responses.

## Success Criteria

Done when no clinical endpoint accepts an arbitrary patient/doctor ID as proof of
ownership and the negative authorization tests pass.
