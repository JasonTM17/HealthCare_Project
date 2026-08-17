---
title: AgentKit Gemini CLI harness
status: in-progress
branch: not_verified
effort: large
created: 2026-08-15
tags: [agentkit, gemini-cli, adapter, portability]
dependencies: []
blockedBy:
  - missing-root-gemini-md
  - missing-root-readme-md
  - stale-gemini-generated-assets
  - missing-git-provenance
  - mandatory-validation-gates-failing
blocks: []
evidence_state: repair_required
---

# AgentKit Gemini CLI harness

## Executive summary

Add a native Gemini CLI adapter that exposes AgentKit skills, `/ak:*` commands,
and specialist subagents from a copy-ready project scaffold. Reuse the existing
`.agents/skills` registry to avoid a sixth skill mirror, and keep Gemini-specific
configuration free of UI, provider credentials, and Claude-only hooks.

This plan is being repaired after Advisor and Kongming review. The adapter design
is directionally accepted, but the local snapshot cannot currently prove release
readiness because the workspace is not a Git repository and `GEMINI.md` is missing
from the observed root even though the adapter validator requires it.

## Outcome

A user can copy `.gemini`, `.agents`, `.agentkit`, and `GEMINI.md` into a project,
trust/open that project with Gemini CLI, reload the catalogs, and invoke AgentKit
skills, `/ak:*` commands, and named agents using project-relative assets only.

## Completion definition

Completion for this plan means static Gemini adapter implementation plus
deterministic local validation are proven in the current project snapshot. It does
not claim authenticated Gemini provider execution, Git branch/diff provenance, or
independent child-agent review unless those checks are observed and recorded as
`PASS`.

Current status is `in-progress` because the repaired evidence boundary has open
gaps:

- `FAIL`: root `GEMINI.md` is missing in this local snapshot, but it is required by
  `engineer/.agentkit/scripts/validate-gemini-adapter.py`.
- `FAIL`: `D:\HealthCare_Project` is not a Git repository, so branch, diff, commit,
  and clean-worktree claims are not locally verifiable.
- `FAIL`: root `README.md` is missing, and `validate-project-assets.py` currently
  raises `FileNotFoundError` while reading it.
- `FAIL`: Gemini generated assets are stale according to
  `generate-gemini-adapter.py --check`.
- `NOT_RUN`: authenticated Gemini provider execution has not been observed.
- `NOT_RUN`: independent child-agent tester/reviewer was previously unavailable
  due local quota exhaustion.
- `BLOCKED`: Windows symlink capability was previously blocked by `EPERM`.

## Current blockers

| Blocker ID | Evidence | Required retest |
| --- | --- | --- |
| `missing-root-gemini-md` | `validate-gemini-adapter.py` raises `FileNotFoundError` for `GEMINI.md` | Restore/scope `GEMINI.md`, then run `python engineer/.agentkit/scripts/validate-gemini-adapter.py` |
| `missing-root-readme-md` | `validate-project-assets.py` raises `FileNotFoundError` for `README.md` | Add/scope `README.md`, then run `python engineer/.agentkit/scripts/validate-project-assets.py` |
| `stale-gemini-generated-assets` | `generate-gemini-adapter.py --check` reports generated Gemini agents and commands stale | Regenerate from canonical sources, then run `python engineer/.agentkit/scripts/generate-gemini-adapter.py --check` |
| `missing-git-provenance` | `git status --short --branch` fails because this root is not a Git repository | Use a real Git checkout or approved alternate provenance, then rerun Git status/diff gates |
| `mandatory-validation-gates-failing` | Mandatory static gates are failing or blocked by missing inputs | Rerun generator, Gemini validator, project-assets validator, install manifest, and Wukong gate to `PASS` |

## Requirements

1. Gemini CLI adapter assets must be project-relative and copy-ready.
2. Gemini must consume the shared `.agents/skills` registry; the adapter must not
   create or require `.gemini/skills`.
