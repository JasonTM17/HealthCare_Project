# Final verification report — ultra deep-scan fix (2026-09-19)

## Outcome

Root cause of the always-fallback production chatbot was found, fixed, and
tested; every local + CI gate is green; the only remaining step is one manual
Render dashboard action (backend image deploy) that the API cannot perform.

## The causal chain (verified, not assumed)

1. Public chatbot → Vercel BFF → Spring → AI service. The fallback copy lives in
   `healthcare-bff.ts` (proven: prod response omits `costTier`/`routingReason`
   which every Spring fallback includes).
2. Spring's citation revalidation (`AiChatSourceResolver.resolve`) accepted only
   catalog UUIDs; the knowledge base keys documents `faq-*`/`bv-*`/`br-*`.
   Every AI answer therefore died at `badGateway` → BFF fallback — warm or cold.
3. A/B proof: direct AI call (incl. exact Spring payload shape) →
   `remote_provider/ANSWER`; public chain minutes later → fallback.
4. Bonus traps fixed en route: phantom `doctors.rating`/`services.price`
   columns + a status CHECK omitting `PENDING_CONFIRMATION` in V85 (CI had been
   red since `dee9919`, silently freezing the backend image pipeline), stale AI
   host + `RAG_STORAGE_BACKEND` in the blueprints, five deployed `[DBG]` prints.

## Gates actually observed

| Gate | Result |
|---|---|
| AI pytest | **743 passed** |
| Frontend unit (npm test) | **387 pass / 0 fail** |
| Frontend typecheck + lint | green |
| Backend focused (booking + schedule + filter + resolver bridge, Testcontainers) | **66/66 green** locally |
| CI (all jobs) on `18e4eae` | **success** (run 35434352740) — first fully green main CI since `dee9919` |
| Image publish (4 images) | success, run 35434689072 |
| Contract tests (blueprint) | 9/9 green |
| Playwright E2E (floating-assistant) | green in CI after chip scoping fix |
| Live probe matrix (AC1 warm `remote_provider`) | **BLOCKED** — backend still runs the Sep-17 image; see blocker |

## Deployment state

| Service | State |
|---|---|
| AI service (Render, git auto) | **live at `18e4eae`** — debug prints out, detector fix in |
| Frontend (Vercel, git auto) | pushed; last probe still returned old BFF copy at 09:5xZ — verify dashboard deployment if it hasn't rolled |
| Backend (Render, image-pinned) | **BLOCKED — manual step needed** (below) |

## The one remaining action (owner, Render dashboard)

The backend service is blueprint-managed and pins its image by digest; the
Render API accepts but silently ignores `imagePath` PATCHes. To ship the fix:

1. Render dashboard → `healthcare-beta-backend` → Settings → Image URL → set
   `ghcr.io/jasontm17/healthcare-project-backend@sha256:05a0961852a8770225f81af159ee65ca08e6ffe158b7e6486c42aa76f20bfeb2`
   (or run **Sync Blueprint** — `render.yaml` in repo already carries this digest).
2. Wait for deploy `live`, then run the probe:
   `curl -X POST https://www.healthcare.id.vn/api/v1/public/ai/chat ... @apps/frontend/scratch/p1.json`
   → expect `provenance=remote_provider`, `costTier=remote_llm`.

## Commits

`f011701` plan → `bfffe53` bridge → `88abcad` hygiene → `e301c35` CI repair →
`e7e03f4` chat-ux + detectors → `7a53db4` V85 guard → `30bb0d8` V85 schema
alignment → `2ca6328` booking contract → `18e4eae` chip scoping. All pushed to
`origin/main`.

## Honest limits

- Cold-start budget: a full AI cold wake (45–60s) still cannot traverse the
  35s/40s/60s ceilings; the designed outcome is the labelled fallback with
  one-tap retry (AC2), not a guaranteed remote answer when cold.
- Playwright E2E was exercised inside CI only; the local ad-hoc browser sweep
  used HTTP probes + prior screenshots, not a fresh full GUI walkthrough.
- Direct Render log API access failed with the available key (filter-schema
  rejected) — attribution relied on behavioral A/B probes + code evidence.
