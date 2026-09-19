---
phase: 2
title: "Debug hygiene and config drift repair"
status: pending
priority: P0
effort: "1-2h"
dependencies: []
---

# Phase 2: Debug hygiene and config drift repair

## Overview
Remove the five deployed debug prints from `llm.py`, align every blueprint/contract-test host with the real Render service URL, and make the credential-bearing scratch file uncommitable. Ships independently of Phase 1.

## Requirements
- Functional: contract tests assert the real host; repo contains no `[DBG` prints; `scratch-prod.env` ignored.
- Non-functional: one atomic commit for blueprint+tests; AI suite stays ≥741 green.

## Architecture
Pure hygiene — no behavior change beyond log noise removal. The stale host (`https://healthcare-beta-ai.onrender.com`) vs real host (`https://healthcare-beta-ai-9mip.onrender.com`) divergence is a time bomb for the next blueprint apply.

## Related Code Files
- Modify: `apps/ai-service/app/llm.py` (lines 1727, 1756, 1760, 1808, 1863), `render.yaml:140`, `render-free-beta.yaml:139`, `infrastructure/tests/test_render_blueprint_contract.py:117`, `supabase/tests/test_render_blueprint_contract.py:51`, `.gitignore`
- Create or delete: `scripts/` probe tooling decision per D5 (`scripts/verify/README.md` if promoted)

## Implementation Steps
1. Delete the five `[DBG ...]` print statements (log-only; verify no logic references).
2. Update both blueprints and both contract tests to the real host; run the contract tests.
3. Add `apps/ai-service/scratch-prod.env` (and `scratch/token.tmp` pattern) to `.gitignore`.
4. Decide D5: promote `scripts/*.mjs` probes into `scripts/verify/` with README or delete superseded ones; list the disposition.
5. Run AI pytest suite (≥741) and `git diff --check`.

## Success Criteria
- [ ] AC3: `grep -rn "\[DBG" apps/ai-service/app/` → 0 hits
- [ ] AC4: contract tests green against real host
- [ ] AC5: `git check-ignore apps/ai-service/scratch-prod.env` exit 0
- [ ] AI pytest ≥741 passed

## Risk Assessment
Removing prints could touch gate code accidentally → diff review is line-level; prints are stdout/stderr only. Host change could conflict with a future blueprint apply → both blueprint and tests change atomically.
