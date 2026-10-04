---
name: healthcare-test-evidence-audit
description: Native read-only review of the isolated local browser QA harness, real-flow coverage and evidence limits; no test execution or product writes.
agent: subagent_explore
---

Run in a fresh native read-only Explore context. Read .devin/agents/healthcare-reviewer.md and the original project reviewer description when available. Report role=QA coverage reviewer, originalDescriptionLoaded, resolved model or unknown, and native fallback limitations. No peer reports.

This mission concerns the fixed QA harness and existing live journeys, not mutable in-progress product repairs. Read only .devin/qa/playwright.local-audit.config.cjs, apps/frontend/tests/e2e/live-compose-demo.spec.ts, apps/frontend/playwright.compose.config.ts, reports/local-audit-pdf-observation.json, and directly referenced test helpers/controller route definitions needed to classify coverage. Do not read dotenv, credentials, captured cookies, private data, or app configuration secrets. No commands, service/browser/DB calls, writes, peers, commits, push, deployment, or destructive effects.

The controller has syntax-checked the new QA configuration and directly verified its positive scope plus refusal of a non-audit frontend port and a direct/non-audit API origin. It targets only localhost:3330, forces same-origin API/BFF, does not load root dotenv, clears a test-only BFF-token variable, disables network traces/video, and includes live-compose specs with retries zero and one worker. Treat those as supplied controller observations, not checks you executed.

Check whether existing live tests genuinely traverse public booking/OTP, patient/doctor/admin portals, simulated payment, private consultation/AV attachment/care-plan, persisted AI/SSE/emergency and CMS publish/rollback; distinguish browser UI versus API versus mocked/fail-closed fallback coverage. Identify gaps in real PDFs, currentness/roles, credit accounting and browser console evidence. Analyze cleanup operations and flag any destructive operation lacking specific authority; do not execute it or infer permission from a test name. A proposed real-PDF test must validate actual downloaded file bytes, SHA-256 and parsing for all supported classes; a download event alone is insufficient. Account for shared browser context drift and require dedicated owned contexts/origin binding.

Return exact grounded coverage, identity/inspection limits, unsafe assumptions or harness defects, missing acceptance cases, and nextGate. Do not invent live outcomes, counts, screenshots, passing CI, coverage percentages, or production readiness. Product repairs will be reviewed on a separate fresh frozen packet after implementation.