3. Every public AgentKit skill entrypoint except internal `ak:common` must have
   exactly one generated `.gemini/commands/ak/*.toml` command.
4. Every generated Gemini command must resolve to an existing skill entrypoint and
   forward user arguments with `{{args}}`.
5. Gemini specialist agents must be generated under `.gemini/agents/*.md` with
   Gemini-compatible Markdown frontmatter and inherited model/tool configuration.
6. `.gemini/settings.json` must remain minimal and must not contain provider
   credentials, UI overrides, hooks, model preferences, or host-specific paths.
7. Root `GEMINI.md` must document Gemini-specific project behavior and must not
   contradict `AGENTS.md` or `OPENCODE.md`.
8. The generator and validator must support repeatable check-mode validation so
   drift can be detected without rewriting files.
9. The documented minimal-copy scaffold must validate without relying on global
   user-specific Claude, Codex, Cursor, Gemini, or OpenCode assets.

## Non-goals

- Do not change ClaudeKit.
- Do not configure a Gemini provider, API key, theme, footer, or statusline.
- Do not port Claude/Codex hooks before an event-schema-specific design exists.
- Do not duplicate `.agents/skills` under `.gemini/skills`.
- Do not claim authenticated Gemini model execution without a valid local login.

## Architecture decisions

| Decision | Selected approach | Reason |
| --- | --- | --- |
| Skill registry | `.agents/skills` | Gemini CLI supports it as a workspace alias; avoids drift. |
| Commands | Generated `.gemini/commands/ak/*.toml` | Preserves the `/ak:*` namespace and binds each command to one skill. |
| Agents | Generated `.gemini/agents/*.md` | Uses Gemini-native frontmatter and inherited model/tool access. |
| Context | Root `GEMINI.md` | Gemini-native project rules without importing UI behavior. |
| Hooks | Disabled/omitted | Prevents accidental Claude-only schema or network side effects. |
| Portability | Project-relative paths only | Makes the scaffold copy-ready across machines and project roots. |

## Source control caveat

This local workspace was observed as not being a Git repository:

```text
git status --short --branch
fatal: not a git repository (or any of the parent directories): .git
```

Any branch name, commit identity, diff-base, clean worktree, or rollback-by-revert
claim must be treated as unverified until the work is placed in a real Git
checkout or another durable provenance mechanism is supplied.

## Authority and ownership

- Canonical skills remain `engineer/skills`; `.agents/skills` remains the shared
  runtime mirror consumed by Gemini.
- The Gemini adapter generator owns `.gemini/commands/ak` and
  `.gemini/agents`.
- The Gemini validator owns structural, path, command, agent, and copy-smoke
  checks.
- Root docs own installation and runtime guidance. `README.md` and `GEMINI.md`
  are both absent in the observed snapshot and must be restored or deliberately
  scoped before completion.

## Success criteria

- Exactly one Gemini command exists for all 102 public AgentKit skill entrypoints;
  the only excluded entrypoint is the internal `ak:common` helper.
- Every command resolves an existing workspace skill and forwards `{{args}}`.
- All 17 AgentKit specialist agents have valid Gemini Markdown definitions.
- No Gemini asset contains a host-specific absolute path, provider secret, UI
  override, or Claude-only hook command.
- A temporary copy containing only the documented scaffold passes the adapter
  validator.
- Existing deterministic AgentKit project, manifest, cross-reference, and Wukong
  gates pass. Environmental gaps are reported separately as `BLOCKED` or
  `NOT_RUN` and are not counted as passing evidence.

## Evidence and stop conditions

- Authoritative local evidence: generator check, Gemini adapter validator,
  project-assets validator, install-manifest check, path/secret scan, and Git
  checks only when running inside a real Git worktree.
- Gemini CLI catalog parsing is required when the installed CLI can run without
  provider dispatch. Authenticated model execution is reported as `NOT_RUN` if
  local credentials reject the request.
- Stop on source/mirror drift, absolute-path leakage, command/skill count drift,
  malformed agent frontmatter, missing root `GEMINI.md`, generated asset drift,
  or changes outside the planned scope.

