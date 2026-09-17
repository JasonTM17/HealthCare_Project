---
phase: 1
title: "Baseline + production blockers (G1 commit, A1 demo login, F1 media upload)"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 01 — Baseline + production blockers

## Overview
Land the uncommitted branch-availability feature as its own commit (Wukong gate:
isolated commit + green tests before anything else), then close the two
production blockers: public demo-credential exposure and the broken hosted media
upload path.

## Requirements
- G1 committed as-is when `node --test tests/*.test.mjs` is green; stray
  `apps/frontend/pnpm-lock.yaml` NOT committed (project uses npm); `reports/`
  committed separately as audit artifacts.
- A1: production login page shows no role emails, no password autofill, no
  one-click demo login unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"`
  (default off). Non-production keeps the demo helper.
- F1: when `STORAGE_UPLOAD_ENABLED` is false in the hosted env, upload surfaces
  degrade with actionable Vietnamese copy instead of failing requests; when
  true, the backend validates required storage env at startup (fail fast, no
  secret literals). Chosen hosted posture: keep env false OR enable real
  storage — decided by env, code supports both honestly.

## Related Code Files
- Modify: `apps/frontend/app/auth/login/page.tsx`
- Modify: `render.yaml` (env posture + comments), backend media/storage config validation
- Modify: `apps/frontend/components/editor/RichTextEditor.tsx`, `components/ImageUpload*` (degraded-state copy)
- Tests: FE login demo-gating test; backend media env-validation test

## Implementation Steps
1. Run FE unit tests on dirty tree; commit G1 (single commit, only its 21 files).
2. Gate demo login UI behind env flag with server-safe default.
3. Add storage-env startup validation + UI degraded state for uploads.
4. Verify + commit separately.

## Success Criteria
- [ ] `git log` shows isolated G1 commit; later phases rebase on it (Wukong gate 3).
- [ ] Production build renders no demo credentials (regression test asserts).
- [ ] `POST /media/upload` behavior honest for both env postures (test asserts).

## Risk Assessment
Demo gating could break dev workflows → flag defaults on in dev via env example.
Storage validation could block deploys with missing env → validate only when
STORAGE_UPLOAD_ENABLED=true.
