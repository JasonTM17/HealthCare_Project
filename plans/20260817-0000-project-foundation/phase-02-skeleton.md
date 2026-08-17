---
phase: 2
title: "Monorepo skeleton"
status: pending
priority: P1
effort: "small"
dependencies: [1]
---

# Phase 2: Monorepo skeleton

## Overview

Create the minimum stable folder boundaries for the project without implementing business features.

## Requirements

- **Functional**: Create `apps/backend`, `apps/frontend`, `apps/ai-service`, `docs/adr`, `docs/architecture`, and `infrastructure`.
- **Non-functional**: Keep placeholders minimal and portable; do not create domain/auth/appointment/AI RAG features.

## Architecture

The skeleton separates backend, frontend, AI service, documentation, and infrastructure so later phases have clear ownership and rollback boundaries.

## Related Code Files

- **Create**: `apps/backend/`
- **Create**: `apps/frontend/`
- **Create**: `apps/ai-service/`
- **Create**: `docs/adr/`
- **Create**: `docs/architecture/`
- **Create**: `infrastructure/`
- **Delete**: none

## Implementation Steps

1. Create directories after Phase 1 root safety exists.
2. Add minimal readme/placeholders only where required to preserve empty folders.
3. Update root README layout section.

## Success Criteria

- [ ] Required directories exist.
- [ ] No business feature code exists.
- [ ] Root README documents the layout.

## Risk Assessment

- **Risk**: Skeleton expands into product feature work.
- **Mitigation**: pause on domain/auth/appointment/AI RAG additions.
- **Rollback/recovery**: remove empty placeholder folders/files if the layout changes before implementation.

## Evidence and Handoff

- **Required gate**: file discovery confirms layout.
- **Owner**: foundation long-run owner.
- **Next phase dependency**: service bootstraps depend on these folder boundaries.
