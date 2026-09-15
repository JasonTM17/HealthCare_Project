---
title: "ChartJS insights + SMTP audit + role-interaction release sweep"
description: "Add Chart.js-based operational insights to the admin portal, audit the OTP/verification SMTP pipeline against Mailpit, run a multi-role interaction sweep with independent agent review, then commit, re-scan, and establish deploy readiness."
status: in-progress
priority: P1
effort: M
issue: null
branch: main
tags: [frontend, chartjs, smtp, otp, role-interaction, release]
blockedBy: []
blocks: []
created: 2026-09-15
---

# ChartJS insights + SMTP audit + role-interaction release sweep

**Workflow**: /ak:plan (this artifact) → /ak:cook → /ak:test → Advisor/Kongming/Wukong review → commit → re-scan → deploy readiness.

## Executive Summary

Three deliverables in one release pass: (1) verify the outbound mail pipeline
(booking OTP, email verification, password reset) end-to-end against the Mailpit
sink and close any gap between dev capture and production SMTP configuration;
(2) add Chart.js-based operational insight to the admin dashboard so operators
see appointment volume/status at a glance; (3) run one more multi-role browser
sweep with independent Advisor/Kongming/Wukong review, then commit the
accumulated audit fixes, re-scan, and document/execute deploy to the extent the
environment allows.

## Outcome Contract

- **Outcome**: mail flows proven working with captured evidence; admin dashboard
  renders chart insights from live API data; full role-interaction sweep green;
  work committed in conventional commits with explicit paths; final scan clean;
  deploy readiness stated with exact boundaries.
- **Success signal**: OTP booking journey completes using the code read from
  Mailpit; chart renders with live data and is axe-clean; unit + targeted e2e
  gates pass; commits pushed target `main` only after gates; final axe/browser
  sweep reports zero critical/serious and no new console errors.
- **In scope**: backend mail/OTP code paths + compose Mailpit; one admin
  dashboard chart (appointments by status + weekly volume if API allows);
  Frontend-only rendering (no new backend endpoint unless trivially available).
- **Non-goals**: real production SMTP credentials management, new AI features,
  redesigning existing portals, hosted deploy without available credentials.
- **Authority**: product-owner request (this goal). Hosted deploy executed only
  with credentials present in the environment; otherwise deploy readiness is
  documented as the boundary.

## Evidence and Assumptions

- Stack healthy on :3000 (9 containers incl. Mailpit at infrastructure-mailpit-1).
- Booking wizard works through slot selection (session 1–3 evidence); OTP step
  not yet exercised in browser.
- Mailpit is compose's SMTP sink (infrastructure/docker-compose.yml); production
  mail config presence is unverified.
- Working tree carries session 1–3 audit fixes (FE) + V75 migration + parallel
  AI-workstream edits that must be committed separately or left untouched.

## Phases

| Phase | File | Outcome | Owner |
|---|---|---|---|
| 01 | [phase-01-smtp-otp-audit.md](./phase-01-smtp-otp-audit.md) | OTP/verification mail proven end-to-end; prod SMTP gap documented | Backend + QA |
| 02 | [phase-02-chartjs-insights.md](./phase-02-chartjs-insights.md) | Chart.js insights shipped on admin dashboard, tested + axe-clean | Frontend |
| 03 | [phase-03-role-sweep-commit-deploy.md](./phase-03-role-sweep-commit-deploy.md) | Agent-reviewed sweep, commits, final scan, deploy step | Integration owner |

## Acceptance Matrix

| Requirement | Evidence | Required result |
|---|---|---|
| Booking OTP via mail | Browser journey + Mailpit API capture (screenshot + code match) | PASS |
| Prod SMTP config | application.yml / render.yaml / .env.example inspection | Documented gap or PASS |
| Chart.js on admin | Live screenshot + axe 0/0 on /admin + unit test for data transform | PASS |
| Role sweep | Multi-role browser log + agent verdicts (Advisor/Kongming/Wukong) | PASS or explicit HOLD |
| Commit | Conventional commits, explicit paths, `git diff --check`, secret scan | PASS |
| Final scan | axe public+portal 0/0; no new console errors; targeted e2e | PASS |
| Deploy | Deployed URL or documented readiness boundary with exact commands | Documented |

## Risks and Rollback

- Mail OTP rate limits in dev: reuse booking codes from prior seeds; Rate limit
  resets on Redis restart (last resort, resets demo sessions).
- Chart.js bundle weight: import registerables narrowly (`chart.js/auto` only if
  simpler; measure via build output).
- Rollback: commits are additive; revert by commit hash. V75 migration is
  constraint-widening only (no data loss) — rollback via prior image.

## Unresolved Decisions / Blockers

- Hosted deploy credentials (Vercel/Render) — if absent in environment, deploy
  phase ends at readiness documentation. **Confirmed at execution time.**
- Chart placement decision recorded in phase 02 (admin overview chosen;
  doctor/patient dashboards deferred to keep the release small).
