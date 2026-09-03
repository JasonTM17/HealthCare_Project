---
phase: 3
title: "Commit and fast-forward local main"
status: pending
priority: P1
effort: S
dependencies: [2]
---

# Phase 3: Commit and fast-forward local main

## Overview

Create an explicit-scope local commit for the login refresh, then fast-forward local `main` to the reviewed branch. This phase does not push, deploy, delete refs or clean worktrees.

## Requirements

- **Functional**: The merged tree contains the reviewed login implementation and regression.
- **Non-functional**: Unrelated dirty and untracked files remain byte-for-byte untouched; provenance is auditable.

## Implementation Steps

1. Re-identify `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse main`, and `git status --short`; verify `main` is still an ancestor and the reviewed SHA is unchanged.
2. Stage only the plan-owned implementation paths (`page.tsx`, login module CSS, focused e2e spec, design doc); inspect `git diff --cached --name-status` and `git diff --cached --check`.
3. Ask the designated git-manager to create a Conventional Commit describing the login refresh. Record the resulting SHA; do not stage AGENTS/CLAUDE/.vercel or unrelated WIP.
4. From a clean integration context that preserves unrelated WIP, run `git merge --ff-only <reviewed-branch-or-commit>` into local `main`. If the working tree prevents a safe fast-forward, stop and report the exact blocker instead of stashing or resetting broadly.
5. Verify `git status --short`, `git log -1 --oneline`, `git merge-base --is-ancestor <reviewed-sha> main`, and `git diff --check`. Report push/CI/deploy as not performed.

## Success Criteria

- [ ] Commit contains only explicit plan-owned paths.
- [ ] Local `main` fast-forwards to the reviewed commit with exact SHA recorded.
- [ ] Unrelated dirty/untracked paths remain present and unchanged.
- [ ] No remote mutation or production claim is made.

## Risk Assessment

- **Risk**: Merge operation collides with unrelated dirty work.
- **Mitigation**: preflight status/path audit and fast-forward only; stop on conflict.
- **Rollback/recovery**: local merge is reversible by resetting only the integration ref to its pre-merge SHA if explicitly authorized; never force-push.

## Evidence and Handoff

- **Required gate**: commit SHA, pre/post `main` SHA, staged path list, status snapshots, and merge command result.
- **Owner**: git-manager/integration owner.
- **Next phase dependency**: final handoff to user with local merge state and explicit push/CI/deploy boundary.
