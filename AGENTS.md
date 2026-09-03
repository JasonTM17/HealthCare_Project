# AgentKit project instructions

This file is the portable, runtime-neutral operating contract for projects that
install AgentKit. It applies to Codex, Claude Code, Cursor, Gemini CLI,
OpenCode, and compatible agent runtimes. AgentKit commands use the `/ak:`
namespace; do not rewrite them into another kit's command namespace.

## Read order

1. Read the project `README.md` and the nearest nested `AGENTS.md` before work.
2. Inspect `.agentkit/config.yaml` when present. Honor `coding_level`, `paths`,
   `workflow_artifact_gate`, and every explicit project override.
3. Inspect repository state, package/runtime metadata, and relevant tests.
4. Select the smallest AgentKit workflow that covers the request.
5. Load each selected skill's complete `SKILL.md` before following it.

Project or user instructions override this file. A nested `AGENTS.md` overrides
it only for files below that directory.

## Registry and portability rules

- Canonical kit development source: `engineer/skills/`.
- Runtime mirrors: `.codex/skills/`, `.claude/skills/`, `.cursor/skills/`, and
  `.agents/skills/`. Gemini CLI consumes `.agents/skills/` directly as its
  supported workspace alias; do not add a duplicate `.gemini/skills/` mirror.
- Gemini adapter assets are `.gemini/commands/ak/`, `.gemini/agents/`,
  `.gemini/settings.json`, and root `GEMINI.md`. Keep them project-relative and
  free of provider credentials, UI overrides, and Claude-only hooks.
- OpenCode also consumes `.agents/skills/` natively and exposes every skill as
  an `/ak:<name>` command, so its adapter ships only `.opencode/agents/`,
  `.opencode/opencode.json`, and root `OPENCODE.md`. Do not add a
  `.opencode/skills` mirror or per-skill `.opencode/commands` files; either
  would duplicate the `/ak:` namespace.
- Use only the registry selected by the current runtime. Never load two mirror
  trees for the same task; duplicate registries cause duplicate skill entries.
- In an installed project, prefer the project-local registry over a global
  fallback. A global skill must not silently shadow a reviewed project skill.
- Skill command `/ak:name` normally maps to folder `ak-name`. Office skills are
  routed by `/ak:document-skills` to nested `/ak:docx`, `/ak:pdf`, `/ak:pptx`,
  or `/ak:xlsx`.
- Resolve paths from the current project root or the selected skill directory.
  Never embed a developer-specific drive, username, download path, or home path.
- Do not copy `.venv`, caches, credentials, auth files, or generated reports to
  another machine. Recreate runtime dependencies at the destination.
- If the project-local skill cannot be found, report the exact searched paths
  and enter degraded mode; do not pretend the skill ran.

## Default AgentKit workflow

Use this sequence for material engineering work:

1. `/ak:goal-warmup` for a large or long-running objective.
2. `/ak:advise` when intent, product trade-offs, architecture, or scope is
   ambiguous. Advice is a decision artifact, not implementation.
3. `/ak:scout` to collect codebase evidence and affected boundaries.
4. `/ak:plan` or `/ak:issue-to-plan` to produce an executable plan and Outcome
   Contract. Do not implement in `issue-to-plan`.
5. `/ak:worktree`, `/ak:orchestrate`, or `/ak:team` only when ownership can be
   split into independent bounded work.
6. `/ak:cook`, `/ak:fix`, `/ak:vibe`, or the relevant domain skill to implement.
7. `/ak:test` plus domain-specific checks.
8. `/ak:code-review`; use `/ak:wukong` for a high-risk or difficult claim that
   needs adversarial falsification.
9. `/ak:ship` only after required evidence and review gates pass.
10. `/ak:journal` or `/ak:handoff` when durable continuation context is useful.

This is routing guidance, not permission to widen scope. Read-only questions do
not authorize edits, commits, pushes, deployment, or external messages.

## Fast routing

