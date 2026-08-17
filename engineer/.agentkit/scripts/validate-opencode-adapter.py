#!/usr/bin/env python3
"""Validate AgentKit's copy-ready OpenCode adapter."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SKILLS_ROOT = ROOT / ".agents" / "skills"
AGENTS_ROOT = ROOT / ".opencode" / "agents"
CONFIG_PATH = ROOT / ".opencode" / "opencode.json"
OPENCODE_MD_PATH = ROOT / "OPENCODE.md"
EXPECTED_AGENTS = {
    "advisor", "brainstormer", "code-reviewer", "code-simplifier", "debugger",
    "docs-manager", "explore", "fullstack-developer", "git-manager",
    "journal-writer", "kongming", "planner", "project-manager", "researcher",
    "tester", "ui-ux-designer", "wukong",
}
EXPECTED_CONFIG = {
    "$schema": "https://opencode.ai/config.json",
    "instructions": ["OPENCODE.md"],
}
REQUIRED_OPENCODE_MD_SECTIONS = (
    "# AgentKit for OpenCode",
    "## Runtime assets",
    "## Workflow routing",
    "## Common commands",
    "## Safety and delivery rules",
    "## Catalog refresh",
)
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


def public_skill_names() -> set[str]:
    names: set[str] = set()
    for path in SKILLS_ROOT.rglob("SKILL.md"):
        metadata, _ = frontmatter(path)
        name = metadata.get("name", "")
        if name and name != "ak:common":
            names.add(name)
    return names


def validate() -> dict[str, object]:
    errors: list[str] = []
    skills = public_skill_names()
    if not skills:
        fail(errors, "shared .agents/skills registry is empty or unreadable")

    agent_paths = sorted(AGENTS_ROOT.glob("*.md")) if AGENTS_ROOT.exists() else []
    agent_names: set[str] = set()
    for path in agent_paths:
        try:
            metadata, body = frontmatter(path)
        except ValueError as exc:
            fail(errors, f"invalid agent {path.relative_to(ROOT)}: {exc}")
            continue
        agent_names.add(path.stem)
        name = path.stem
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", name):
            fail(errors, f"agent name/path mismatch: {path.relative_to(ROOT)}")
        if not metadata.get("description"):
            fail(errors, f"agent description missing: {path.relative_to(ROOT)}")
        if metadata.get("mode") != "subagent":
            fail(errors, f"agent mode must be subagent: {path.relative_to(ROOT)}")
        if "model" in metadata:
            fail(errors, f"agent must not pin a model: {path.relative_to(ROOT)}")
        try:
            temperature = float(metadata.get("temperature", ""))
        except ValueError:
            temperature = -1.0
        if not 0.0 <= temperature <= 2.0:
            fail(errors, f"agent temperature missing or out of range: {path.relative_to(ROOT)}")
        try:
            steps = int(metadata.get("steps", ""))
        except ValueError:
            steps = 0
        if steps < 1:
            fail(errors, f"agent steps missing or not positive: {path.relative_to(ROOT)}")
        for skill_path in re.findall(r"`(\.agents/skills/[^`]+/SKILL\.md)`", body):
            if not (ROOT / skill_path).is_file():
                fail(errors, f"agent references missing skill: {path.relative_to(ROOT)} -> {skill_path}")
    if agent_names != EXPECTED_AGENTS:
        fail(errors, f"agent set mismatch: expected {sorted(EXPECTED_AGENTS)}, got {sorted(agent_names)}")

    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        config = {}
        fail(errors, f"invalid .opencode/opencode.json: {exc}")
    if config != EXPECTED_CONFIG:
        fail(errors, ".opencode/opencode.json must contain only the schema pointer and OPENCODE.md instruction")
    if re.search(r'"(?:model|theme|keybindings|footer|statusline|provider|api)\s*"', CONFIG_PATH.read_text(encoding="utf-8")):
        fail(errors, "presentation, model, or credential configuration is forbidden in opencode.json")

    try:
        opencode_md = OPENCODE_MD_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        opencode_md = ""
        fail(errors, f"missing OPENCODE.md: {exc}")
    for section in REQUIRED_OPENCODE_MD_SECTIONS:
        if section not in opencode_md:
            fail(errors, f"OPENCODE.md lacks required section: {section}")

    for forbidden in (
        ROOT / ".opencode" / "skills",
        ROOT / ".opencode" / "command",
        ROOT / ".opencode" / "commands",
    ):
        if forbidden.exists():
            fail(errors, f"{forbidden.relative_to(ROOT)} must not duplicate the shared .agents/skills registry")

    required = [OPENCODE_MD_PATH, CONFIG_PATH, SKILLS_ROOT, ROOT / ".agentkit"]
    for path in required:
        if not path.exists():
            fail(errors, f"copy-ready asset missing: {path.relative_to(ROOT)}")

    scanned = [OPENCODE_MD_PATH, CONFIG_PATH, *agent_paths]
    for path in scanned:
        text = path.read_text(encoding="utf-8")
        for pattern in HOST_PATH_PATTERNS:
            if pattern.search(text):
                fail(errors, f"host-specific path in {path.relative_to(ROOT)}")

    root_wrapper = ROOT / ".agentkit" / "scripts" / "set-active-plan.cjs"
    engineer_wrapper = ROOT / "engineer" / ".agentkit" / "scripts" / "set-active-plan.cjs"
    if not root_wrapper.is_file() or not engineer_wrapper.is_file():
        fail(errors, "active-plan wrapper mirror is missing")
    elif root_wrapper.read_bytes() != engineer_wrapper.read_bytes():
        fail(errors, "root and engineer active-plan wrappers differ")

    # Copy-smoke the path contract without duplicating the full skill payload.
    with tempfile.TemporaryDirectory(prefix="agentkit-opencode-") as temp:
        fixture = Path(temp)
        (fixture / ".opencode" / "agents").mkdir(parents=True)
        for agent in agent_paths:
            (fixture / ".opencode" / "agents" / agent.name).write_bytes(agent.read_bytes())
        (fixture / ".opencode" / "opencode.json").write_bytes(CONFIG_PATH.read_bytes())
        (fixture / "OPENCODE.md").write_bytes(OPENCODE_MD_PATH.read_bytes())
        for skill_dir in sorted(p for p in SKILLS_ROOT.iterdir() if p.is_dir()):
            destination = fixture / ".agents" / "skills" / skill_dir.name
            destination.mkdir(parents=True, exist_ok=True)
            (destination / "SKILL.md").write_text(
                f"---\nname: ak:{skill_dir.name.removeprefix('ak-')}\ndescription: fixture\n---\n",
                encoding="utf-8",
            )
        for path in agent_paths:
            for skill_path in re.findall(r"`(\.agents/skills/[^`]+/SKILL\.md)`", path.read_text(encoding="utf-8")):
                if not (fixture / skill_path).is_file():
                    fail(errors, f"copy-smoke agent target missing: {path.name} -> {skill_path}")

        # A documented minimal OpenCode copy has no Codex/Claude/Cursor hook
        # runtime. The shared wrapper must still validate a canonical plan and
        # must stay validation-only instead of claiming session persistence.
        wrapper = fixture / ".agentkit" / "scripts" / "set-active-plan.cjs"
        wrapper.parent.mkdir(parents=True)
        shutil.copy2(root_wrapper, wrapper)
        plan = fixture / "plans" / "fixture-plan"
        plan.mkdir(parents=True)
        (plan / "plan.md").write_text("# Fixture plan\n", encoding="utf-8")
        (plan / "phase-01-test.md").write_text("# Fixture phase\n", encoding="utf-8")
        node = shutil.which("node")
        if node is None:
            fail(errors, "node is required for the OpenCode active-plan copy-smoke")
        else:
            environment = os.environ.copy()
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
                or "OpenCode adapter has no reviewed session-state bridge" not in completed.stderr
            ):
                fail(
                    errors,
                    "minimal OpenCode copy could not validate an active plan without another adapter hook runtime",
                )

    return {
        "valid": not errors,
        "public_skills": len(skills),
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
