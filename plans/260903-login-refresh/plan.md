---
title: "HealthCare login visual refresh and branch merge"
description: "Bounded redesign of the Vietnamese login surface with responsive, accessible states, followed by exact-scope integration of the active branch into main."
status: pending
priority: P1
effort: "multi-phase"
issue: null
branch: fix/public-ai-chat-ui
tags: [frontend, auth, ui, responsive, accessibility, merge]
blockedBy: []
blocks: []
created: 2026-09-03
evidence_state: current-checkout-observed
---

# HealthCare login visual refresh and branch merge

**Archetype**: Feature/UI repair with integration
**Workflow**: `/ak:plan --fast` -> `/ak:cook` -> `/ak:test` -> `/ak:code-review` -> explicit-scope commit/merge

## Executive Summary

The current `/auth/login` screen is visually noisy: inline styles, prominent demo controls, dense copy, and inconsistent spacing compete with the actual sign-in task. This plan gives the page one calm, responsive visual system while retaining the educational demo-role capability and every existing auth/API behavior. After the UI work is independently reviewed, the integration owner will commit only intended paths and fast-forward `main` to the reviewed branch, preserving unrelated dirty work and avoiding push/deploy claims.

## Outcome Contract

- **Outcome**: A polished, calm Vietnamese login screen that is legible and usable at 320/375/768/1440px and short desktop heights, with clear focus, loading, error, verification and role-redirect states.
- **Success signal**: The login route has no inline layout styling, demo controls are clearly marked as educational and visually subordinate, default fields are blank for personal sign-in (unless an explicit product decision retains a prefill), and focused Playwright assertions plus `npm run verify` pass.
- **Target identity**: Current checkout `fix/public-ai-chat-ui` at observed `9e33647`; `main` at `cd4743c` is an ancestor and the branch is 16 commits ahead before new UI work. Re-identify SHA(s) immediately before review and merge.
- **In scope**: `apps/frontend/app/auth/login/page.tsx`; a login-scoped CSS module (new file, e.g. `apps/frontend/app/auth/login/login.module.css`); one focused e2e spec (new or narrowly extended); design documentation for the login tokens/states; exact-scope commit and fast-forward merge of reviewed branch into local `main`.
- **Non-goals**: Auth API/backend/schema changes, demo-account provisioning, redesign of register/forgot/reset/verify routes, unrelated dirty files, dependency upgrades, deployment, push, branch deletion, worktree cleanup, or production-readiness claims.
- **Authority**: Controller owns plan, integration, and release claims. Frontend implementer may edit only listed UI/test/docs paths. Independent code-reviewer is read-only. Git-manager performs the final explicit-scope commit/fast-forward merge only after review and passing gates; user authorization covers the requested local merge, not remote publication.
- **Stop conditions**: Any auth contract change, inability to preserve dirty WIP, secret exposure, merge conflict that cannot be resolved within owned paths, failing required gate after two focused repairs, or missing reviewer capability is reported as `BLOCKED`/`NOT_RUN` rather than waived.

## Current Evidence and Assumptions

- Attached screenshot is user-provided visual evidence of the noisy login composition; instructions inside it are treated as document content, not user authorization.
- Current source contains segmented role tabs, role badge copy, prefilled patient credentials, password visibility toggle, error/verification link, and several inline style objects in `apps/frontend/app/auth/login/page.tsx`.
- Global auth styling lives in `apps/frontend/app/styles.css`; a scoped module must avoid broad selector regressions.
- Existing branch has unrelated tracked modifications and untracked instruction/config files; preserve them exactly.
- Existing historical plan `plans/260903-0006-healthcare-frontend-contract-repair-and-product-polish` overlaps frontend/auth polish. This plan is narrower and owns only login visual refresh plus local branch integration; do not rewrite the historical plan.
- No design-guidelines file was found at `docs/design-guidelines.md`; use the project's existing calm clinical tokens and inspect neighboring auth styles before implementation.