| Intent | Preferred route |
| --- | --- |
| Explain or answer architecture | `/ak:ask`, optionally `/ak:advise` |
| Locate code quickly | `/ak:scout` |
| Semantic symbol/impact analysis | `/ak:gkg` or `/ak:graphify` |
| Reproduce and diagnose a bug | `/ak:scout` -> `/ak:debug` |
| Repair a bounded bug | `/ak:debug` -> `/ak:fix` -> `/ak:test` |
| Hard intermittent/security/concurrency claim | `/ak:debug` -> `/ak:wukong` -> fix -> independent retest |
| New feature from issue | `/ak:issue-to-plan` -> `/ak:plan` -> `/ak:cook` |
| End-to-end feature to PR-ready | `/ak:vibe` |
| Multi-agent coding | `/ak:orchestrate` or `/ak:team` |
| Parallel isolated branches | `/ak:worktree` |
| Backend/API | `/ak:backend-development` |
| Database/schema/query | `/ak:databases` |
| Auth | `/ak:better-auth` plus `/ak:security` |
| Frontend implementation | `/ak:frontend-development` |
| UI replication/design | `/ak:frontend-design`, `/ak:ui-styling`, `/ak:ui-ux-pro-max` |
| Browser test | `/ak:web-testing` or `/ak:agent-browser` |
| Logged-in Chrome state | `/ak:chrome-profile` |
| CI/deployment | `/ak:devops` or `/ak:deploy` |
| Security review | `/ak:security` and `/ak:security-scan` |
| Documentation | `/ak:docs` or `/ak:docs-seeker` |
| Office documents | `/ak:document-skills` |
| Unknown capability | `/ak:find-skills` or `/ak:agentkit` |

Do not activate every listed skill. Use the minimum set needed for the task and
state the selected workflow in progress updates.

## Specialized review agents

### Advisor

Advisor clarifies outcomes, trade-offs, constraints, non-goals, and decision
criteria. Use Advisor before building when a decision could materially change
scope. Advisor must not be treated as proof that implementation is correct.

### Kongming

Kongming reviews architecture, sequencing, capability boundaries, failure
containment, and release strategy. For high-risk work, ask Kongming to review a
frozen exact snapshot independently and read-only.

### Wukong

Wukong is an adversarial investigator, not a general implementer or release
authority. Give it a falsifiable claim, target identity, invariants, authority,
budget, and evidence boundary. It returns `FALSIFIED`, `NOT_FALSIFIED`,
`INCONCLUSIVE`, or `UNDERDEFINED` with an explicit gate and handoff.

Use Wukong especially for concurrency races, distributed state, migrations,
tenant/auth isolation, quota/accounting ledgers, recovery, portability, encoded
boundaries, and model/tool authority. High or critical findings require a fresh
independent confirmation before acceptance. Wukong never self-approves a fix.

## Planning contract

Store durable plans under `plans/` using the closest template in
`plans/templates/`. AgentKit's canonical shape is a directory
`plans/<timestamp>-<slug>/` containing `plan.md` and at least one
`phase-NN-*.md`; add more phases plus `reports/`, `research/`, and `assets/`
when the work needs them. If
`.agentkit/scripts/set-active-plan.cjs` exists, pass that plan directory (or its
`plan.md`) to select the active plan; otherwise link the active plan from the
project tracker without creating a machine-specific path.

The reviewed Codex and Claude hook packages can persist session-bound plan
state when they provide a valid runtime marker and `CK_SESSION_ID`. The current
Cursor compatibility adapter has no reviewed session-state marker, so active
plan selection there is validation-only; do not claim persistence until a
Cursor state bridge is installed and tested.

Every material plan must include:

- outcome and success signal;
- scope, non-goals, and authority;
- current evidence and assumptions;
- affected components and ownership;
- ordered implementation stages;
- acceptance criteria and exact verification commands;
- risks, rollback, and recovery;
- documentation/release impact;
- unresolved decisions and explicit blockers.

For AgentKit `plan.md` frontmatter, use `pending`, `in-progress`, `completed`,
or `cancelled`. Live task APIs may instead require their own enum such as
`pending`, `in_progress`, `completed`; do not copy one schema into the other.
Completion means current evidence proves the acceptance criteria; intent, a
green narrow test, or a worker's report alone is insufficient. Represent a
blocked plan through `blockedBy`, its dependency graph, and an explicit blocker
section rather than inventing an unsupported plan status.

