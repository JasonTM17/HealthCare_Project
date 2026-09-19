---
phase: 6
title: "Quick wins, hardening, and keep-alive decision (P4 backlog)"
status: completed
priority: P2
effort: "2-3h"
dependencies: [1, 3]
---

# Phase 6: Quick wins, hardening, and keep-alive decision (P4 backlog)

## Overview
Clear the P4 quick-win backlog and compute the keep-alive cadence decision with real quota math.

## Requirements
- Functional: multisymptom detector stops false-positiving on bare substrings; admin PATCH/DELETE get a rate-limit tier; keep-alive cron reflects a computed quota-safe cadence.
- Non-functional: no safety-gate weakening; all suites stay green.

## Architecture
Point fixes at known sites: `is_complex_multisymptom_query` (ai-service), `RequestRateLimitFilter` tier selection (backend), keep-alive cron (workflow).

## Related Code Files
- Modify: `apps/ai-service/app/llm.py` (multisymptom detector), `apps/backend/src/main/java/com/healthcare/security/RequestRateLimitFilter.java`, `.github/workflows/render-keep-alive.yml`
- Test: ai-service detector unit tests; backend rate-limit filter test

## Implementation Steps
1. Multisymptom: word-boundary matching for `"vừa"`, `"kem"`, `"kéo dài"` (mirror predecessor D1 token discipline); add regression cases.
2. Rate-limit: extend the dedicated tier to PATCH/DELETE admin routes (POST-only gap at `RequestRateLimitFilter.java:303-309` class of rules); verify legitimate admin flows unaffected.
3. Keep-alive math (scoped by Wukong: `BackendWarmup.tsx` already warms the backend on page views — only the AI hop is effectively always-cold): AI always-on ≈ 744h vs 750h quota → do NOT go always-on; compute a cadence **including GitHub Actions scheduler jitter** (free-runner crons slip 10–30+ min, which defeats 15-min sleep math) or record "keep 6h" with reasoning; implement + document. Never exceed the quota-suspension risk threshold.
4. Capacity guard / fetchAllContent gaps from the sweep ledger: fix or explicitly defer with reasons.

## Success Criteria
- [ ] AC8 ai pytest green (≥741 + new cases)
- [ ] AC9 backend tests green
- [ ] Keep-alive decision recorded with hour math in reports/

## Risk Assessment
Rate-limit tightening could throttle legitimate admin work → scope the tier to exact admin paths and test happy-path; keep-alive cadence change is reversible via commit revert.
