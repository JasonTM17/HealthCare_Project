---
phase: 4
title: "Local development infrastructure and CI shape"
status: pending
priority: P2
effort: "medium"
dependencies: [1, 2, 3]
---

# Phase 4: Local development infrastructure and CI shape

## Overview

Define local development infrastructure and future CI gates without deploying or contacting external providers.

## Requirements

- **Functional**: Add Docker Compose or equivalent local-dev manifests for PostgreSQL, Redis, MinIO, and runnable services when baselines exist.
- **Functional**: Document run/test/build commands and expected ports.
- **Functional**: Outline CI gates after local commands are known.
- **Non-functional**: No deployment, no push, no credentials, no production claims.

## Architecture

Local infrastructure supports development only. Production deployment, provider credentials, and cloud resources remain out of scope.

## Related Code Files

- **Create/Modify**: `infrastructure/**`
- **Create/Modify**: `docker-compose.yml`, if selected by implementation evidence
- **Modify**: `README.md`
- **Modify**: `.env.example`
- **Create/Modify**: CI outline documentation only; committed CI workflow files require explicit later user authorization
- **Delete**: none

## Implementation Steps

1. Check Docker availability without starting external services unnecessarily.
2. Add local Compose/dev infra only for foundation dependencies.
3. Document local commands and service ports.
4. Document CI gates based on commands that actually exist. Do not create committed CI workflow files unless the user explicitly authorizes that later.

## Success Criteria

- [ ] Local infra config exists or is explicitly `BLOCKED` by missing Docker decision/tooling.
- [ ] README documents local dev commands.
- [ ] No deploy or push occurs.
- [ ] CI outline references only commands that exist.
- [ ] No committed CI workflow files are created without explicit later authorization.

## Risk Assessment

- **Risk**: Infrastructure implies production readiness.
- **Mitigation**: label it local-dev only and avoid cloud/provider configuration.
- **Rollback/recovery**: remove local infra files without touching service source.

## Evidence and Handoff

- **Required gate**: config validation when Docker is available.
- **Owner**: foundation long-run owner.
- **Next phase dependency**: product feature planning begins only after foundation commands are stable.
