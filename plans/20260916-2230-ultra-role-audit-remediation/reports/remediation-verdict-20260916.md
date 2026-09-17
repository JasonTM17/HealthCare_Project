# Remediation verdict — 2026-09-16/17 ultra role-audit

Base: `ebaeea3` → HEAD `1d86279` (14 commits on `main`, pushed).
Plan: `plans/20260916-2230-ultra-role-audit-remediation/` (ultra winner c2, 93/100;
Kongming GO; Wukong gates satisfied per-phase).

## Outcome per packet finding

| Finding | Disposition | Commit / evidence |
| --- | --- | --- |
| A1 demo credentials on public login | FIXED | `a4ec36b` — gate `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`; regression `auth-demo-gating.test.mjs` |
| A2 fake clinicians presented as real | FIXED | `01690b4` + `1d86279` — backend `demo` flag on DoctorSummary/DoctorResponse; disclosure on detail/list/home; booking honesty via G1 `activeDoctorCount` |
| A3 unsupported equipment claim | FIXED | `01690b4` — confirmation-based copy |
| A4 public booking dead-ends into portal | FIXED | `01690b4` — auth-aware payment CTA + gated portal chip |
| A5 private-portal CTA on public page | FIXED | `01690b4` — contact CTA |
| A6 homepage placeholder copy + nested links | FIXED | `01690b4` |
| A7 noindex default + sitemap gaps | FIXED | `01690b4` — canonical-host `indexingAllowed()`; dynamic detail pages in sitemap (disease guides excluded from `/articles`) |
| B1 no lab-order workflow | FIXED | `9425ec8` — V76 `diagnostic_orders`; publish-without-order impossible; two-step doctor UI |
| B2 stale-relationship writes | FIXED | `cfd41b0` — same-day active encounter required (business zone) |
| B3 4000-UI vs 2000-DB diagnosis | FIXED | `cfd41b0` — DTO `@Size` to V5 columns; FE mirrors; 400 field error |
| B4 prescription safety/audit | FIXED | `ef70176` — V77 PRESCRIBE audit action + per-prescription ALLOW row; item DTOs sized; multi-line composer |
| B5 misleading "đã xác thực" queue | FIXED | `cfd41b0` — truthful labels both portals |
| B6 invented aiCredits 150 | FIXED | `cfd41b0` + `01690b4` (DTO default removed) |
| B7 time-of-day loss | FIXED | `cfd41b0` — time input + `businessDateTimeIso(value, time)` |
| C1 notification PATCH/PUT | ALREADY ALIGNED | re-verified: client sends PUT (`api-client.ts:2970-2972`); earlier audit finding was stale |
| D1 missing delete audit | FIXED | `72cb43a` — tombstone snapshots via content-revision mechanism (V78) |
| D2 unpaginated admin queues | FIXED | `72cb43a` backend (page/size cap 100, array+headers) + `39b592f` FE paging |
| D3 admin form gaps | FIXED | `39b592f` — doctor `userId` (UUID-validated), specialty clinical fields |
| D4 SMTP outage hard-fails auth | FIXED | `c57b936` — outbox-first, best-effort degrade, payment safe |
| E1 chatbot metadata dropped | FIXED | `0a0a031` — usedSources/costTier/routingReason AI→Java→TS; public fallback honest |
| E2 remote-LLM posture | DOCUMENTED | prod config keeps patient remote off deliberately; visible in config; no silent drift |
| E3 dialog a11y | FIXED | `c976357` — focus trap, aria-modal, focus restore |
| E4 server-side abort | DEFERRED (recorded) | synchronous generation; documented as technical debt per plan decision |
| F1 uploads broken in prod | FIXED | `a4ec36b` — FE mirrors `storage.upload-enabled` posture; honest disabled state; backend fail-closed validation pre-existing |
| F2 WYSIWYG style loss | FIXED (posture A) | `c976357` — lossy controls removed from toolbar/menus; markdown contract honest |
| F3 lying sanitize comment | FIXED | `c976357` + `rich-content-safety.test.mjs` |
| F4 plugin/asset integrity | VERIFIED OK | unchanged; `rich-editor.test.mjs` keeps plugin matrix test |

## Regression caught post-commit (fixed)

`d443520` — G1's `_public_fallback_requires_source` marked all
preparation-term queries INSUFFICIENT_EVIDENCE, breaking the pre-existing
"chuẩn bị trước khi đặt lịch" ANSWER contract. Booking-logistics now defers
to the navigation branch; clinical preparation stays ungrounded-until-source.
ai-service 596/596.

## Gates observed (exact)

- FE: `node --test tests/*.test.mjs` → **353 pass / 0 fail**; `npm run typecheck` → green.
- Backend: `mvn test` (full) → **706 run / 0 fail / 0 error** (~9 min).
- ai-service: `pytest tests/` → **596 passed**.
- Targeted during phases: ClinicalAuthorizationTest 17/17; admin/healthqa/
  consultation/credit 117; mail/auth/outbox/payment 103; AI chat 50.
- `git diff --check` clean; secret scan: no key-shaped literals; remaining
  `HealthCare@2026` references are the V58 seed-migration comments (dev seed
  only — see Owner decisions below).
- Independent re-scan (fresh agent, post-remediation): **RESCAN_PASS**; one
  A2 gap found (list chip) → fixed in `1d86279`.

## Deploy state (recorded honestly)

- Vercel: auto-deploy of `1d86279` to www.healthcare.id.vn — see deploy
  section below for probe results.
- Render backend: image-backed from pinned GHCR digest with autoDeploy off;
  new images require the `Publish beta application images` workflow; deploy
  then triggered via Render API (`RENDER2_API_KEY`, env-only). Flyway
  V76/V77/V78 run on first healthy boot after the image swap.
- CI on the pushed HEAD: recorded in the final handoff message.

## Owner decisions / deferred risk

1. **V58 demo seed users remain in the hosted DB.** The login page no longer
   advertises them (A1), but the accounts themselves are the beta's demo
   identity. Disabling them in production would break the owner's demo
   flows — explicit owner call, recommended before any real-user exposure.
2. **E4 abort propagation** stops at the BFF; Spring/FastAPI generation is
   synchronous. Documented technical debt with server-side guards in place.
3. **Sanitized-HTML persistence (posture B)** intentionally not taken; the
   Kongming conditions for it are listed in `reports/audit-20260916/`.
4. Mimosa pre-commit scanner ran degraded (`scanner_enobufs`); a full
   security audit was not claimed — schedule one before real-patient data.