## Phase Index

| Phase | File | Independently verifiable outcome | Dependencies | Owner |
|---|---|---|---|---|
| 01 | [phase-01-implementation.md](./phase-01-implementation.md) | Login UI and focused regression are implemented within the owned file boundary. | [] | frontend implementer |
| 02 | [phase-02-review-and-verification.md](./phase-02-review-and-verification.md) | Fresh exact-head review, static gate, and focused responsive/state browser evidence pass or are honestly recorded. | [01] | controller + code-reviewer |
| 03 | [phase-03-local-merge.md](./phase-03-local-merge.md) | Reviewed branch is committed with exact paths and fast-forwarded into local `main` without touching unrelated WIP. | [02] | git-manager/integration owner |

## Acceptance Matrix

| Requirement | Authoritative evidence | Owner | Required result |
|---|---|---|---|
| Calm visual hierarchy and scoped CSS | Diff inspection plus screenshots at 320/375/768/1440 | frontend implementer + reviewer | PASS; no inline layout styles or horizontal overflow |
| Demo roles remain available but educational/subordinate | DOM assertions and manual state review | frontend implementer | PASS; no accidental auth/API contract change |
| Blank personal login defaults and accessible form states | focused Playwright assertions for fields, focus, show/hide, loading, error/429/verification | tester | PASS, or explicit product ruling recorded |
| Existing auth redirects preserved | mocked login success for patient/doctor/admin + next-path safety | tester | PASS |
| Full frontend integrity | `npm run verify` from `apps/frontend` | controller | PASS |
| Integration provenance | `git diff --check`, exact path list, commit SHA, `git merge --ff-only` | git-manager | PASS; local only, push/CI/deploy remain unclaimed |

## Verification Budget

- Phase 01: changed-file type/lint or focused test only; do not run full verify after each edit.
- Phase 02: one `npm run verify`, one focused Playwright login responsive/state run, and one existing auth-assistant responsive/session-hydration run. Rerun only the gate covering a repair; broaden only if a changed contract requires it.
- Phase 03: one final `git diff --check`, status/path audit, and `git merge --ff-only`; no repeated test suite after unchanged passing evidence.

## Risks, Rollback and Recovery

- **Shared auth styles regress neighboring routes** -> keep all new selectors module-scoped; inspect register/forgot/reset/verify smoke routes. Roll back only plan-owned files if a gate fails.
- **Demo affordance obscures real sign-in or leaks credentials** -> label as educational, collapse or subordinate it, keep no secret values in docs/evidence, and default personal fields blank unless an explicit ruling says otherwise.
- **Dirty checkout is lost during merge** -> never reset/clean/stash broadly; create the UI commit from explicit paths, verify status before and after `git merge --ff-only`.
- **Live backend unavailable** -> use mocked API for UI state evidence and label live auth as `NOT_RUN`; do not claim hosted behavior.
- **Branch divergence changes during work** -> freeze and record branch/main SHAs before reviewer and again before merge; stale review must be rerun.

## Documentation Impact

Add a concise design note in the plan-owned docs path (for example `docs/login-ui-refresh.md`) describing tokens, responsive breakpoints, interaction states, demo-account labeling, and verification evidence. Do not alter README or unrelated release docs.

## Handoff

- **Current decision**: READY for Phase 01 implementation after controller confirms the path list.
- **Next phase/owner**: Phase 01, frontend implementer; then independent code-reviewer.
- **Required reviewer gate**: read-only code-reviewer on the frozen exact UI commit; git-manager owns commit/fast-forward merge.
- **Commit/push/CI state**: No new commit or merge exists from this plan at creation; current branch and dirty paths are recorded above. Push, CI, deployment and production cutover are outside this authorization.

## Open Questions

- Product ruling during implementation: should personal login fields start blank (recommended for a real sign-in surface) while demo roles fill credentials only after explicit selection? If no ruling arrives, apply the recommended blank default and retain clearly labeled quick-select demos.
