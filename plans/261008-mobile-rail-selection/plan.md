---
title: Mobile care rail follows the current page
status: in-progress
priority: P1
effort: small
branch: main
tags: [navigation, mobile, ui]
created: 2026-10-08
---

## Outcome and authority
The user's mobile navigation request is the bounded accepted plan: only the current page's rail item has a solid green background and white label. Booking must not look selected on other pages. Existing route matching, telephone contact action, keyboard focus and desktop hiding remain intact. Earlier commit/push/deploy authority applies to the continued website repair; no further history rewrite or branch protection changes are authorized.

## Evidence and scope
Baseline dbcd153e; shared main has unrelated untracked screenshots/scripts, preserved. Footer already computes aria-current from usePathname. Global CSS gives booking an unconditional green background while other selected pages only receive a faint tint. Change only rail CSS and its existing rendered browser tests. No auth, API, contact semantics, or unrelated cleanup.

## Execution
See [phase-01](phase-01-fix-and-verify.md). Consistency sweep: route state remains the single source of truth; remove competing booking-only paint rather than add click state. All four items share selected styling in both palettes.

## Verification budget and release
Run node --test tests/footer-care-rail.behavior.test.mjs in apps/frontend before and after CSS repair. Cover 320/375/390/430px, route changes/detail paths, keyboard/press behavior, phone action and hidden desktop rail. Inspect browser screenshot; perform independent read-only review. Run git diff --check; CI supplies package build/test gates at the published SHA. Rerun only affected gates on observed failures. Existing protected-main PR workflow stays intact. Release evidence must distinguish source, CI and live deployed navigation.

## Risk and rollback
CSS cascade could keep the old booking paint: tests check every idle item as well as the selected one. Rollback is a revert of this scoped change; preserve concurrent main updates and use normal merge only. Native goal creation is blocked by the unfinished Google goal; this plan records the new objective without falsely completing the old live-account gate.
