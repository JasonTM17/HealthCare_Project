---
phase: 1
title: "Production chatbot chain forensics and repair"
status: pending
priority: P0
effort: "4-6h"
dependencies: []
---

# Phase 1: Production chatbot chain forensics and repair

## Overview
Identify the exact failing hop in BFF→Spring→AI with timestamped log evidence, then apply the targeted repair and prove `remote_provider` on production.

## Requirements
- Functional: `POST /api/v1/public/ai/chat` on production returns a grounded answer (`provenance=remote_provider`, `safety_action=ANSWER`) for the standard fixture on a warm service, and never a raw error on a cold service.
- Non-functional: no blind fixes; every change traceable to a log line or a measured budget violation.

## Architecture
Request chain: Browser → Vercel BFF (`healthcare-bff.ts`, public-AI timeout 35s) → Spring `PublicAiChatController` (read timeout 35s, connect 1s) → FastAI service `/chat` (wake 45–60s cold, 6–15s warm). Fallback copy origin: `publicAiChatFallbackResponse` (BFF).

## Related Code Files
- Modify (pending forensics): `apps/frontend/lib/server/healthcare-bff.ts`, `apps/backend/src/main/java/com/healthcare/ai/controller/PublicAiChatController.java`, `apps/backend/src/main/java/com/healthcare/ai/service/AiService.java`, `apps/ai-service/app/main.py`, `.github/workflows/render-keep-alive.yml`
- Create: `plans/260919-1337-ultra-deep-scan-fix/reports/chain-budget-table.md`

## Implementation Steps

### Stage 1a — read-only forensics (hard gate: no code changes before this passes review)
1. Record the deployed **triplet**: Vercel deployment ID, backend image (commit=NULL — record image ID), ai-service commit — beside every probe from here on.
2. Identify the current backend image as the known-good rollback target BEFORE any change.
3. Via Render Logs API, tail `srv-daigprh5efls73dfau00` (backend) and `srv-daigq6vqj5pc73a284l0` (AI) while replaying the public probe (`apps/frontend/scratch/p1.json`).
4. Instrument (temporary, removed before merge) WARN logging at the Spring-side stages the direct probes skipped: each `badGateway` path, citation `sourceResolver.revalidate` null/throw (`PublicAiChatController.java:876-922`), and `publicCatalogFallback`-null. Replay while tailing.
5. Record `costTier`/`routingReason` presence on the 200 response (absence proves BFF authorship — already indicated by E1).
6. Build the budget table against the real ceilings: browser abort 40s (`api-client.ts:171`), Vercel Hobby cap 60s, BFF 35s, Spring read 35s (env-raisable), AI cold 45–60s warm 6–15s.
7. Review gate: failing hop named with a timestamped log line, or an explicit "logs empty" record + instrumented repro result.

### Stage 1b — repair (strictly after the 1a gate)
8. If logs show Spring image ≠ HEAD behavior, trigger a backend image deploy FIRST (record commit↔image mapping — closes E10). BFF changes only after this lands.
9. Apply the targeted fix per D2: warm-slow ≤35s survives end-to-end; full cold start = labelled honest fallback within budget (do NOT chase an impossible 65s+ budget through the 40s/60s ceilings).
10. Re-run probe matrix: warm (expected `remote_provider`), cold after ≥20-min idle (expected visible wait stages then labelled fallback within budget).
11. Record evidence + decision in `reports/chain-budget-table.md`.

## Success Criteria
- [ ] Failing hop identified with a timestamped log line (or an explicit "logs empty" record + instrumented repro)
- [ ] AC1 warm probe `remote_provider` on production
- [ ] AC2 cold probe: visibly alive input, labelled fallback or answer within budget, never a raw error
- [ ] Commit↔image mapping recorded for the backend deploy; rollback image identified before change
- [ ] Deployed triplet recorded beside every accepted probe

## Risk Assessment
Logs may be rotated past the failure window → replay live while tailing; Vercel function duration cap may block a naive budget raise → verify plan limit before editing constants (fallback: stream path or early-hold pattern).