## Verification matrix

| Gate | Command or evidence | Expected result | Current state |
| --- | --- | --- | --- |
| Project instructions | Read `AGENTS.md`, `OPENCODE.md`, `README.md` when present | Applicable instructions known | `PASS` for `AGENTS.md`/`OPENCODE.md`; `FAIL` for missing root `README.md` |
| AgentKit config | Read `.agentkit/config.yaml` | `coding_level: 4`, `paths.plans: plans`, artifact gate enabled | `PASS` |
| Git provenance | `git status --short --branch` | Real branch and worktree state | `FAIL`: not a Git repository |
| Gemini generator parity | `python engineer/.agentkit/scripts/generate-gemini-adapter.py --check` | No generated command/agent drift | `FAIL`: generated agents and commands reported stale |
| Gemini adapter validation | `python engineer/.agentkit/scripts/validate-gemini-adapter.py` | Valid commands, agents, settings, copy-smoke fixture | `FAIL`: `FileNotFoundError` for missing `GEMINI.md` |
| Project asset validation | `python engineer/.agentkit/scripts/validate-project-assets.py` | Project assets valid | `FAIL`: `FileNotFoundError` for missing `README.md` |
| Install manifest validation | `python engineer/.agentkit/scripts/generate-install-manifest.py --check` | Manifest valid | `PASS`: `install-manifest.json is valid (1492 files).` |
| Wukong combined gate | `python engineer/.agentkit/scripts/run-wukong-gate.py --json` | `PASS` or explicit separate blocked capabilities | `NOT_RUN` in repaired pass |
| Secret/path scan | Search Gemini assets/docs/manifests for credentials and host paths | No secrets, no host-specific paths | `NOT_RUN` in repaired pass |
| Git whitespace gate | `git diff --check` | No whitespace errors | `NOT_RUN`: requires Git worktree |
| Gemini CLI catalog parse | CLI smoke that does not require provider dispatch | Catalog loads generated commands/agents | `NOT_RUN` |
| Authenticated Gemini execution | Authenticated Gemini CLI smoke | Trivial `/ak:*` invocation reaches provider | `NOT_RUN` |
| Independent review | Advisor/Kongming plus tester/reviewer when quota is available | Plan/implementation reviewed on frozen snapshot | `PASS` for Advisor/Kongming plan review; child-agent tester/reviewer `NOT_RUN` |

## Risks and mitigations

| Risk | Impact | Mitigation | Residual state |
| --- | --- | --- | --- |
| Root `GEMINI.md` is absent | Validator and generated agents cannot prove copy-ready contract | Restore `GEMINI.md` or update scope/validator before completion | `FAIL` |
| Root `README.md` is absent | Project-assets validator cannot complete and setup guidance is missing | Add project README or repair validator scope if README is intentionally optional | `FAIL` |
| Local root is not a Git repo | Branch, diff, rollback, and clean-worktree evidence cannot be audited | Use a real Git checkout or record alternate provenance before implementation/release | `FAIL` |
| Generated commands drift from `.agents/skills` | `/ak:*` commands target stale or missing skills | Regenerate from canonical sources and require generator `--check` in every adapter gate | `FAIL` |
| `.gemini/skills` is added later | Duplicate registry causes namespace drift | Keep as non-goal and validator failure | Controlled by validator when run |
| Gemini settings gain provider/UI/hook config | Secrets or non-portable preferences enter repo | Keep settings minimal; validate and scan | `NOT_RUN` |
| Static checks pass but Gemini runtime differs | Catalog may fail in real Gemini CLI | Add catalog parse smoke when CLI is available | `NOT_RUN` |
| Authenticated provider unavailable | Live Gemini execution cannot be claimed | Mark `NOT_RUN`; do not block static adapter unless live behavior is the acceptance target | Accepted limitation |
| Windows symlink creation blocked | Portability coverage is incomplete on Windows | Use non-symlink fixture or document `EPERM` as blocked capability | `BLOCKED` |
| Child-agent quota unavailable | Independent tester/reviewer evidence missing | Treat manual review as fallback, not equivalent proof | `NOT_RUN` |

