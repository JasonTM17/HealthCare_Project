---
phase: 1
title: "Implement and validate the Gemini adapter"
status: in-progress
priority: P1
effort: large
dependencies: []
evidence_state:
  plan_schema: pass
  root_gemini_doc: fail
  root_readme: fail
  git_provenance: fail
  generator_check: fail
  adapter_validator: fail
  project_assets: fail
  install_manifest: pass
  wukong_gate: not_run
  provider_execution: not_run
  child_agent_review: not_run
  windows_symlink_probe: blocked
---

# Phase 1: Implement and validate the Gemini adapter

## Overview

Create a generated, copy-ready Gemini CLI adapter and prove static/catalog
integrity without changing other AgentKit runtime behavior. The phase remains
`in-progress` until the missing `GEMINI.md`, missing `README.md`, stale generated
assets, non-git provenance gap, and required validation gates are resolved or
explicitly accepted as blocked/non-goals.

## Requirements

- **Functional**: Generate one Gemini TOML command for every public AgentKit skill
  entrypoint except internal `ak:common`.
- **Functional**: Generate Gemini specialist agent Markdown definitions for the
  expected 17 AgentKit subagents.
- **Functional**: Keep Gemini commands and agents pointed at the shared
  `.agents/skills/**/SKILL.md` registry.
- **Functional**: Provide root `GEMINI.md` and minimal `.gemini/settings.json` as
  copy-ready Gemini project assets.
- **Functional**: Validate a minimal copied scaffold without depending on global
  user-specific assets.
- **Non-functional**: Generated assets must be deterministic and fail `--check`
  when stale.
- **Non-functional**: Gemini assets must be credential-free, UI-setting-free,
  hook-free, and free of host-specific absolute paths.
- **Non-functional**: Verification results must use `PASS`, `FAIL`, `BLOCKED`, and
  `NOT_RUN`; blocked or unrun gates must not be counted as pass.

## Architecture

Gemini uses a thin adapter over the existing AgentKit registry:

```text
engineer/skills/**
  -> .agents/skills/**                 shared runtime skill registry
  -> generate-gemini-adapter.py
  -> .gemini/commands/ak/*.toml        generated /ak:* command projections
  -> .gemini/agents/*.md               generated specialist agent projections

GEMINI.md + .gemini/settings.json      Gemini-native root context and toggles
validate-gemini-adapter.py             structural, portability, and copy-smoke gate
run-wukong-gate.py                     combined high-risk adapter and contract gate
install-manifest.json                  distributable file identity evidence
```

The adapter must not own `.agents/skills` and must not introduce `.gemini/skills`.
The generator owns generated Gemini command/agent outputs. The validator owns
structural checks, path/setting safety, missing asset detection, and minimal-copy
smoke behavior. Runtime authentication remains user-local and outside repository
configuration.

## Related Code Files

- **Create/restore**: `GEMINI.md`
- **Modify**: `engineer/.agentkit/scripts/generate-gemini-adapter.py`
- **Modify**: `engineer/.agentkit/scripts/validate-gemini-adapter.py`
- **Modify**: `engineer/.agentkit/scripts/run-wukong-gate.py`, if the combined
  gate needs updated Gemini coverage labels
- **Modify**: `engineer/.agentkit/scripts/generate-install-manifest.py`, only if
  manifest semantics need adjustment
- **Modify**: `engineer/.agentkit/install-manifest.json`
- **Modify**: `.gemini/commands/ak/*.toml`, generated only
- **Modify**: `.gemini/agents/*.md`, generated only
- **Modify**: `.gemini/settings.json`
- **Modify**: `AGENTS.md`, `OPENCODE.md`, or `docs/PROJECT_PLAN.md` only when
  project guidance changes
- **Delete**: `.gemini/skills/**`, if it appears, because it violates the adapter
  contract

## Implementation Steps

1. Restore or author root `GEMINI.md` with Gemini-specific project behavior,
   project-relative paths, and no provider/UI/hook settings.
2. Confirm `.gemini/settings.json` contains only the approved skills/agents
   toggles expected by `validate-gemini-adapter.py`.
3. Run the Gemini generator in check mode. If drift exists, update the canonical
   generator inputs first, regenerate `.gemini/commands/ak/*.toml` and
   `.gemini/agents/*.md`, then rerun check mode.
4. Run the Gemini adapter validator and repair missing assets, command targets,
   agent frontmatter, path portability, or copy-smoke failures.
5. Run project-assets validation and install-manifest validation. Regenerate the
   manifest only after confirming the intended file set.
6. Run the Wukong combined gate and decompose any `PASS_WITH_BLOCKED_CAPABILITY`
   into separate `PASS`, `BLOCKED`, or `NOT_RUN` rows in `plan.md`.
