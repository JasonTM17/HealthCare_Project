---
phase: 4
title: "Contracts, admin audit, SMTP, chatbot, TinyMCE (C1, D1-D4, E1-E4, F2-F4)"
status: pending
priority: P1
effort: "6h"
dependencies: ["phase-01-baseline-and-production-blockers"]
---

# Phase 04 — Contracts, admin, email, chatbot, rich content

## Overview
Small orthogonal fixes, each its own commit where practical.

## C1 — Patient notification contract
`PATCH /notifications/{id}/read` → align to backend `PUT` (client change), with
a failing-before regression at the api-client test layer.

## D1 — Admin delete snapshots
Reuse the article/specialty/FAQ revision-snapshot pattern for
doctor/service/branch/package deletes (before-state snapshot; delete semantics
unchanged).

## D2 — Pagination
Backend page defaults + FE params for admin health questions, consultations, AI
credits.

## D3 — Admin form completeness
Doctor form exposes `userId`; specialty form exposes accepted clinical fields
(Vietnamese labels, validation) — only fields the DTO already accepts.

## D4 — Email resilience
Registration/OTP/reset + payment-status email route through after-commit/outbox
best-effort so SMTP outage cannot roll back auth transactions; Vietnamese
delayed-delivery copy; no raw provider errors; outbox retries observable.

## E1/E3 — Chatbot metadata + a11y
Propagate `used_sources`/`cost_tier`/`routing_reason` AI→Spring→TS (ops logs;
UI optional badge). Focus trap + `aria-modal` on the assistant dialog using the
existing helper. E4 abort: server-side timeout/cost guards + documented deferral.

## E2 — Cost posture decision (documented)
Keep patient remote-LLM disabled by default; make the gate explicit in
`render.yaml` comments + ops docs (no silent drift).

## F2/F3 — TinyMCE honesty (posture A)
Remove toolbar/menu controls that cannot survive `htmlToMarkdown` (forecolor,
backcolor, fontfamily, fontsize, superscript, subscript) from the shared editor
config; correct the iframe-sanitize comment; add XSS-safety regressions
(`<img onerror>`, `javascript:` href, `<iframe srcdoc>`, svg/data URLs) proving
the React render path blocks them; plugins/assets check stays.

## Success Criteria
- [ ] Each area's regression test green; FE suite + typecheck green.
- [ ] Backend targeted tests green (Notification, Admin*, Auth/Email, AiConversation).
- [ ] `pytest` green for AI contract changes.
- [ ] Toolbar no longer offers unrepresentable formatting (unit assertion).

## Risk Assessment
Email best-effort could hide outages → outbox retry counters logged/alerted.
DTO additions are additive with defaults; TS types updated in same commit.
