#!/usr/bin/env python3
"""Generate the project-local Gemini CLI command and subagent adapter."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SKILLS_ROOT = ROOT / ".agents" / "skills"
COMMANDS_ROOT = ROOT / ".gemini" / "commands" / "ak"
AGENTS_ROOT = ROOT / ".gemini" / "agents"


@dataclass(frozen=True)
class GeminiAgent:
    name: str
    description: str
    skills: tuple[str, ...]
    role: str
    temperature: float = 0.2
    max_turns: int = 30
    timeout_mins: int = 20


AGENTS = (
    GeminiAgent("advisor", "Interview-driven technical advisor for ambiguous requirements and high-impact decisions.", ("ak-advise",), "Remain advisory-only. Clarify the outcome, alternatives, trade-offs, risks, and success measures; do not implement."),
    GeminiAgent("brainstormer", "Explores viable approaches and turns unclear intent into an accepted outcome.", ("ak-brainstorm",), "Generate distinct options, challenge assumptions, and converge on a recommendation before implementation."),
    GeminiAgent("code-reviewer", "Independent evidence-based reviewer for changes, commits, and pull requests.", ("ak-code-review",), "Review only. Prioritize correctness, security, regression risk, and missing evidence. Do not silently repair findings."),
    GeminiAgent("code-simplifier", "Simplifies code while preserving observable behavior and public contracts.", ("ak-cook", "ak-code-review"), "Make only bounded simplifications requested by the controller. Preserve behavior and prove equivalence with focused tests."),
    GeminiAgent("debugger", "Root-cause debugger for failures, flaky tests, and unexpected behavior.", ("ak-debug",), "Reproduce first, separate symptoms from cause, minimize the counterexample, and only then propose or apply a bounded fix."),
    GeminiAgent("docs-manager", "Maintains accurate project documentation from repository evidence.", ("ak-docs",), "Keep documentation truthful, concise, linked to authoritative files, and explicit about NOT_RUN or unverified behavior."),
    GeminiAgent("explore", "Fast read-only codebase explorer for scoped architecture and dependency questions.", ("ak-scout",), "Explore read-only and return paths, symbols, relationships, and uncertainties. Do not edit files."),
    GeminiAgent("fullstack-developer", "Implements bounded frontend, backend, and integration work with verification.", ("ak-cook", "ak-frontend-development", "ak-backend-development"), "Own only the assigned files and outcome. Follow existing architecture, test proportionally, and report residual limits."),
    GeminiAgent("git-manager", "Handles focused Git operations, Conventional Commits, branches, and remote verification.", ("ak-git",), "Preserve unrelated work, stage explicit paths, avoid destructive Git commands, and verify the exact remote commit after push."),
    GeminiAgent("journal-writer", "Writes chronological technical journals and evidence-based session summaries.", ("ak-journal",), "Record decisions, evidence, unresolved risks, and change chronology without inventing events or results."),
    GeminiAgent("kongming", "Strategic architecture and release-gate reviewer focused on sequencing and failure containment.", ("ak-predict", "ak-code-review"), "Act independently. Attack assumptions, ownership, handoffs, rollback, and evidence boundaries; return ACCEPT or REPAIR_THEN_RETEST."),
    GeminiAgent("planner", "Creates AgentKit file-first implementation plans and phase roadmaps.", ("ak-plan",), "Plan only unless explicitly authorized to implement. Include outcome, non-goals, authority, evidence, phases, stop conditions, and rollback."),
    GeminiAgent("project-manager", "Tracks plan progress, ownership, blockers, and cross-session delivery evidence.", ("ak-project-management",), "Keep canonical plan artifacts synchronized and distinguish reported progress from independently verified completion."),
    GeminiAgent("researcher", "Researches technical options using primary sources and repository evidence.", ("ak-research",), "Research only. Cite primary sources, distinguish fact from inference, and do not implement."),
    GeminiAgent("tester", "Designs and executes focused unit, integration, end-to-end, and regression tests.", ("ak-test",), "Test independently. Reproduce failures, preserve raw evidence, and never convert BLOCKED or NOT_RUN into PASS."),
    GeminiAgent("ui-ux-designer", "Designs and reviews polished, accessible product interfaces.", ("ak-frontend-design", "ak-ui-ux-pro-max"), "Ground design decisions in the product context, accessibility, responsive states, and executable implementation constraints."),
    GeminiAgent("wukong", "Adversarial falsification specialist for complex claims and minimized counterexamples.", ("ak-wukong",), "Stay read-only unless a report path is explicitly authorized. Seek the smallest decisive counterexample and never serve as implementation acceptance alone.", 0.1, 40, 30),
)


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"missing YAML frontmatter: {path.relative_to(ROOT)}")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError(f"unterminated YAML frontmatter: {path.relative_to(ROOT)}")
    result: dict[str, str] = {}
    for line in text[4:end].splitlines():
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*?)\s*$", line)
        if match:
            result[match.group(1)] = match.group(2).strip("\"'")
    return result


def public_skills() -> list[tuple[str, Path]]:
    skills: list[tuple[str, Path]] = []
    for skill_file in sorted(SKILLS_ROOT.rglob("SKILL.md")):
        metadata = parse_frontmatter(skill_file)
        name = metadata.get("name", "")
        if not re.fullmatch(r"ak:[a-z0-9][a-z0-9-]*", name):
            raise ValueError(f"invalid AgentKit skill name {name!r}: {skill_file.relative_to(ROOT)}")
        if name == "ak:common":
            continue
        skills.append((name, skill_file))
    names = [name for name, _ in skills]
    if len(names) != len(set(names)):
        raise ValueError("duplicate AgentKit skill names")
    return sorted(skills)


def toml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def command_bytes(name: str, skill_file: Path) -> bytes:
    short_name = name.removeprefix("ak:")
    relative_skill = skill_file.relative_to(ROOT).as_posix()
    description = f"Run AgentKit skill {name}."
    prompt = f'''You are executing AgentKit command `/{name}` inside Gemini CLI.

The authoritative workspace skill is injected below. Follow it exactly, including
its safety boundaries, required planning, validation, and truthful evidence rules.
If it delegates to another AgentKit skill, load that skill from `.agents/skills`.
Do not replace AgentKit workflow names with Gemini-specific alternatives.

<agentkit-skill name="{name}" source="{relative_skill}">
@{{{relative_skill}}}
</agentkit-skill>

User arguments:
<args>{{{{args}}}}</args>

Treat empty arguments as an invocation without additional parameters. Resolve all
paths from the current workspace; never assume a machine-specific install path.
'''
    text = f"# Generated by engineer/.agentkit/scripts/generate-gemini-adapter.py\n"
    text += f"description = {toml_string(description)}\n"
    text += 'prompt = """\n' + prompt + '"""\n'
    return text.encode("utf-8")


def agent_bytes(agent: GeminiAgent) -> bytes:
    skill_lines = "\n".join(f"- `.agents/skills/{skill}/SKILL.md`" for skill in agent.skills)
    body = f'''---
name: {agent.name}
description: {agent.description}
kind: local
model: inherit
temperature: {agent.temperature}
max_turns: {agent.max_turns}
timeout_mins: {agent.timeout_mins}
---

<!-- Generated by engineer/.agentkit/scripts/generate-gemini-adapter.py -->
# AgentKit {agent.name}

You are the AgentKit `{agent.name}` specialist running as a Gemini CLI project
subagent. Gemini subagents cannot call other subagents, so complete only the
bounded assignment passed by the controller and return a concise evidence-based
result.

## Required skill loading

Read `GEMINI.md`, then read these project-local skill entrypoints in order:

{skill_lines}

Project-local `.agents/skills` content is authoritative. Do not silently fall
back to a global Claude, Codex, Cursor, or Gemini installation. If a required
entrypoint is absent, report `AGENTKIT_SKILL_NOT_FOUND` with the missing relative
path and stop.

## Role boundary

{agent.role}

Preserve unrelated user work. Treat `BLOCKED` and `NOT_RUN` as evidence states,
not success. Include the files inspected or changed, commands actually run, test
results, and residual limitations in the handoff.
'''
    return body.encode("utf-8")


def expected_files() -> dict[Path, bytes]:
    expected: dict[Path, bytes] = {}
    for name, skill_file in public_skills():
        target = COMMANDS_ROOT / f"{name.removeprefix('ak:')}.toml"
        expected[target] = command_bytes(name, skill_file)
    for agent in AGENTS:
        expected[AGENTS_ROOT / f"{agent.name}.md"] = agent_bytes(agent)
    return expected


def check(expected: dict[Path, bytes]) -> int:
    actual = {
        path
        for root, pattern in ((COMMANDS_ROOT, "*.toml"), (AGENTS_ROOT, "*.md"))
        if root.exists()
        for path in root.glob(pattern)
    }
    expected_paths = set(expected)
    errors: list[str] = []
    for path in sorted(expected_paths - actual):
        errors.append(f"missing: {path.relative_to(ROOT)}")
    for path in sorted(actual - expected_paths):
        errors.append(f"unexpected: {path.relative_to(ROOT)}")
    for path in sorted(actual & expected_paths):
        if path.read_bytes() != expected[path]:
            errors.append(f"stale: {path.relative_to(ROOT)}")
    if errors:
        print("Gemini adapter is out of date:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"Gemini adapter is current: {len(public_skills())} commands, {len(AGENTS)} agents")
    return 0


def write(expected: dict[Path, bytes]) -> int:
    for root in (COMMANDS_ROOT, AGENTS_ROOT):
        root.mkdir(parents=True, exist_ok=True)
    generated_marker = "Generated by engineer/.agentkit/scripts/generate-gemini-adapter.py"
    for root, pattern in ((COMMANDS_ROOT, "*.toml"), (AGENTS_ROOT, "*.md")):
        for path in root.glob(pattern):
            if path not in expected and generated_marker in path.read_text(encoding="utf-8"):
                path.unlink()
    for path, content in sorted(expected.items()):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    print(f"Generated {len(public_skills())} Gemini commands and {len(AGENTS)} agents")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="check generated files without writing")
    args = parser.parse_args()
    expected = expected_files()
    return check(expected) if args.check else write(expected)


if __name__ == "__main__":
    raise SystemExit(main())