7. Run secret/path scans over `.gemini/**`, `GEMINI.md`, docs, and generated
   manifests before any release handoff.
8. Establish Git provenance before downstream implementation or release claims:
   initialize/clone a real repository or record a non-git snapshot identity and
   rollback mechanism.
9. Run Gemini CLI catalog parsing when the CLI can load catalogs without provider
   dispatch. Run authenticated provider smoke only when local credentials are
   valid.
10. Re-run independent tester/reviewer when subagent quota is available, or mark
    it `NOT_RUN` and keep Advisor/Kongming review as plan-level evidence only.

## Success Criteria

- [ ] Root `GEMINI.md` exists and passes validator safety checks.
- [ ] `python engineer/.agentkit/scripts/generate-gemini-adapter.py --check`
  reports no generated command/agent drift.
- [ ] `python engineer/.agentkit/scripts/validate-gemini-adapter.py` reports a
  valid adapter with expected command, skill, agent, settings, and copy-smoke
  counts.
- [ ] No `.gemini/skills` mirror exists.
- [ ] No Gemini asset contains credentials, provider config, UI overrides, hook
  commands, or host-specific absolute paths.
- [ ] Project-assets validation passes.
- [ ] Install manifest validation passes and the manifest reflects only intended
  adapter changes.
- [ ] Wukong combined gate passes, or every blocked capability is separately
  recorded with impact and acceptance decision.
- [ ] Git provenance is established before any branch/diff/commit/release claim.
- [ ] Authenticated Gemini provider execution is either observed as `PASS` or
  explicitly recorded as `NOT_RUN` without live-runtime claims.

## Risk Assessment

- **Risk**: Missing root `GEMINI.md` invalidates copy-ready adapter claims.
  **Mitigation**: Restore the file and require validator pass before completion.
  **Rollback/recovery**: If Gemini root docs are intentionally out of scope,
  update validator/plan requirements before claiming completion.
- **Risk**: Missing root `README.md` prevents project-assets validation and leaves
  setup guidance incomplete. **Mitigation**: add root README or update the project
  validator if README is intentionally optional. **Rollback/recovery**: keep the
  project-assets gate failed until one of those paths is completed.
- **Risk**: Generated Gemini commands and agents are stale. **Mitigation**:
  regenerate from canonical sources, then rerun generator `--check` and validator.
  **Rollback/recovery**: remove generated Gemini outputs if the adapter cannot be
  brought back to parity.
- **Evidence**: `python engineer/.agentkit/scripts/generate-install-manifest.py --check`
  currently passes with `install-manifest.json is valid (1492 files).`
- **Risk**: Non-git workspace hides unrelated changes and prevents branch/diff
  audit. **Mitigation**: use a real Git checkout before implementation/release.
  **Rollback/recovery**: rely only on procedural file removal until Git exists.
- **Risk**: Generated assets drift from `.agents/skills`. **Mitigation**: make
  generator `--check` and validator mandatory gates. **Rollback/recovery**:
  regenerate from canonical sources or remove the generated Gemini outputs.
- **Risk**: Credentials or personal UI settings enter `.gemini/settings.json`.
  **Mitigation**: keep strict validator checks and scan generated assets.
  **Rollback/recovery**: remove unsafe settings and rerun validator/scan.
- **Risk**: Static validation passes but real Gemini CLI behavior fails.
  **Mitigation**: add catalog parse smoke when available. **Rollback/recovery**:
  keep runtime compatibility `NOT_RUN` until observed.
- **Risk**: Windows symlink behavior is blocked by `EPERM`. **Mitigation**: use a
  non-symlink copy fixture or explicitly document the blocked capability.
  **Rollback/recovery**: avoid symlink-dependent install behavior on Windows.

## Evidence and Handoff

- **Required gate**: `python engineer/.agentkit/scripts/generate-gemini-adapter.py --check`
- **Required gate**: `python engineer/.agentkit/scripts/validate-gemini-adapter.py`
- **Required gate**: `python engineer/.agentkit/scripts/validate-project-assets.py`
- **Required gate**: `python engineer/.agentkit/scripts/generate-install-manifest.py --check`
- **Required gate**: `python engineer/.agentkit/scripts/run-wukong-gate.py --json`
- **Required gate**: Git status/diff gates only after a real Git worktree exists
- **Owner**: integration owner for Gemini adapter files and manifest regeneration
- **Next phase dependency**: no downstream implementation, completion, ship, or
  release handoff until missing `GEMINI.md`, missing `README.md`, stale Gemini
  generated assets, non-git provenance, and mandatory static validation gates are
  resolved and rerun to `PASS`. `BLOCKED`/`NOT_RUN` may be recorded only as
  residual limitations for non-mandatory live/provider/capability checks; they do
  not satisfy mandatory static gates.
