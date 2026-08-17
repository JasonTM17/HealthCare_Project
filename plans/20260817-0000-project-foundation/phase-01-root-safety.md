---
phase: 1
title: "Repository provenance and root safety"
status: pending
priority: P1
effort: "small-medium"
dependencies: []
---

# Phase 1: Repository provenance and root safety

## Overview

Make the workspace safe to mutate before any app scaffolding. This phase owns Git/provenance, root docs, `.gitignore`, and secret-safe environment examples.

## Requirements

- **Functional**: Establish a Git working tree or user-approved alternate provenance path.
- **Functional**: Add root `README.md`, root `.gitignore`, and root `.env.example`.
- **Non-functional**: Never persist secret values; `.gitignore` must exclude generated files and local-only data before scaffolds are created.

## Architecture

Root files define the repository contract consumed by all later service phases. `.gitignore` is the first safety control because later bootstraps create large generated trees and local config files.

## Related Code Files

- **Create**: `.gitignore`
- **Create**: `README.md`
- **Create**: `.env.example`
- **Modify**: `docs/PROJECT_PLAN.md`, only if foundation status changes
- **Delete**: none

## Implementation Steps

1. Decide Git path: initialize current root or switch to clean clone.
2. Create `.gitignore` before generating service code.
3. Create `README.md` with project goal, stack, layout, setup, run/test/build commands, Docker notes, and secret-handling rules.
4. Create `.env.example` with placeholder variable names only.
5. Run secret/path review and Git status if Git is available.

## Success Criteria

- [ ] `git status --short --branch` works, or alternate provenance is explicitly recorded.
- [ ] `.gitignore` exists and excludes env files, dependencies, caches, logs, builds, local DB/storage, IDE files, and `.opencode/node_modules/`.
- [ ] `README.md` explains setup/run/test/Docker/env expectations.
- [ ] `.env.example` contains placeholders only and no secret values.

## Risk Assessment

- **Risk**: Scaffolding before `.gitignore` tracks generated or secret files.
- **Mitigation**: make `.gitignore` the first file delivered.
- **Rollback/recovery**: remove accidental generated files before first commit; never use destructive cleanup without user approval.

## Evidence and Handoff

- **Required gate**: file existence checks for root safety files.
- **Required gate**: Git status or alternate provenance note.
- **Owner**: foundation long-run owner.
- **Next phase dependency**: Phase 2 must not start until `.gitignore` exists.
