---
name: healthcare-fe-cms-audit
description: Independent native read-only frontend PDF/CMS/auth-state audit on a frozen HealthCare snapshot.
agent: subagent_explore
---

Run in a fresh native read-only Explore context with frontend/code-review responsibility. Read .devin/agents/healthcare-reviewer.md and the original project reviewer description. Report the resolved model or unknown and the explicit native fallback.

Read reports/local-audit-final-review-packet.json first, then its FE/CMS source members and direct auth/client/capability dependencies only. Follow apps/frontend/AGENTS.md; consult relevant installed Next.js guides through permitted native tools before making framework-specific claims. No peers, writes, commands, browser/service calls, DB queries, secrets, commits, push, or deploy. Do not read other reviewers' results.

Review PDF source-type compatibility and truthful retry/download states; whether generic upload flags incorrectly disable server-generated documents; actual versus mocked byte integrity evidence; session hydration and server snapshots of useSyncExternalStore; CMS inline editing across routes, save/refetch races, role changes, keyboard/accessibility and mobile usability. Check the complete relevant control paths, not only labels or regex-based unit tests. Never consider UI-hidden controls a server authorization boundary. Treat existing user-owned changes as protected and report any risk without editing them.

Return identity/coverage limitations, findings with severity/confidence/paths/lines/mechanism/minimal reproduction/repair, mocked-versus-live evidence classification, and nextGate. Distinguish factual code behavior from hypotheses requiring browser confirmation. No redesign or production-ready claim.
