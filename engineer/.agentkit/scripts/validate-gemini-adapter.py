#!/usr/bin/env python3
"""Validate AgentKit's copy-ready Gemini CLI adapter."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SKILLS_ROOT = ROOT / ".agents" / "skills"
COMMANDS_ROOT = ROOT / ".gemini" / "commands" / "ak"
AGENTS_ROOT = ROOT / ".gemini" / "agents"
EXPECTED_AGENTS = {
    "advisor", "brainstormer", "code-reviewer", "code-simplifier", "debugger",
    "docs-manager", "explore", "fullstack-developer", "git-manager",
    "journal-writer", "kongming", "planner", "project-manager", "researcher",
    "tester", "ui-ux-designer", "wukong",
}
HOST_PATH_PATTERNS = (
    re.compile(r"(?i)[a-z]:[\\/](?:users|agent_kit|claude_kit|downloads)[\\/]"),
    re.compile(r"(?i)/home/[^/]+/"),
    re.compile(r"(?i)/users/[^/]+/"),
)


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def frontmatter(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("missing YAML frontmatter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("unterminated YAML frontmatter")
    values: dict[str, str] = {}
    for line in text[4:end].splitlines():
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*?)\s*$", line)
        if match:
            values[match.group(1)] = match.group(2).strip("\"'")
    return values, text[end + 5 :]


def skill_index() -> dict[str, Path]:
    result: dict[str, Path] = {}
    for path in SKILLS_ROOT.rglob("SKILL.md"):
        metadata, _ = frontmatter(path)
        name = metadata.get("name", "")
        if name in result:
            raise ValueError(f"duplicate skill name: {name}")
        result[name] = path
    return result


def validate() -> dict[str, object]:
    errors: list[str] = []
    try:
        skills = skill_index()
    except ValueError as exc:
        skills = {}
        fail(errors, str(exc))

    public_skills = {name: path for name, path in skills.items() if name != "ak:common"}
    commands = sorted(COMMANDS_ROOT.glob("*.toml")) if COMMANDS_ROOT.exists() else []
    command_names: set[str] = set()
    for command in commands:
        name = f"ak:{command.stem}"
        command_names.add(name)
        try:
            data = tomllib.loads(command.read_text(encoding="utf-8"))
        except (OSError, tomllib.TOMLDecodeError) as exc:
            fail(errors, f"invalid TOML {command.relative_to(ROOT)}: {exc}")
            continue
        prompt = data.get("prompt")
        if not isinstance(data.get("description"), str) or not data["description"].strip():
            fail(errors, f"missing description: {command.relative_to(ROOT)}")
        if not isinstance(prompt, str):
            fail(errors, f"missing prompt: {command.relative_to(ROOT)}")
            continue
        target = public_skills.get(name)
        if target is None:
            fail(errors, f"command has no public skill: {name}")
            continue
        relative = target.relative_to(ROOT).as_posix()
        if f"@{{{relative}}}" not in prompt:
            fail(errors, f"command does not inject authoritative skill: {name}")
        if "{{args}}" not in prompt:
            fail(errors, f"command does not forward arguments: {name}")

    missing_commands = sorted(set(public_skills) - command_names)
    extra_commands = sorted(command_names - set(public_skills))
    if missing_commands:
        fail(errors, f"missing commands: {', '.join(missing_commands)}")
    if extra_commands:
        fail(errors, f"unexpected commands: {', '.join(extra_commands)}")

    agent_paths = sorted(AGENTS_ROOT.glob("*.md")) if AGENTS_ROOT.exists() else []
    agent_names: set[str] = set()
    for path in agent_paths:
        try:
            metadata, body = frontmatter(path)
        except ValueError as exc:
            fail(errors, f"invalid agent {path.relative_to(ROOT)}: {exc}")
            continue
        name = metadata.get("name", "")
        agent_names.add(name)
        if name != path.stem or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", name):
            fail(errors, f"agent name/path mismatch: {path.relative_to(ROOT)}")
        if not metadata.get("description"):
            fail(errors, f"agent description missing: {path.relative_to(ROOT)}")
        if metadata.get("kind") != "local":
            fail(errors, f"agent kind must be local: {path.relative_to(ROOT)}")
        if metadata.get("model") != "inherit":
            fail(errors, f"agent model must inherit: {path.relative_to(ROOT)}")
        for skill_path in re.findall(r"`(\.agents/skills/[^`]+/SKILL\.md)`", body):
            if not (ROOT / skill_path).is_file():
                fail(errors, f"agent references missing skill: {path.relative_to(ROOT)} -> {skill_path}")
    if agent_names != EXPECTED_AGENTS:
        fail(errors, f"agent set mismatch: expected {sorted(EXPECTED_AGENTS)}, got {sorted(agent_names)}")

    settings_path = ROOT / ".gemini" / "settings.json"
    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        settings = {}
        fail(errors, f"invalid .gemini/settings.json: {exc}")
    if settings != {"experimental": {"enableAgents": True}, "skills": {"enabled": True}}:
        fail(errors, ".gemini/settings.json must contain only the approved skills/agents toggles")

    required = [ROOT / "GEMINI.md", settings_path, ROOT / ".agents" / "skills", ROOT / ".agentkit"]
    for path in required:
        if not path.exists():
            fail(errors, f"copy-ready asset missing: {path.relative_to(ROOT)}")

    scanned = [ROOT / "GEMINI.md", settings_path, *commands, *agent_paths]
    for path in scanned:
        text = path.read_text(encoding="utf-8")
        for pattern in HOST_PATH_PATTERNS:
            if pattern.search(text):
                fail(errors, f"host-specific path in {path.relative_to(ROOT)}")
        if path.suffix == ".json" and re.search(r'(?i)"(?:ui|theme|footer|statusline|hooks)"\s*:', text):
            fail(errors, f"presentation or hook configuration is forbidden in {path.relative_to(ROOT)}")

    if (ROOT / ".gemini" / "skills").exists():
        fail(errors, ".gemini/skills must not duplicate the shared .agents/skills registry")

    root_wrapper = ROOT / ".agentkit" / "scripts" / "set-active-plan.cjs"
    engineer_wrapper = ROOT / "engineer" / ".agentkit" / "scripts" / "set-active-plan.cjs"
    if not root_wrapper.is_file() or not engineer_wrapper.is_file():
        fail(errors, "active-plan wrapper mirror is missing")
    elif root_wrapper.read_bytes() != engineer_wrapper.read_bytes():
        fail(errors, "root and engineer active-plan wrappers differ")

    # Copy-smoke the path contract without duplicating the full skill payload.
    with tempfile.TemporaryDirectory(prefix="agentkit-gemini-") as temp:
        fixture = Path(temp)
        (fixture / ".gemini" / "commands" / "ak").mkdir(parents=True)
        (fixture / ".gemini" / "agents").mkdir(parents=True)
        for command in commands:
            (fixture / ".gemini" / "commands" / "ak" / command.name).write_bytes(command.read_bytes())
        for agent in agent_paths:
            (fixture / ".gemini" / "agents" / agent.name).write_bytes(agent.read_bytes())
        (fixture / "GEMINI.md").write_bytes((ROOT / "GEMINI.md").read_bytes())
        (fixture / ".gemini" / "settings.json").write_bytes(settings_path.read_bytes())
        for target in public_skills.values():
            relative = target.relative_to(ROOT)
            destination = fixture / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text("---\nname: fixture\n---\n", encoding="utf-8")
        for command in commands:
            data = tomllib.loads(command.read_text(encoding="utf-8"))
            match = re.search(r"@\{([^}]+/SKILL\.md)\}", data["prompt"])
            if match is None or not (fixture / match.group(1)).is_file():
                fail(errors, f"copy-smoke command target missing: {command.name}")

        # A documented minimal Gemini copy has no Codex/Claude/Cursor hook
        # runtime. The shared wrapper must still validate a canonical plan and
        # must ignore a stale adapter environment root rather than using it.
        wrapper = fixture / ".agentkit" / "scripts" / "set-active-plan.cjs"
        wrapper.parent.mkdir(parents=True)
        shutil.copy2(root_wrapper, wrapper)
        plan = fixture / "plans" / "fixture-plan"
        plan.mkdir(parents=True)
        (plan / "plan.md").write_text("# Fixture plan\n", encoding="utf-8")
        (plan / "phase-01-test.md").write_text("# Fixture phase\n", encoding="utf-8")
        node = shutil.which("node")
        if node is None:
            fail(errors, "node is required for the Gemini active-plan copy-smoke")
        else:
            environment = os.environ.copy()
            environment["CLAUDE_PROJECT_DIR"] = str(ROOT)
            environment.pop("CK_SESSION_ID", None)
            completed = subprocess.run(
                [node, str(wrapper), "plans/fixture-plan"],
                cwd=fixture,
                env=environment,
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
            if (
                completed.returncode != 0
                or "Validated active plan: plans/fixture-plan" not in completed.stdout
                or "Gemini adapter has no reviewed session-state bridge" not in completed.stderr
            ):
                fail(
                    errors,
                    "minimal Gemini copy could not validate an active plan without another adapter hook runtime",
                )

    return {
        "valid": not errors,
        "skills": len(skills),
        "public_skills": len(public_skills),
        "commands": len(commands),
        "agents": len(agent_paths),
        "shared_skill_registry": ".agents/skills",
        "errors": errors,
    }


def main() -> int:
    result = validate()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
