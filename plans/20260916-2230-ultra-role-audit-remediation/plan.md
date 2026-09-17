---
title: "Ultra role-audit remediation: production trust, clinical correctness, TinyMCE honesty"
description: "Execute the ultra-verifier-selected plan (c2) to fix all audited role defects — demo exposure, fake-clinician booking, public dead ends, clinical scoping/safety, patient/admin contracts, SMTP resilience, chatbot observability/a11y, and the TinyMCE editor-vs-pipeline contract — then commit per phase, re-scan independently, and verify deployment."
status: in-progress
priority: P1
effort: large
issue: null
branch: main
tags: [security, clinical-safety, ui-ux, tinymce, chatbot, admin, deploy]
blockedBy: []
blocks: []
created: 2026-09-16
source-plan: reports/audit-20260916/candidates/c2.md (ultra winner, 93/100)
evidence: reports/audit-20260916/evidence-packet.md sha256 9e9d5d5a8e473027cb37ec576c37285a903107b7ccdcc2f4f90066a1685ad5bb @ base ebaeea3
verifier: reports/audit-20260916/verifier.json (ACCEPT c2)
gates: Kongming GO (advisory), Wukong INCONCLUSIVE with acceptance gates (both recorded in reports/audit-20260916/)
---

# Ultra Role-Audit Remediation Plan (2026-09-16)

## Outcome & success signal

The hosted product (www.healthcare.id.vn + Render backend) no longer exhibits any
finding in the frozen evidence packet (A1–A7, B1–B7, C1, D1–D4, E1–E4, F1–F4):
no public demo-credential exposure, no fictional clinician presented as bookable,
no public CTA dead-ending at a private wall, doctor writes encounter-scoped with
prescribe-audit, patient/admin API contracts exact, auth email outage-tolerant,
chatbot metadata observable and dialog accessible, and the TinyMCE editor offers
only formatting that survives the persisted contract. Measurable: every fixed
finding has a regression test that fails on the old behavior; FE unit tests,
typecheck, Playwright (chromium + a11y), targeted backend Maven tests, and
ai-service pytest all pass; no secret literals introduced.

## Scope, non-goals, authority

- Scope: `apps/frontend`, `apps/backend`, `apps/ai-service`, Flyway migrations,
  `render.yaml` env posture, tests. Working tree §G1 (branch availability) is
  committed first as its own commit (Phase 0) — Wukong gate.
- Non-goals (from c2 §3): no LIS/e-prescribing platform, no payment rails, no
  per-branch equipment inventory (copy corrected instead), no UI redesign, no
  sanitized-HTML persistence in this pass, no silent remote-LLM cost-posture
  change, no gate weakening.
- Authority: main is the deploy branch (Vercel auto-deploy). Each phase lands as
  an independently shippable commit; gates run before each push so main is never
  half-remediated (Kongming condition).

## Decisions recorded at planning time

1. **TinyMCE posture = Option A** (honest toolbar): markdown persistence stays;
   toolbar/menu controls whose output cannot survive `htmlToMarkdown`
   (forecolor, backcolor, fontfamily, fontsize, superscript, subscript) are
   removed from the doctor/admin editors; the misleading iframe-sanitize comment
   is corrected; XSS-safety regressions prove the render path safe-by-construction.
   Option B (sanitized-HTML persistence) stays documented as future work behind
   explicit product approval — Kongming conditions listed in
   `reports/audit-20260916/` review. Wukong acceptance gate satisfied by (A)
   regression tests on public article rendering.
2. **Phase 3 split** (Kongming): 3a encounter scoping + validation; 3b minimal
   lab-order model; 3c prescription structure + PRESCRIBE audit. Seeded demo
   clinical data must survive each step (Wukong gate).
3. **E4 (server-side abort)** is explicitly deferred as technical debt with a
   server-side timeout/cost guard + documentation, per c2 §6.

## Phase index

| Phase | File | Findings | Theme |
| --- | --- | --- | --- |
| 01 | `phase-01-baseline-and-production-blockers.md` | G1, G2, A1, F1 | Commit G1; demo-login gating; media upload posture |
| 02 | `phase-02-public-truthfulness.md` | A2–A7 | Public copy, CTAs, SEO |
| 03 | `phase-03-clinical-safety.md` | B1–B7 | Doctor encounter scoping, lab orders, prescriptions |
| 04 | `phase-04-contracts-admin-email-chatbot-content.md` | C1, D1–D4, E1–E4, F2–F4 | Contracts, admin audit, SMTP, chatbot, TinyMCE |
| 05 | `phase-05-release-scan-deploy.md` | all | Full gates, independent re-scan, deploy verification |

## Acceptance criteria (whole plan)

- [ ] `reports/audit-20260916/evidence-packet.md` findings: each P0/P1 fixed with
      regression test; each P2 fixed or explicitly dispositioned in
      `reports/20260916-remediation-verdict.md`.
- [ ] Gates: `node --test tests/*.test.mjs` (334+), `npm run typecheck`,
      Playwright chromium+a11y targeted, `./mvnw test` targeted per phase,
      `pytest` targeted per phase — recorded with command + result.
- [ ] `git grep` secret scan clean (no `HealthCare@2026` outside dev-only gated
      contexts/tests, no SMTP/API key literals in app code or render.yaml).
- [ ] Re-scan round: fresh subagent audit of changed surfaces returns no new P0/P1.
- [ ] Deploy: Vercel serving new build; Render deploy triggered and verified
      (or blocker documented as owner-side); V75 migration live check documented.

## Risks & rollback

Per-phase rollback = revert that phase's commit; migrations are additive-first;
email change keeps outbox status observable; upload UI has an env kill-switch
(`STORAGE_UPLOAD_ENABLED=false` hides controls with Vietnamese copy). If the
demo-doctor cleanup empties the public catalog, fall back to disclosed
non-bookable demo cards rather than re-enabling booking.

## Documentation impact

README role-portal copy and `docs/` operator notes updated only where behavior
changed (demo gating, storage posture, chatbot cost metadata).