## Rollback and recovery

Rollback is file-removal plus manifest regeneration; no data migration or external
service rollback is expected.

Remove only Gemini adapter-owned files when reverting this plan's implementation:

- `.gemini/commands/ak/**`
- `.gemini/agents/**`
- `.gemini/settings.json`, if introduced solely for this adapter
- `GEMINI.md`, if introduced solely for this adapter
- `engineer/.agentkit/scripts/generate-gemini-adapter.py`
- `engineer/.agentkit/scripts/validate-gemini-adapter.py`
- Gemini-specific documentation additions
- Gemini entries in generated install/copy manifests
- `plans/20260815-1600-gemini-harness/`, only if reverting the plan itself

Do not remove `.agents/skills/**`, `.agentkit/config.yaml`, `AGENTS.md`,
`OPENCODE.md`, Claude/Codex/Cursor/OpenCode adapter assets, or user-global tool
configuration.

After rollback, rerun project-assets validation, install-manifest validation, and
Git checks in a real Git worktree. In this local non-git snapshot, rollback is
procedural rather than mechanically proven.

## Advisor and Kongming gate

Advisor verdict: repair the plan into a durable AgentKit handoff by adding
requirements, provenance, gate matrix, risk, rollback, and honest evidence-state
separation. Do not count `BLOCKED` or `NOT_RUN` as pass.

Kongming verdict: `REPAIR_THEN_RETEST`. Plan repair is approved in place, but
downstream implementation, shipping, or completion claims are blocked until the
plan schema and verification gates are repaired and rerun.

Wukong shadow-review verdict: `FALSIFIED`, gate `REPAIR_THEN_RETEST`. Wukong
found a phase handoff loophole that allowed mandatory `FAIL` states to be
accepted as `BLOCKED`/`NOT_RUN`, plus missing machine-readable `blockedBy`
entries. This plan now encodes blocker IDs in frontmatter and requires mandatory
static failures to be resolved and rerun to `PASS` before downstream handoff.

## Completion evidence

Historical claims from the prior plan snapshot are preserved below but must not
be treated as current local proof until rerun in this workspace or tied to a real
Git commit/archive identity:

- Claimed: Gemini generator check produced 102 commands and 17 agents with no
  drift.
- Claimed: Gemini adapter validator saw 103 skill entrypoints, 102 public
  commands, 17 agents, and a valid minimal-copy smoke test.
- Claimed: project-assets validator and a 1,490-file install manifest were valid.
- Claimed: combined Wukong/adapter gate returned `PASS_WITH_BLOCKED_CAPABILITY`.
- `BLOCKED`: Windows symlink creation failed with `EPERM`.
- `NOT_RUN`: authenticated Gemini provider execution.
- `NOT_RUN`: independent child-agent tester/reviewer because local subagent quota
  was exhausted.

The repaired plan requires fresh evidence before this section can be promoted to
current completion evidence.

## Deferred follow-up work

- Restore or deliberately replace root `GEMINI.md`, then rerun Gemini validator.
- Add or deliberately scope root `README.md`, then rerun project-assets validator.
- Regenerate stale Gemini generated assets from canonical sources, then rerun the
  generator in `--check` mode.
- Decide whether to initialize Git locally or work from a real clone before making
  implementation/release claims.
- Run generator, validator, project-assets, install-manifest, and Wukong gates and
  paste summarized `PASS`/`FAIL`/`BLOCKED`/`NOT_RUN` results here.
- Run Gemini CLI catalog parse when available without provider dispatch.
- Run authenticated Gemini provider smoke only when local credentials are valid.
- Re-run independent tester/reviewer when subagent quota is available.
- Resolve or explicitly accept the Windows symlink `EPERM` portability gap.

## Phase index

- [Phase 01 — Implement and validate the Gemini adapter](./phase-01-gemini-adapter.md)
