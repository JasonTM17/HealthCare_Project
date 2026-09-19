---
title: Ultra deep-scan fix — chatbot chain, CI thaw, config drift
date: 2026-09-19
summary: Root-caused the always-fallback public chatbot (UUID-only citation gate vs knowledge-plane doc ids), fixed V85 phantom-column minefield that had frozen the backend image pipeline, repaired blueprint drift and shipped honest fallback UX; 743 AI + 387 FE + 66 booking tests and full CI green. One manual Render dashboard step remains to deploy the backend image.
---

# Ultra deep-scan fix — chatbot chain, CI thaw, config drift

## What happened
Executed `plans/260919-1337-ultra-deep-scan-fix/` (cook, all phases). Forensics
(behavioral A/B: direct AI probes `remote_provider` vs public-chain fallback)
proved the fallback copy originates in the Vercel BFF and that Spring dropped
**every** AI citation because `AiChatSourceResolver` accepted only catalog
UUIDs while the knowledge base keys documents `faq-*`/`bv-*`/`br-*` — both
planes share one Supabase Postgres, so a fail-closed bridge against live
`healthcare.ai_documents` rows was the honest fix (HOSPITAL_SUPPORT only).

CI had been red since `dee9919` (V85 referenced phantom `doctors.rating`,
`services.price`, an `articles.status` index column, and omitted
`PENDING_CONFIRMATION` from the appointment status CHECK — which would have
rejected every new appointment post-deploy). That red CI silently froze the
backend image pipeline (why the earlier chatbot fix never reached prod).
Also fixed: 5 `[DBG]` prints deployed in `llm.py`, stale AI host + RAG backend
in both blueprints, admin PATCH/DELETE rate-limit tier, multisymptom detector
FPs, and unlabeled fallback answers (chip + jargon-free BFF copy).

## State
- AI service live at `18e4eae`; frontend pushed; CI fully green; all suites
  green (743 AI / 387 FE / 66 booking incl. Testcontainers).
- **Blocked on owner**: backend Render service is blueprint-managed and pins its
  image digest; API PATCH is silently ignored. Dashboard → set image to
  `sha256:05a0961…` (or Blueprint Sync — render.yaml already carries it), then
  the AC1 probe must return `remote_provider`.

## Lessons
Direct-probe verification of a downstream service proves nothing about the
contract layer above it (Wukong falsified the "AI exonerated" claim). Red CI on
main is a deployment outage, not paperwork — it had frozen backend deploys for
two days unnoticed.
