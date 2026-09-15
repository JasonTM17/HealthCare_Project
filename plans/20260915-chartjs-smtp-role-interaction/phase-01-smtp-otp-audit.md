# Phase 01 — SMTP & OTP audit

## Steps
1. Inspect backend mail configuration: `apps/backend/src/main/resources/application.yml`
   (spring.mail), OTP sender service, and `infrastructure/docker-compose.yml`
   Mailpit wiring + `.env.example` SMTP block.
2. Browser journey: guest booking via `/dat-lich` to step 4 (OTP). Read the OTP
   from Mailpit HTTP API (`http://localhost:8025/api/v2/messages`), enter it,
   confirm the appointment-code success screen. Screenshot both.
3. Negative check: wrong OTP shows a clear retry error without leaking state.
4. Password-reset / verify-email mail rendering: request reset for the demo
   patient, capture the Mailpit message, confirm the link shape (no localhost
   hard-code vs configured origin).
5. Production gap: document what happens when `SMTP_*` env is absent in hosted
   (render.yaml) — does mail fail closed with user-visible messaging?

## Acceptance
- OTP journey PASS in browser with Mailpit evidence (`scratch/ui-audit-0914/smtp/`).
- Any gap recorded in the audit report with severity and fix (if small).
