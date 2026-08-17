#!/usr/bin/env python3
"""Validate Wukong registration and mirror parity across AgentKit adapters."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tomllib
from pathlib import Path

WUKONG_REQUIRED_FILES = (
    "SKILL.md",
    "agents/openai.yaml",
    "assets/mission.template.json",
    "assets/verdict.template.json",
    "references/adversarial-protocol.md",
    "references/domain-overlays.md",
    "references/evidence-and-verdict.md",
    "references/evaluation-and-qualification.md",
    "references/mission-contract.md",
    "references/workflow-integration.md",
    "scripts/wukong-contract.cjs",
    "scripts/wukong-contract.test.cjs",
    "scripts/wukong-linkage.cjs",
    "scripts/wukong-linkage.test.cjs",
    "scripts/wukong-portability-smoke.cjs",
)
SKILL_TREES = (
    "engineer/skills",
    ".codex/skills",
    ".claude/skills",
    ".cursor/skills",
    ".agents/skills",
)
AGENT_TREES = (
    "engineer/.codex/agents",
    ".codex/agents",
    ".claude/agents",
    ".cursor/agents",
)
ROUTING_MIRRORS = (
    "ak-agentkit/SKILL.md",
    "ak-agentkit/references/subagent-timing.md",
    "ak-goal-warmup/SKILL.md",
    "ak-orchestrate/references/model-routing.md",
)
ABSOLUTE_WINDOWS_PATH = re.compile(r"(?i)(?:^|[\s\"'])(?:[a-z]:[\\/]|\\\\)")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def tree_hashes(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): sha256(path)
        for path in sorted(root.rglob("*"))
        if path.is_file() and "__pycache__" not in path.parts
    }


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_toml(path: Path) -> dict[str, object]:
    with path.open("rb") as stream:
        return tomllib.load(stream)


def frontmatter_value(path: Path, field: str) -> str | None:
    content = read_text(path)
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if not match:
        return None
    value = re.search(rf"^{re.escape(field)}:\s*(.+)$", match.group(1), re.MULTILINE)
    return value.group(1).strip().strip("'\"") if value else None


def validate(repo_root: Path) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    evidence: list[str] = []

    if not (repo_root / ".git").exists():
        errors.append(f"repo root has no .git: {repo_root}")
        return {"valid": False, "errors": errors, "warnings": warnings, "evidence": evidence}

    canonical_skill_tree = repo_root / SKILL_TREES[0]
    canonical_skill_names = {
        item.name for item in canonical_skill_tree.iterdir() if item.is_dir()
    }
    expected_skills = len(canonical_skill_names)
    if expected_skills == 0:
        errors.append("canonical engineer/skills registry is empty")

    skill_sets: list[set[str]] = []
    for relative in SKILL_TREES:
        tree = repo_root / relative
        if not tree.is_dir():
            errors.append(f"missing skill registry: {relative}")
            names = set()
        else:
            names = {item.name for item in tree.iterdir() if item.is_dir()}
        skill_sets.append(names)
        if len(names) != expected_skills:
            errors.append(f"{relative} has {len(names)} top-level skills, expected {expected_skills}")
        if "ak-wukong" not in names:
            errors.append(f"{relative} is missing ak-wukong")
    if any(names != skill_sets[0] for names in skill_sets[1:]):
        errors.append("top-level skill registries do not contain identical names")
    else:
        evidence.append(f"{len(skill_sets[0])} top-level skills across {len(SKILL_TREES)} registries")

    canonical = repo_root / "engineer/skills/ak-wukong"
    canonical_hashes = tree_hashes(canonical)
    for relative in SKILL_TREES[1:]:
        mirror = repo_root / relative / "ak-wukong"
        for required in WUKONG_REQUIRED_FILES:
            if not (mirror / required).is_file():
                errors.append(f"{relative}/ak-wukong is missing required file: {required}")
        if tree_hashes(mirror) != canonical_hashes:
            errors.append(f"Wukong skill mirror differs: {relative}")
    for required in WUKONG_REQUIRED_FILES:
        if not (canonical / required).is_file():
            errors.append(f"engineer/skills/ak-wukong is missing required file: {required}")
    if not any(error.startswith("Wukong skill mirror differs") for error in errors):
        evidence.append(f"Wukong skill parity: {len(canonical_hashes)} files x {len(SKILL_TREES)} registries")

    skill_md = canonical / "SKILL.md"
    skill_text = read_text(skill_md)
    if frontmatter_value(skill_md, "name") != "ak:wukong":
        errors.append("canonical skill name is not ak:wukong")
    if "TODO" in skill_text:
        errors.append("canonical Wukong skill contains a TODO placeholder")
    for required in (
        "FALSIFIED",
        "NOT_FALSIFIED",
        "INCONCLUSIVE",
        "UNDERDEFINED",
        "Never edit product source",
        "validate-bundle",
        "validate-chain",
    ):
        if required not in skill_text:
            errors.append(f"canonical skill is missing required contract text: {required}")

    canonical_agent_tree = repo_root / AGENT_TREES[0]
    canonical_agent_names = {
        item.stem.lower()
        for item in canonical_agent_tree.iterdir()
        if item.is_file() and item.suffix in {".toml", ".md"}
    }
    expected_agents = len(canonical_agent_names)
    if expected_agents == 0:
        errors.append("canonical engineer/.codex/agents registry is empty")

    agent_sets: list[set[str]] = []
    for relative in AGENT_TREES:
        tree = repo_root / relative
        if not tree.is_dir():
            errors.append(f"missing agent registry: {relative}")
            names = set()
        else:
            names = {
                item.stem.lower()
                for item in tree.iterdir()
                if item.is_file() and item.suffix in {".toml", ".md"}
            }
        agent_sets.append(names)
        if len(names) != expected_agents:
            errors.append(f"{relative} has {len(names)} agents, expected {expected_agents}")
        if "wukong" not in names:
            errors.append(f"{relative} is missing wukong")
    if any(names != agent_sets[0] for names in agent_sets[1:]):
        errors.append("agent adapters do not contain identical agent names")
    else:
        evidence.append(f"{len(agent_sets[0])} agents across {len(AGENT_TREES)} adapters")

    engineer_agent = repo_root / "engineer/.codex/agents/wukong.toml"
    portable_agent = repo_root / ".codex/agents/wukong.toml"
    if not engineer_agent.is_file() or not portable_agent.is_file():
        errors.append("Codex Wukong agent source or portable mirror is missing")
    elif sha256(engineer_agent) != sha256(portable_agent):
        errors.append("Codex Wukong agent mirror differs from engineer source")
    else:
        evidence.append("Codex Wukong agent hash parity")

    agent_data = load_toml(engineer_agent).get("agents", {}).get("wukong", {}) if engineer_agent.is_file() else {}
    if agent_data.get("model") != "gpt-5.6-sol":
        warnings.append("Codex Wukong model route differs from the checked-in default; verify against live inventory")
    requested_effort = agent_data.get("model_reasoning_effort")
    if requested_effort not in {"none", "minimal", "low", "medium", "high", "xhigh", "max"}:
        warnings.append("Codex Wukong reasoning effort is outside the installed enum; verify against live runtime")
    else:
        warnings.append("Codex Wukong model/reasoning settings are static hints; authenticated live runtime verification is still required")
    if requested_effort != "max":
        errors.append("Codex Wukong preferred reasoning effort must be max; runtime fallback remains forbidden")
    instructions = str(agent_data.get("developer_instructions", ""))
    for required in ("R0/report-only", "Never edit product source", "WUKONG VERDICT", "NOT_FALSIFIED"):
        if required not in instructions:
            errors.append(f"Codex Wukong profile is missing safety/protocol text: {required}")
    codex_project_first = instructions.find("1. .codex/skills/ak-wukong/SKILL.md")
    codex_global = instructions.find("~/.claude/skills/ak-wukong/SKILL.md")
    if codex_project_first < 0 or codex_global < 0 or codex_project_first > codex_global:
        errors.append("Codex Wukong profile must prefer project-local skill before global fallback")
    if "selected skill locator and SHA-256" not in instructions:
        errors.append("Codex Wukong profile must record selected skill identity")

    for relative, expected_model in (
        (".claude/agents/wukong.md", "fable"),
        (".cursor/agents/wukong.md", "claude-fable-5-high"),
    ):
        path = repo_root / relative
        if frontmatter_value(path, "name") != "wukong":
            errors.append(f"{relative} frontmatter name is not wukong")
        if frontmatter_value(path, "model") != expected_model:
            warnings.append(f"{relative} model differs from the checked-in default; verify against live inventory")
        adapter_text = read_text(path)
        project_first = adapter_text.find("1. .codex/skills/ak-wukong/SKILL.md")
        global_fallback = adapter_text.find("~/.claude/skills/ak-wukong/SKILL.md")
        if project_first < 0 or global_fallback < 0 or project_first > global_fallback:
            errors.append(f"{relative} must prefer project-local skill before global fallback")
        if "selected skill locator and SHA-256" not in adapter_text:
            errors.append(f"{relative} must record selected skill identity")

    for relative in ("engineer/.codex/config.toml", ".codex/config.toml"):
        config = load_toml(repo_root / relative)
        registration = config.get("agents", {}).get("wukong", {})
        if registration.get("config_file") != "agents/wukong.toml":
            errors.append(f"{relative} does not register agents/wukong.toml")
    if not any("does not register" in error for error in errors):
        evidence.append("Wukong registered in both Codex configs")

    plugin = json.loads(read_text(repo_root / "engineer/.codex-plugin/plugin.json"))
    expected_skill = "skills/ak-wukong/SKILL.md"
    if plugin.get("skills", []).count(expected_skill) != 1:
        errors.append("plugin manifest must contain Wukong skill exactly once")
    if len(plugin.get("skills", [])) != expected_skills:
        errors.append(
            f"plugin manifest has {len(plugin.get('skills', []))} skills, expected {expected_skills}"
        )
    else:
        evidence.append(f"plugin manifest lists {expected_skills} skills")

    canonical_skill_root = repo_root / "engineer/skills"
    for relative_file in ROUTING_MIRRORS:
        source = canonical_skill_root / relative_file
        if not source.is_file():
            errors.append(f"canonical routing file is missing: {relative_file}")
            continue
        expected = sha256(source)
        for mirror_root in SKILL_TREES[1:]:
            mirror = repo_root / mirror_root / relative_file
            if not mirror.is_file():
                errors.append(f"routing mirror is missing: {mirror_root}/{relative_file}")
                continue
            actual = sha256(mirror)
            if actual != expected:
                errors.append(f"routing mirror differs: {mirror_root}/{relative_file}")
    if not any(error.startswith("routing mirror differs") for error in errors):
        evidence.append(f"{len(ROUTING_MIRRORS)} Wukong routing files have mirror parity")

    # Validate the checked-in contract assets structurally.  The Node contract
    # gate remains the source of truth for semantic rules; these checks make
    # missing/renamed fields visible in the cross-adapter audit itself.
    mission_template = canonical / "assets/mission.template.json"
    verdict_template = canonical / "assets/verdict.template.json"
    try:
        mission = json.loads(read_text(mission_template))
        verdict = json.loads(read_text(verdict_template))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Wukong contract template is not valid JSON: {exc}")
    else:
        for field in ("protocol_version", "mission_id", "mode", "target", "scope", "invariants", "risk", "authority", "budget", "artifact_dir", "handoff"):
            if field not in mission:
                errors.append(f"mission.template.json is missing field: {field}")
        for field in ("protocol_version", "mission_id", "target_identity", "claim_status", "recommended_gate", "severity", "confidence", "evidence_grade", "mechanism", "hypotheses", "evidence", "decisive_evidence_ids", "tested_invariants", "counterexamples", "probe_summary", "coverage_limits", "residual_risks", "missing_fields", "handoff"):
            if field not in verdict:
                errors.append(f"verdict.template.json is missing field: {field}")
        if mission.get("authority", {}).get("level") != "R0" or mission.get("authority", {}).get("write_mode") != "report-only":
            errors.append("mission.template.json must keep the R0/report-only authority boundary")
        if mission.get("authority", {}).get("external_effects") is not False:
            errors.append("mission.template.json must disable external effects")
        evidence.append("mission/verdict templates expose the required contract fields")

    openai_yaml = canonical / "agents/openai.yaml"
    openai_text = read_text(openai_yaml) if openai_yaml.is_file() else ""
    for field in ("display_name", "short_description", "default_prompt"):
        if not re.search(rf"^\s*{field}:\s*['\"]?\S", openai_text, re.MULTILINE):
            errors.append(f"agents/openai.yaml is missing a non-empty {field}")
    prompt_match = re.search(r"^\s*default_prompt:\s*['\"](.*)['\"]\s*$", openai_text, re.MULTILINE)
    if prompt_match and len(prompt_match.group(1)) > 128:
        errors.append("agents/openai.yaml default_prompt exceeds 128 characters")

    readme = read_text(repo_root / "README.md")
    for required in (
        f"skills-{expected_skills}",
        f"{expected_skills} skill",
        f"{expected_agents} agent",
        "/ak:wukong",
        "@wukong",
    ):
        if required not in readme:
            errors.append(f"README is missing current Wukong inventory text: {required}")

    portable_files = [
        skill_md,
        *(canonical / "references").rglob("*.md"),
        *(canonical / "assets").rglob("*.json"),
        canonical / "agents/openai.yaml",
        engineer_agent,
        portable_agent,
        repo_root / ".claude/agents/wukong.md",
        repo_root / ".cursor/agents/wukong.md",
    ]
    for path in portable_files:
        if path.is_file() and ABSOLUTE_WINDOWS_PATH.search(read_text(path)):
            errors.append(f"machine-specific Windows path found in {path.relative_to(repo_root)}")

    return {"valid": not errors, "errors": errors, "warnings": warnings, "evidence": evidence}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    result = validate(args.repo_root.resolve())
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("Wukong integration valid" if result["valid"] else "Wukong integration invalid")
        for item in result["evidence"]:
            print(f"[OK] {item}")
        for item in result["errors"]:
            print(f"[ERROR] {item}")
        for item in result["warnings"]:
            print(f"[WARN] {item}")
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
