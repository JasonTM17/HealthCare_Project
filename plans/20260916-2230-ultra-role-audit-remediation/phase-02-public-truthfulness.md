---
phase: 2
title: "Public truthfulness (A2-A7)"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-baseline-and-production-blockers"]
---

# Phase 02 — Public truthfulness

## Overview
Applied ON TOP of the isolated G1 commit (Wukong gate 3). Make every
unauthenticated page professionally truthful: fake clinicians disclosed and
non-bookable, no unsupported medical-operations claims, no private-portal dead
ends, honest empty states, production-safe SEO.

## Requirements
- A2: demo doctors (`DỮ LIỆU MINH HỌA`, slug prefix `demo-bs-`) are visibly
  disclosed on list + detail pages and are NOT bookable in production; with G1's
  `activeDoctorCount`, branch CTAs already gate on real availability.
- A3: remove "all branches have full equipment" claim; branch-neutral Vietnamese copy.
- A4: public booking success offers public-safe next steps (confirmation +
  hotline + optional sign-in), never deep-links guests into `/patient/**`.
- A5: public disease-guide CTA goes to public contact/AI assistant, not `/patient/community`.
- A6: homepage article empty state professional; no nested duplicate links.
- A7: indexing allowed in production when canonical domain configured
  (`NEXT_PUBLIC_ALLOW_INDEXING` default true in production env docs);
  sitemap includes doctor/specialty/service/package/branch/article details.

## Related Code Files
- Modify: `apps/frontend/app/doctors/DoctorsPageClient.tsx`, `app/doctors/[slug]/page.tsx`,
  `app/page.tsx`, `app/benh-pho-bien/page.tsx`, `app/robots.ts`, `app/sitemap.ts`,
  `components/PackageBookingModal.tsx`, `components/BookingModal.tsx`,
  `app/layout.tsx` (metadata), types as needed
- Tests: homepage-polish, booking-branch, new public-truth unit tests; targeted Playwright

## Success Criteria
- [ ] Regression tests: demo doctor detail shows disclosure; demo booking CTA
      hidden in production posture; booking success screen has no `/patient/**`
      link for guests; sitemap includes detail routes.
- [ ] `node --test` + typecheck green; targeted Playwright green.

## Risk Assessment
Emptying the public doctor catalog if all seeds are demo → disclosed
non-bookable cards remain visible (honest), real catalog unaffected.
