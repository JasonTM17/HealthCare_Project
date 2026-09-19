---
phase: 7
title: "Verification sweep, release, and live acceptance"
status: pending
priority: P0
effort: "2-3h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Verification sweep, release, and live acceptance

## Overview
Run every gate in §7 of plan.md, deploy, verify live production, and write the final handoff report.

## Requirements
- Functional: all ACs green or honestly NOT_RUN with reason.
- Non-functional: Conventional Commits; no secrets in logs or evidence.

## Architecture
Single verification owner (this session) compiles evidence from all phases into `reports/final-verification.md`.

## Related Code Files
- Create: `plans/260919-1337-ultra-deep-scan-fix/reports/final-verification.md`
- Modify: `docs/` (budget contract table link, probe toolset README link)

## Implementation Steps
1. Run AC1–AC12 commands; record command, result, environment, limitation per gate.
2. `git diff --check`, secret scan on staged files; commit in Conventional Commits; push `main`.
3. Deploy: Vercel auto; backend image deploy triggered + mapping recorded; ai-service auto.
4. Live acceptance: repeat the probe matrix + spot browser checks on production.
5. `/ak:journal` entry + final handoff message (outcome, files, gates, commit/CI state, risks, next action).

## Success Criteria
- [ ] All ACs recorded green (or NOT_RUN with cause)
- [ ] Production probe matrix matches local evidence
- [ ] Handoff report complete

## Risk Assessment
Deployment may lag probes → poll deploy status before live acceptance; integration tests remain NOT_RUN if Docker is absent (recorded, never claimed).
