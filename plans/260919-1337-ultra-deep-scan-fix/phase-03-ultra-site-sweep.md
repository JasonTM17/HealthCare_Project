---
phase: 3
title: "Ultra whole-site browser + API sweep"
status: completed
priority: P1
effort: "3-4h"
dependencies: []
---

# Phase 3: Ultra whole-site browser + API sweep

## Overview
Drive the live production site in a real browser across every public and portal surface, capture rendering/console/network failures, and produce a triaged defect ledger that feeds Phases 4–6.

## Requirements
- Functional: every audited route renders, core flows complete, console free of errors, no failed network calls.
- Non-functional: read-only against production (no writes to business data); screenshots retained as evidence.

## Architecture
Use browser automation (browser-use control-browser / ak:agent-browser) with a fixed route matrix and per-route checks; combine with the HTTP probe scripts for status/latency baselines.

## Related Code Files
- Create: `plans/260919-1337-ultra-deep-scan-fix/reports/defect-ledger.md`
- Reuse: `scripts/probe-live.mjs`, `scripts/verify-deploy-qa.mjs`, `scripts/audit-r6-browser.mjs`, `scripts/probe-doctors-pagination.mjs`, `scripts/probe-packages-all.mjs`

## Implementation Steps
1. Route matrix: `/`, `/dat-lich`, `/packages`, `/packages/[slug]`, `/doctors`, `/doctors/[slug]`, `/specialties`, `/branches`, `/articles`, `/articles/[slug]`, `/search`, `/faq`, `/benh-pho-bien`, `/auth/login`, `/patient/*` (dashboard, appointments, records, chat), `/doctor/*` (schedule, consultations, articles), `/admin/*` (catalog, health questions), FloatingHealthAssistant on 3 contexts.
2. Desktop (1440px) + mobile (390px) passes: layout, overflow, touch targets, unstyled elements, dead links.
3. Console + network capture per route; note cold-start behaviors on first hits.
4. Core flows: booking `/dat-lich` 4 steps, package booking (no specialty for general), search with filters, article discussion thread, chatbot greeting + fixture question.
5. Triage everything into `defect-ledger.md` with severity (P0–P3), evidence screenshot, owner phase (4/5/6/deferred).

## Success Criteria
- [ ] AC10: ledger complete, every finding has severity + disposition
- [ ] AC11 evidence: screenshots for audited portals stored under `reports/`
- [ ] P0/P1 ledger items mapped to phases 4–6 (or explicitly deferred)

## Risk Assessment
Portal flows mutate data → use demo accounts only and never confirm destructive actions; cold-start may cause false "broken" verdicts → retry once after warm-up before recording a defect.
