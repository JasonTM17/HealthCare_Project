---
phase: 5
title: "Portal session correctness (P3 backlog)"
status: pending
priority: P2
effort: "3-4h"
dependencies: [3]
---

# Phase 5: Portal session correctness (P3 backlog)

## Overview
Harden patient/doctor/admin session handling: cross-tab consistency, expiry behavior, post-login `?next=` routing, and consentVersion propagation.

## Requirements
- Functional: login/logout syncs across tabs; expired session redirects to login preserving the original route; consent version bump forces re-accept.
- Non-functional: no auth architecture change; no token in localStorage if the current design uses cookies (respect existing decision).

## Architecture
Audit-first: the phase begins by recording the current storage/mechanism, then applies the smallest fixes per gap; no redesign.

## Related Code Files
- Modify (per findings): `apps/frontend/lib/session/**` or equivalent, `apps/frontend/app/auth/login/page.tsx`, portal layout guards (`components/PortalChrome.tsx` or equivalent)
- Test: auth/session unit tests in `apps/frontend/tests/`

## Implementation Steps
1. Audit and document current storage, expiry, refresh, and redirect behavior (evidence into the phase file).
2. `?next=` param: preserve and validate (internal-path only — reject `//` and absolute URLs, open-redirect guard).
3. Cross-tab: storage event/BroadcastChannel for logout and token refresh.
4. Expiry: 401 → refresh → retry-once → redirect with `?next=`.
5. consentVersion: audit only — defer implementation unless the sweep found it broken (Advisor scope call; no user-visible defect today).
6. Negative tests: tampered token, expired token, `?next=//evil.example`, `?next=https://evil.example` (plan-level AC14).

## Success Criteria
- [ ] AC6/AC7 green with new session tests
- [ ] Open-redirect negative test green
- [ ] Cross-tab logout verified in browser evidence

## Risk Assessment
Session changes can lock users out → cover all three portals in the sweep; `?next=` validation is security-sensitive → negative tests mandatory (Wukong reviews this phase).
