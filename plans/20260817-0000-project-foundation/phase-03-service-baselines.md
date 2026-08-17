---
phase: 3
title: "Backend, frontend, and AI service baselines"
status: pending
priority: P1
effort: "large"
dependencies: [1, 2]
---

# Phase 3: Backend, frontend, and AI service baselines

## Overview

Bootstrap runnable health-check baselines for the three application services without business features or provider calls. The frontend baseline must also establish a polished, original healthcare design direction using AgentKit frontend workflow and optional Stitch generation.

## Requirements

- **Functional**: Backend baseline uses Spring Boot 3, Java 21, Maven or Maven wrapper, and a health endpoint.
- **Functional**: Frontend baseline uses Next.js, TypeScript, Tailwind, and a minimal accessible shell.
- **Functional**: Frontend baseline follows `ak:frontend-design` and uses Hoan My only as structural healthcare UX inspiration.
- **Functional**: Frontend implementation choices follow `ak:frontend-development` when React/Next code begins.
- **Functional**: Stitch generation/export is attempted only when dependencies/quota are available; otherwise record `NOT_RUN` and continue with text-based design.
- **Functional**: AI service baseline uses FastAPI, Pydantic, pytest, and a health endpoint that needs no provider key.
- **Non-functional**: Each service has documented local commands and baseline tests where practical.
- **Non-functional**: Do not copy Hoan My logo, colors, photos, doctor identities, addresses, phone numbers, package names, news titles, or medical claims.

## Architecture

Services are independent at foundation stage. Cross-service business integration is deferred until after health checks and local commands are stable. The frontend visual system is a foundation artifact: it should define original tokens, responsive layout, focus states, reduced motion behavior, and appointment-oriented navigation without implementing real booking flows.

## Related Code Files

- **Modify/Create**: `apps/backend/**`
- **Modify/Create**: `apps/frontend/**`
- **Modify/Create**: `apps/ai-service/**`
- **Modify**: `README.md`
- **Modify**: `.env.example`
- **Delete**: none

## Implementation Steps

1. Check Java/Node/Python tooling availability without installing secrets or calling providers.
2. Bootstrap backend health endpoint and tests.
3. Bootstrap only the minimal frontend project shell and quality scripts.
4. Run `ak:frontend-design` decision procedure before polished UI coding: healthcare landing read, neo-grotesque/refined clinical thesis, original palette/type/layout tokens, no copied Hoan My assets/content.
5. If Stitch dependencies/quota are available, generate/export a static concept into a plan-scoped design artifact before coding polish; otherwise mark Stitch generation/export `NOT_RUN`.
6. Use `ak:frontend-development` for React/Next implementation decisions after the design gate.
7. Verify chosen fonts render Vietnamese diacritics before finalizing frontend tokens.
8. Bootstrap AI service health endpoint and pytest baseline.
9. Document exact commands and evidence states.

## Success Criteria

- [ ] Backend build/test/health command is documented and passes or is honestly `BLOCKED` by missing local tooling.
- [ ] Frontend lint/typecheck/test/build command is documented and passes or is honestly `BLOCKED` by missing local tooling.
- [ ] Frontend has an original healthcare design thesis, responsive shell, accessible states, and no copied Hoan My assets/content.
- [ ] Chosen frontend fonts render Vietnamese diacritics correctly.
- [ ] Stitch generation/export is either completed with artifact paths or honestly recorded as `NOT_RUN`/`BLOCKED`.
- [ ] AI service pytest/health command is documented and passes or is honestly `BLOCKED` by missing local tooling.
- [ ] No provider credentials are required for baseline health checks.

## Risk Assessment

- **Risk**: Tooling bootstrap chooses an unsupported package manager or version.
- **Mitigation**: prefer evidence-based defaults and document substitutions.
- **Rollback/recovery**: revert only the affected service baseline files; preserve root safety files.
- **Risk**: Frontend copies Hoan My instead of using it as inspiration.
- **Mitigation**: require original naming, copy, imagery, tokens, and self-review before acceptance.
- **Rollback/recovery**: remove copied assets/content and regenerate original design artifacts.
- **Risk**: Stitch availability is mistaken for completed design evidence.
- **Mitigation**: record `STITCH_API_KEY` presence only, verify dependencies/quota, and mark generation/export `NOT_RUN` unless actual artifacts exist.
- **Rollback/recovery**: fall back to text-based `ak:frontend-design` implementation.

## Evidence and Handoff

- **Required gate**: local commands for each service, with `PASS`/`FAIL`/`BLOCKED`/`NOT_RUN` states.
- **Owner**: foundation long-run owner.
- **Next phase dependency**: infrastructure should reference only services with known run commands.
