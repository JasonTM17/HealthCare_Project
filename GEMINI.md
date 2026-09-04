# AgentKit Instructions for Gemini CLI

This file provides the project-level contract and operating instructions for
Gemini CLI and Gemini agent runtimes in this workspace.

## AgentKit Runtime Integration

- **Skill Registry**: Gemini CLI consumes `.agents/skills/` directly as its workspace
  skill registry. Do not create a duplicate `.gemini/skills/` directory.
- **Commands**: Slash commands are located in `.gemini/commands/ak/*.toml` projecting
  to `/ak:<skill-name>`.
- **Specialist Agents**: Specialist agent definitions are located in
  `.gemini/agents/*.md`.
- **Configuration**: Project configuration is in `.gemini/settings.json`.
- **Plans**: Canonical plans reside in `plans/<timestamp>-<slug>/plan.md`. Use
  `node .agentkit/scripts/set-active-plan.cjs <plan-dir>` to validate plans.

## Workflow & Engineering Contract

1. **Search Before Editing**: Inspect existing components, styles, and tests before
   making changes.
2. **Project-Relative Paths**: All paths must be project-relative. Never embed
   developer-specific or host-specific absolute paths.
3. **Focused Changes**: Make the smallest coherent change that satisfies requirements.
   Preserve unrelated dirty and untracked work.
4. **Verification Discipline**: Run actual test suites and build gates. Never weaken
   or skip an existing test to make a suite pass.
5. **Truthful Evidence**: Report execution results with strict evidence labels:
   `PASS`, `FAIL`, `BLOCKED`, or `NOT_RUN`.
