---
phase: 6
title: "Public hospital catalog and administration"
status: in-progress
priority: P1
effort: "large"
dependencies: [3, 5]
---

# Phase 6: Public Hospital Catalog And Administration

## Overview

The user authorized this extension after public catalog and administrator modules appeared in the workspace. It covers the catalog only: specialties, doctors, branches, services, packages, articles, FAQs, and doctor-to-specialty/branch links.

## Scope Guard

- Use original fictional records only. Do not import or copy content, medical claims, names, contact details, images, or assets from Hoan My or another provider.
- Do not add appointment workflows, patient clinical data, billing, AI provider calls, or frontend authentication.
- Public reads must return only active/published records. Writes must require `ADMIN` server-side authorization.

## Success Criteria

- [ ] V2 migration validates on the configured PostgreSQL integration path. (`BLOCKED`: Docker Desktop engine unavailable for Testcontainers.)
- [x] Public APIs enforce active/published visibility in source and regression coverage.
- [x] Admin APIs declare `ADMIN` server-side authorization.
- [ ] Tests cover public visibility, admin success/forbidden behavior, validation, and conflict/not-found cases. (`PARTIAL`: public visibility coverage added; admin CRUD test matrix remains incomplete.)
- [ ] `mvn test` and the integration suite pass, or any unavailable external dependency is recorded as `BLOCKED`. (`BLOCKED`: Docker Desktop engine unavailable for Testcontainers.)
