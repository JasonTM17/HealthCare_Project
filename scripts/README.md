# Verification scripts

Ad-hoc production verification tools used by the QA/audit phases. All are
read-only against production unless stated otherwise.

| Script | Purpose |
|---|---|
| `probe-live.mjs` | HTTP status + latency sweep of the core public routes (home, doctors, articles). |
| `probe-packages.mjs` | Checks every package card on `/packages` exposes a booking CTA. |
| `probe-packages-all.mjs` | Same sweep across the full package catalogue pages. |
| `probe-doctors-pagination.mjs` | Verifies `/doctors` pagination surfaces all doctors without 502/timeout. |
| `verify-deploy-qa.mjs` | Post-deploy acceptance: pages, API health, and content spot checks. |
| `verify-v82.mjs` | Regression probe for the V82 doctor-specialty reconciliation (historical). |
| `audit-r6-browser.mjs` | Browser-level audit from the R6 remediation round (historical). |
| `challenge-m5-adversarial.mjs` | Adversarial probe corpus for the chatbot safety gates (historical). |

Run with Node 18+: `node scripts/<script>.mjs`. Scripts that POST fixtures may
require the fixture JSON paths documented inside the file header.
