---
name: healthcare-be-auth-audit
description: Independent native read-only backend document authorization, concurrency and lifecycle audit on the frozen packet.
agent: subagent_explore
---

Run in a fresh native read-only Explore context. Read .devin/agents/healthcare-reviewer.md and the original code-reviewer description. Role=backend authorization/concurrency reviewer. State model/runtime limitations; this is a native fallback, not a qualified production route.

Read reports/local-audit-final-review-packet.json first. Bind the exact manifest identity and read only its BE document/appointment/auth/audit/cleanup/storage members and their directly required DTO/entity/repository methods. No peer reports. R0: no writes, commands, DB/service queries, credentials/dotenv/private data, peers, commits, push, deployment, or destructive effects.

Independently inspect source-type-discriminated doctor access, owning-patient and booking-code authority ordering, status/revocation checks, reminder freshness across rescheduling/cancellation, advisory-lock scope/order, failed-row retry/idempotency, and shared-pool REQUIRES_NEW cleanup/audit pressure. Distinguish the observed two-caller regression from larger untested schedules. Assess listed user-owned storage-posture changes without modifying policies. Require concrete evidence for any security finding and independent execution confirmation for high-severity concurrency claims.

Return exact findings with severity/confidence/path/line/mechanism/negative-case/repair, evidence tier, unresolved hypotheses, coverage limits, and recommendedGate. Passing mocked storage is not real MinIO; test profile is not production. Do not approve release.