## Implementation rules

- Search before editing. Prefer existing modules, conventions, helpers, and
  generated-file workflows.
- Make the smallest coherent change that satisfies the full requested outcome.
- Preserve unrelated dirty and untracked work. Stage only explicit intended
  paths; never reset, clean, or overwrite broadly.
- Do not modify global skills or user configuration unless explicitly asked.
- Prefer portable paths and structured argv. Avoid shell string composition,
  implicit current-working-directory assumptions, and platform-only quoting.
- On Windows and PowerShell, use PowerShell-native log slicing and line
  limiting (`Select-Object -Last`, `Get-Content -Tail`) instead of Unix-only
  `tail` or `head` in shell pipelines.
- Treat generated manifests and mirrors as derived artifacts. Update canonical
  source first, synchronize all required mirrors, then regenerate manifests.
- Never weaken a gate or change an oracle merely to make a failing test green.
- Do not expose secrets, credentials, raw auth/provider errors, absolute home
  paths, or private oracle content in logs and committed evidence.
- If a file becomes difficult to reason about, modularize at a stable boundary;
  do not split code mechanically just to satisfy a line-count preference.

## Multi-agent ownership

- Give each writer a disjoint file set or isolated worktree and a concrete
  deliverable.
- One integration owner controls shared state, merges, manifests, and releases.
- Reviewers remain read-only and identify the exact base/HEAD/scope they saw.
- A review becomes stale when the reviewed snapshot changes. Freeze, rerun, and
  record a new identity before accepting it.
- Workers do not merge, push, or mutate another worktree unless explicitly
  authorized.
- Report `PASS`, `FAIL`, `BLOCKED_CAPABILITY`, or `NOT_RUN`; never translate an
  unobserved environment into a pass.

## Verification discipline

Verify in proportion to risk:

1. syntax/static checks for changed files;
2. focused regression tests for the changed behavior;
3. package/integration tests for affected boundaries;
4. manifest, mirror, generated-artifact, and `git diff --check` gates;
5. cross-platform/runtime matrix when portability is claimed;
6. independent Advisor/Kongming review for high-risk release claims;
7. authenticated provider or live-service evidence only when the environment
   actually supplies it.

Record the command, result, environment, and important limitation. Unit tests do
not prove live provider routing, OS isolation, deployment, Redis/Postgres, or
macOS behavior. A CI workflow definition is not evidence that CI ran.

For bug fixes, include a regression that fails on the old behavior and passes on
the new behavior. For concurrency or recovery, test a deterministic schedule or
fault point. For security boundaries, add a negative/abuse case. For portable
hooks, cover spaces, Unicode, quoting, parent traversal, symlinks, and the actual
runtime family.

## Git and release

- Inspect `git status`, branch, remotes, and relevant history first.
- New branches use concise intent-based names such as `feature/...`, `fix/...`,
  or `release/...`; never prefix them with `codex/`.
- Use Conventional Commits that describe the intent. Preserve an existing
  branch/PR name unless asked to rename it.
- Run `git diff --check`, targeted tests, manifest/parity validation, and a
  secret scan before commit.
- For Gemini adapter changes, also run
  `generate-gemini-adapter.py --check` and `validate-gemini-adapter.py`; an auth
  failure is `NOT_RUN` for live Gemini execution, not a static adapter failure.
- A local commit is not a push, a push is not a passing CI run, and passing CI is
  not production verification. State each boundary honestly.
- Use force-with-lease only when history rewrite was explicitly authorized.

## Documentation and handoff

Update documentation when behavior, setup, architecture, commands, contracts,
or operator expectations change. Prefer links and exact paths over duplicated
large excerpts. Keep examples portable and redact host identities.

A final handoff states:

- outcome and files changed;
- tests/gates actually observed;
- commit/push/CI state;
- unresolved risk or external blocker;
- the next safe action, if any.

Do not call a kit, agent, feature, or release fully production-ready when the
required live, cross-platform, isolation, provenance, or rollback evidence has
not been observed.
