---
phase: 5
title: "Release gates, independent re-scan, deploy verification"
status: pending
priority: P1
effort: "3h"
dependencies: ["phase-02-public-truthfulness", "phase-03-clinical-safety", "phase-04-contracts-admin-email-chatbot-content"]
---

# Phase 05 — Release, re-scan, deploy

## Steps
1. Full gates: FE `node --test tests/*.test.mjs` + `npm run typecheck` +
   Playwright (chromium + a11y projects, targeted specs); backend
   `./mvnw test` (full); ai-service `pytest` (full). `git diff --check`.
2. Secret scan: no credential literals in app code/config (env names only).
3. Independent re-scan: fresh read-only subagent audit of all changed surfaces
   (public, patient, doctor, admin, chatbot, editor) against the original
   packet — no new P0/P1 allowed; verdict recorded in
   `reports/20260916-remediation-verdict.md`.
4. Commit remaining docs/report updates; push (Vercel auto-deploys main).
5. Deploy verification: Vercel build live on www.healthcare.id.vn (probe 2-3
   changed routes); Render backend deploy triggered via API (`RENDER2_API_KEY`,
   env-only) or documented owner-side; Flyway migration status checked via
   backend logs/health after deploy; probe a fixed patient endpoint.
6. Record final handoff: outcome, files, gates observed, deploy state,
   unresolved risks, next safe action.

## Success Criteria
- [ ] All gates green with commands recorded.
- [ ] Re-scan verdict: no new P0/P1.
- [ ] Vercel + Render state recorded honestly (live vs owner-blocked).
