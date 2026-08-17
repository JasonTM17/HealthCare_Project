#!/usr/bin/env python3
"""Run the complete read-only Wukong adapter and contract gate."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SKILL_ROOT = REPO_ROOT / "engineer/skills/ak-wukong"
CONTRACT = SKILL_ROOT / "scripts/wukong-contract.cjs"
CONTRACT_TEST = SKILL_ROOT / "scripts/wukong-contract.test.cjs"
LINKAGE_TEST = SKILL_ROOT / "scripts/wukong-linkage.test.cjs"
PORTABILITY_SMOKE = SKILL_ROOT / "scripts/wukong-portability-smoke.cjs"
MISSION_TEMPLATE = SKILL_ROOT / "assets/mission.template.json"
VERDICT_TEMPLATE = SKILL_ROOT / "assets/verdict.template.json"
INTEGRATION = REPO_ROOT / "engineer/.agentkit/scripts/validate-wukong-integration.py"
SIMULATION_ROOT = REPO_ROOT / "simulations/wukong-linkage"
SIMULATION_FIXTURE_TEST = SIMULATION_ROOT / "scenario/fixture/test/hook-runner.test.cjs"
SIMULATION_LINKAGE_TEST = SIMULATION_ROOT / "scripts/run-simulation.test.cjs"
SIMULATION_RUNNER = SIMULATION_ROOT / "scripts/run-simulation.cjs"
EVALUATION_ROOT = REPO_ROOT / "evaluations/wukong"
EVALUATION_TESTS = EVALUATION_ROOT / "tests"
EVALUATION_RUNNER = EVALUATION_ROOT / "bin/wukong-eval.cjs"
DISCOVERY_RUNNER = EVALUATION_ROOT / "bin/wukong-discovery.cjs"
PORTABILITY_MATRIX = EVALUATION_ROOT / "bin/portability-matrix.cjs"
CI_MATRIX = EVALUATION_ROOT / "scripts/validate-ci-matrix.cjs"
INSTALL_MANIFEST = REPO_ROOT / "engineer/.agentkit/scripts/generate-install-manifest.py"
INSTALL_MANIFEST_TEST = REPO_ROOT / "engineer/.agentkit/scripts/test_install_manifest.py"
PROJECT_ASSETS = REPO_ROOT / "engineer/.agentkit/scripts/validate-project-assets.py"
GEMINI_GENERATOR = REPO_ROOT / "engineer/.agentkit/scripts/generate-gemini-adapter.py"
GEMINI_VALIDATOR = REPO_ROOT / "engineer/.agentkit/scripts/validate-gemini-adapter.py"
OPENCODE_GENERATOR = REPO_ROOT / "engineer/.agentkit/scripts/generate-opencode-adapter.py"
OPENCODE_VALIDATOR = REPO_ROOT / "engineer/.agentkit/scripts/validate-opencode-adapter.py"
DOMAIN_SIMULATIONS = EVALUATION_ROOT / "simulations/run-simulations.cjs"


def portable_text(value: str) -> str:
    result = value
    locations = {
        "<REPO_ROOT>": str(REPO_ROOT),
        "<USER_HOME>": str(Path.home()),
        "<TEMP_ROOT>": tempfile.gettempdir(),
    }
    variants: list[tuple[str, str]] = []
    for replacement, location in locations.items():
        if location:
            variants.extend([
                (location, replacement),
                (location.replace("\\", "/"), replacement),
            ])
    for variant, replacement in sorted(set(variants), key=lambda item: len(item[0]), reverse=True):
        result = result.replace(variant, replacement)
    return result


def portable_command(command: list[str]) -> str:
    rendered: list[str] = []
    for value in command:
        candidate = Path(value)
        if not candidate.is_absolute():
            rendered.append(value)
            continue
        try:
            rendered.append(candidate.resolve().relative_to(REPO_ROOT).as_posix())
        except (OSError, ValueError):
            rendered.append(f"<RUNTIME>/{candidate.name}")
    return " ".join(rendered)


def run_step(label: str, command: list[str]) -> dict[str, object]:
    completed = subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    result: dict[str, object] = {
        "label": label,
        "command": portable_command(command),
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "stdout": portable_text(completed.stdout.strip()),
        "stderr": portable_text(completed.stderr.strip()),
    }
    if completed.stdout.strip().startswith("{"):
        try:
            payload = json.loads(completed.stdout)
            if isinstance(payload.get("coverage_complete"), bool):
                result["coverage_complete"] = payload["coverage_complete"]
            if isinstance(payload.get("gate_status"), str):
                result["gate_status"] = payload["gate_status"]
        except (json.JSONDecodeError, AttributeError):
            pass
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the read-only Wukong contract, linkage simulation, parity, and portability gate"
    )
    parser.add_argument("--json", action="store_true", help="emit machine-readable step results")
    parser.add_argument(
        "--require-clean",
        action="store_true",
        help="also fail when the Git worktree contains tracked or untracked changes",
    )
    args = parser.parse_args()

    node = shutil.which("node")
    if node is None:
        result = {"valid": False, "steps": [], "errors": ["node is required for Wukong contract checks"]}
        print(json.dumps(result, indent=2) if args.json else "Wukong combined gate invalid: node not found")
        return 1

    steps: list[dict[str, object]] = [
        run_step("contract-tests", [node, str(CONTRACT_TEST)]),
        run_step("linkage-tests", [node, str(LINKAGE_TEST)]),
        run_step("mission-template", [node, str(CONTRACT), "validate-mission", str(MISSION_TEMPLATE)]),
        run_step("verdict-template", [node, str(CONTRACT), "validate-verdict", str(VERDICT_TEMPLATE)]),
        run_step(
            "template-bundle",
            [node, str(CONTRACT), "validate-bundle", str(MISSION_TEMPLATE), str(VERDICT_TEMPLATE)],
        ),
        run_step("portability-smoke", [node, str(PORTABILITY_SMOKE), "--json"]),
        run_step("integration-parity", [sys.executable, str(INTEGRATION), "--json"]),
        run_step("project-assets", [sys.executable, str(PROJECT_ASSETS)]),
        run_step("gemini-generated-adapter", [sys.executable, str(GEMINI_GENERATOR), "--check"]),
        run_step("gemini-adapter", [sys.executable, str(GEMINI_VALIDATOR)]),
        run_step("opencode-generated-adapter", [sys.executable, str(OPENCODE_GENERATOR), "--check"]),
        run_step("opencode-adapter", [sys.executable, str(OPENCODE_VALIDATOR)]),
        run_step(
            "linkage-simulation-tests",
            [node, "--test", str(SIMULATION_FIXTURE_TEST), str(SIMULATION_LINKAGE_TEST)],
        ),
        run_step("linkage-simulation", [node, str(SIMULATION_RUNNER), "--json", "--no-write"]),
        run_step(
            "evaluation-tests",
            [node, "--test", *[str(path) for path in sorted(EVALUATION_TESTS.glob("*.test.cjs"))]],
        ),
        run_step("evaluation-corpus", [node, str(EVALUATION_RUNNER), "deterministic", "--json"]),
        run_step("evaluation-discovery-corpus", [node, str(DISCOVERY_RUNNER), "deterministic", "--json"]),
        run_step("evaluation-domain-simulations", [node, str(DOMAIN_SIMULATIONS)]),
        run_step("evaluation-provenance", [node, str(EVALUATION_RUNNER), "provenance", "--json"]),
        run_step("evaluation-portability", [node, str(PORTABILITY_MATRIX)]),
        run_step("evaluation-ci-definition", [node, str(CI_MATRIX)]),
        run_step("install-manifest-tests", [sys.executable, str(INSTALL_MANIFEST_TEST)]),
        run_step("install-manifest", [sys.executable, str(INSTALL_MANIFEST), "--check"]),
    ]
    if args.require_clean:
        git = shutil.which("git")
        if git is None:
            clean_step = {
                "label": "clean-worktree-after-gates",
                "command": "git status --porcelain --untracked-files=all",
                "ok": False,
                "returncode": 1,
                "stdout": "",
                "stderr": "git is required for --require-clean",
            }
        else:
            clean_step = run_step(
                "clean-worktree-after-gates",
                [git, "status", "--porcelain", "--untracked-files=all"],
            )
            if clean_step["ok"] and clean_step["stdout"]:
                clean_step["ok"] = False
                clean_step["returncode"] = 1
                clean_step["stderr"] = "worktree is not clean after all gates"
        steps.append(clean_step)
    failed = [step for step in steps if not step["ok"]]
    blocked = [step for step in steps if step.get("coverage_complete") is False]
    gate_status = "FAIL" if failed else ("PASS_WITH_BLOCKED_CAPABILITY" if blocked else "PASS")
    result = {
        "kind": "wukong.combined-gate",
        "valid": not failed,
        "coverage_complete": not failed and not blocked,
        "gate_status": gate_status,
        "read_only": True,
        "steps": steps,
        "errors": [f"{step['label']} failed with exit code {step['returncode']}" for step in failed],
        "blocked_capabilities": [step["label"] for step in blocked],
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"WUKONG COMBINED GATE: {gate_status}")
        for step in steps:
            step_status = "ERROR" if not step["ok"] else ("BLOCKED" if step.get("coverage_complete") is False else "OK")
            print(f"[{step_status}] {step['label']}")
            if not step["ok"] and step["stderr"]:
                print(f"  {step['stderr']}")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
