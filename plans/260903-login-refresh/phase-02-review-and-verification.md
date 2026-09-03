---
phase: 2
title: "Independent review and verification"
status: pending
priority: P1
effort: M
dependencies: [1]
---

# Phase 2: Independent review and verification

## Overview

Review the frozen implementation for scope, accessibility, visual quality and auth preservation, then run the bounded frontend and browser gates.

## Requirements

- **Functional**: Existing auth redirects, safe `next` handling, verification path, errors and loading remain intact.
- **Non-functional**: Visual hierarchy is calm and consistent; responsive layouts have no clipping/overflow; browser states are truthful and keyboard usable.

## Implementation Steps

1. Freeze exact branch SHA and path diff; invoke independent read-only `code-reviewer` with the claim “login refresh preserves auth behavior and is production-quality within scope.”
2. Resolve only in-scope findings; stale review requires a fresh exact-head review.
3. Run from `apps/frontend`: `npm run verify`.
4. Run focused Playwright login responsive/state spec; inspect screenshots at 320, 375, 768, 1440 and short desktop height. Run existing `auth-assistant-responsive.spec.ts` and `auth-session-hydration.spec.ts` checks to ensure auth surfaces remain isolated.
5. If local backend is available, run synthetic demo login only; otherwise mark live auth `NOT_RUN` and rely on mocked API states. Never use real patient data or secrets.
6. Record pass/fail/NOT_RUN evidence and residual risks in `reports/verification.md`.

## Success Criteria

- [ ] Reviewer returns PASS or findings are repaired and independently re-reviewed.
- [ ] `npm run verify` passes on the reviewed snapshot.
- [ ] Focused responsive/state browser checks pass; required screenshots are inspected.
- [ ] Any unavailable live capability is explicitly `NOT_RUN`, not inferred as pass.

## Risk Assessment

- **Risk**: Visual checks pass while auth contract regresses.
- **Mitigation**: mocked redirect/error/verification assertions plus existing auth hydration regression.
- **Rollback/recovery**: revert only plan-owned UI/test/docs commit; preserve all unrelated work.

## Evidence and Handoff

- **Required gate**: exact SHA, reviewer verdict, command results, screenshot paths, and `git diff --check`.
- **Owner**: controller with read-only code-reviewer.
- **Next phase dependency**: git-manager receives explicit path list and reviewed SHA only after all required checks pass.
