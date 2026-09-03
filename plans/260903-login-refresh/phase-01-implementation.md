---
phase: 1
title: "Implement login visual refresh"
status: pending
priority: P1
effort: M
dependencies: []
---

# Phase 1: Implement login visual refresh

## Overview

Refactor the login route into a coherent, scoped visual composition while preserving the existing `login`, `hasRole`, `safeAuthNextPath`, error mapping, verification link, and role redirect behavior.

## Requirements

- **Functional**: Email/password submission, password visibility toggle, demo role quick-select, verification link, field errors, rate-limit/error/loading states, and role redirects remain behaviorally compatible.
- **Non-functional**: Keyboard-first operation, visible focus, minimum 44px controls, readable contrast, no horizontal scrolling, no inline layout style objects, and responsive composition at 320/375/768/1440px plus short desktop heights.

## Related Code Files

- **Modify**: `apps/frontend/app/auth/login/page.tsx`
- **Create**: `apps/frontend/app/auth/login/login.module.css`
- **Create**: `apps/frontend/tests/e2e/auth-login-refresh.spec.ts` (or the exact focused spec path selected after search)
- **Create**: `docs/login-ui-refresh.md`
- **Do not modify**: backend/auth libraries, global styles unless a proven shared token defect blocks the scoped module, unrelated dirty files.

## Implementation Steps

1. Re-read current page and neighboring auth styles; freeze the exact class/data-testid contract needed by tests.
2. Replace inline layout/presentation styles with semantic class names and a scoped CSS module. Use calm clinical palette, restrained role selector, clear card/header/form hierarchy, responsive spacing, and reduced visual noise.
3. Keep demo quick-select available but label it “Tài khoản mẫu cho môi trường học tập”; make it subordinate/collapsible if practical. Apply blank email/password defaults for personal sign-in; selecting a demo role may fill its known educational credentials.
4. Add explicit `aria-live`/`aria-busy`, labels, described-by links, focus-visible states, and non-color error affordances without changing API payloads.
5. Write focused Playwright coverage for viewport layout, role selection, password toggle, submit loading, invalid/error/429/verification surfaces, and role-safe redirects using mocked responses.
6. Record tokens, states, and deliberate non-goals in `docs/login-ui-refresh.md`.

## Success Criteria

- [ ] `page.tsx` has no inline layout style objects and keeps existing auth calls/redirect logic.
- [ ] Scoped CSS renders without overflow and meets focus/contrast/44px checks at required viewports.
- [ ] Focused e2e regression fails against the pre-refresh baseline for at least one intended visual/interaction contract and passes after implementation.
- [ ] Only listed paths are changed by the implementation.

## Evidence and Handoff

- **Required gate**: changed-file lint/typecheck plus focused Playwright spec; report exact command and result.
- **Owner**: frontend implementer.
- **Next phase dependency**: return exact changed paths and test command/output; controller freezes SHA for review.
