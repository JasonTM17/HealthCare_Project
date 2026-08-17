---
phase: 1
title: "Snapshot and contract"
status: completed
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Snapshot and contract

## Overview

Freeze the foundation base and define the clinical overlay acceptance boundary
after Advisor, Kongming, Wukong, and Luna review.

## Requirements

- Base identity is pinned to `1faffbd671a2d8c1bfca01b18fbed6f7aeb8ba52`.
- Clinical remains a separate overlay and is not claimed as foundation scope.
- Review findings and target-identity limitations are retained in the session handoff.

## Implementation Steps

1. Inspect current Git status, README, plan, clinical source, migrations, and test boundary.
2. Capture the pre-fix compile and test failures.
3. Obtain Advisor/Kongming/Wukong/Luna read-only disposition.

## Todo

- [x] Pin foundation base and preserve unrelated hook log.
- [x] Approve the full clinical-overlay repair contract.
- [x] Record HOLD/BLOCK findings before implementation.

## Success Criteria

The repair proceeded against the current main workspace with the clinical
source treated as untrusted input until the final exact-scope review. The
result is now part of the reviewed main snapshot; later portal/file-linkage
work remains outside this bounded repair.
