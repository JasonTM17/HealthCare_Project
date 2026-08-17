#!/usr/bin/env python3
"""Validate the portable AgentKit AGENTS.md, plan templates, and active-plan routing."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
AGENTS_PATH = REPO_ROOT / "AGENTS.md"
PLAN_ROOT = REPO_ROOT / "plans/templates"
PLAN_TEMPLATES = {
    "bug-fix-template.md": ["---\ntitle:", "status: pending", "created:", "Outcome Contract", "Evidence Ledger", "Required Gates", "/ak:wukong"],
    "feature-implementation-template.md": ["---\ntitle:", "status: pending", "created:", "Outcome Contract", "Acceptance Matrix", "Delivery and Recovery", "/ak:plan"],
    "refactor-template.md": ["---\ntitle:", "status: pending", "created:", "Outcome Contract", "Verification Matrix", "Backward Compatibility", "/ak:code-review"],
    "phase-template.md": ["---\nphase:", "status: pending", "dependencies:", "Implementation Steps", "Success Criteria", "Evidence and Handoff"],
    "template-usage-guide.md": ["Agent review gates", "Advisor", "Kongming", "Wukong"],
}
PLAN_SKILL_PATHS = [
    "engineer/skills/ak-plan/SKILL.md",
    "engineer/skills/ak-plan/references/workflow-modes.md",
    ".agents/skills/ak-plan/SKILL.md",
    ".agents/skills/ak-plan/references/workflow-modes.md",
    ".claude/skills/ak-plan/SKILL.md",
    ".claude/skills/ak-plan/references/workflow-modes.md",
    ".codex/skills/ak-plan/SKILL.md",
    ".codex/skills/ak-plan/references/workflow-modes.md",
    ".cursor/skills/ak-plan/SKILL.md",
    ".cursor/skills/ak-plan/references/workflow-modes.md",
]
PLANNER_PATHS = [
    "engineer/.codex/agents/planner.toml",
    ".codex/agents/planner.toml",
    ".claude/agents/planner.md",
    ".cursor/agents/planner.md",
]
ROOT_WRAPPER = REPO_ROOT / ".agentkit/scripts/set-active-plan.cjs"
ENGINEER_WRAPPER = REPO_ROOT / "engineer/.agentkit/scripts/set-active-plan.cjs"
PORTABLE_COMMAND = "node .agentkit/scripts/set-active-plan.cjs"
FRONTMATTER_KEYS = [
    "title", "description", "status", "priority", "effort", "issue",
    "branch", "tags", "blockedBy", "blocks", "created",
]
PHASE_FRONTMATTER_KEYS = ["phase", "title", "status", "priority", "effort", "dependencies"]
PLAN_INDEX_TEMPLATES = {
    "bug-fix-template.md", "feature-implementation-template.md", "refactor-template.md",
}
CODEX_PORTABILITY_PAIRS = [
    (".codex/agents/advisor.toml", "engineer/.codex/agents/advisor.toml"),
    (".codex/agents/ui-ux-designer.toml", "engineer/.codex/agents/ui-ux-designer.toml"),
    (".codex/agents/researcher.toml", "engineer/.codex/agents/researcher.toml"),
    (".codex/hooks/lib/context-builder.cjs", "engineer/.codex/hooks/lib/context-builder.cjs"),
    (".codex/hooks/subagent-init.cjs", "engineer/.codex/hooks/subagent-init.cjs"),
    (".codex/hooks/session-init.cjs", "engineer/.codex/hooks/session-init.cjs"),
]
PORTABLE_RUNTIME_SKILL_FILES = [
    "ak-common/README.md",
    "ak-common/scripts/runtime_paths.py",
    "ak-common/scripts/runtime-paths.cjs",
    "ak-coding-level/SKILL.md",
    "ak-copywriting/scripts/extract-writing-styles.py",
    "ak-better-auth/scripts/better_auth_init.py",
    "ak-better-auth/scripts/tests/test_better_auth_init.py",
    "ak-shopify/scripts/shopify_init.py",
    "ak-shopify/scripts/tests/test_shopify_init.py",
    "ak-docs-seeker/scripts/utils/env-loader.js",
    "ak-excalidraw/references/render_excalidraw.py",
    "ak-excalidraw/references/mcp-workflow.md",
    "ak-git/references/commit-standards.md",
    "ak-git/references/safety-protocols.md",
    "ak-git/references/workflow-commit.md",
    "ak-git/references/workflow-merge-pr.md",
    "ak-graphify/SKILL.md",
    "ak-repomix/scripts/repomix_batch.py",
    "ak-review-pr/SKILL.md",
    "ak-review-pr/references/pr-body-contract.md",
    "ak-review-pr/references/writing-language.md",
    "ak-ship/SKILL.md",
    "ak-ship/references/pr-template.md",
    "ak-ship/references/ship-workflow.md",
    "ak-show-off/SKILL.md",
    "ak-skill-creator/references/script-quality-criteria.md",
    "ak-skill-creator/references/validation-checklist.md",
    "ak-skill-creator/references/plugin-marketplace-hosting.md",
    "ak-watzup/scripts/watzup-scan.cjs",
    "ak-worktree/scripts/worktree.test.cjs",
    "ak-design/scripts/poster/core.py",
    "ak-design/scripts/icon/generate.py",
    "ak-design/scripts/logo/generate.py",
    "ak-docs/references/agent-context-rules.md",
    "ak-design/scripts/cip/generate.py",
    "ak-chrome-profile/SKILL.md",
    "ak-chrome-profile/scripts/chrome_profile_cli.py",
    "ak-cti-expert/README.md",
    "ak-cti-expert/scripts/install.sh",
    "ak-stitch/SKILL.md",
    "ak-stitch/references/quota-management.md",
    "ak-stitch/references/stitch-mcp-setup.md",
    "ak-stitch/scripts/stitch-export.ts",
    "ak-stitch/scripts/stitch-generate.ts",
    "ak-stitch/scripts/stitch-quota.ts",
    "ak-use-mcp/SKILL.md",
    "ak-use-mcp/references/configuration.md",
    "ak-use-mcp/references/gemini-cli-integration.md",
    "ak-use-mcp/scripts/.env.example",
    "ak-use-mcp/scripts/smoke-test.sh",
    "ak-use-mcp/scripts/mcp-client.ts",
]
SKILL_MIRROR_ROOTS = [".codex/skills", ".claude/skills", ".cursor/skills", ".agents/skills"]
CODEX_HOOK_CONFIGS = [
    (".codex/hooks.json", ".codex/hooks"),
    ("engineer/.codex/hooks.json", "engineer/.codex/hooks"),
]
HOOK_BOOTSTRAP_MARKER = "execFileSync('git',['rev-parse','--show-toplevel']"
SENSITIVE_ENV_NAME_RE = re.compile(r"(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API[_-]?KEY|AUTH)", re.IGNORECASE)


def iter_hook_handlers(config: dict):
    """Yield (event, matcher, handler) entries from a Codex hooks.json."""
    hooks = config.get("hooks") if isinstance(config, dict) else None
    if not isinstance(hooks, dict):
        return
    for event, groups in hooks.items():
        if not isinstance(event, str) or not isinstance(groups, list):
            continue
        for group in groups:
            if not isinstance(group, dict):
                continue
            matcher = group.get("matcher", "*")
            handlers = group.get("hooks")
            if not isinstance(handlers, list):
                continue
            for handler in handlers:
                if isinstance(handler, dict):
                    yield event, matcher, handler


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_contains(candidate: object, root: Path) -> bool:
    try:
        Path(str(candidate)).resolve().relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def main() -> int:
    errors: list[str] = []
    evidence: list[str] = []

    if not AGENTS_PATH.is_file():
        errors.append("root AGENTS.md is missing")
    else:
        agents = AGENTS_PATH.read_text(encoding="utf-8", errors="strict")
        if len(agents.encode("utf-8")) > 32 * 1024:
            errors.append("root AGENTS.md exceeds the 32 KiB portability budget")
        for required in [
            "# AgentKit project instructions",
            "## Default AgentKit workflow",
            "### Advisor",
            "### Kongming",
            "### Wukong",
            "## Verification discipline",
            "## Git and release",
        ]:
            if required not in agents:
                errors.append(f"root AGENTS.md lacks: {required}")
        if re.search(r"/[Cc][Kk]:", agents):
            errors.append("root AGENTS.md contains a foreign /ck namespace")
        if ".claude/scripts/set-active-plan.cjs" in agents:
            errors.append("root AGENTS.md contains the legacy Claude-only active-plan path")
        if re.search(r"[A-Za-z]:\\(?:Users|home)\\", agents, re.IGNORECASE):
            errors.append("root AGENTS.md contains a developer-specific absolute path")
        evidence.append(f"root AGENTS.md is AgentKit-native ({len(agents.splitlines())} lines)")

    actual_templates = sorted(path.name for path in PLAN_ROOT.glob("*.md")) if PLAN_ROOT.is_dir() else []
    if actual_templates != sorted(PLAN_TEMPLATES):
        errors.append("plan template set is missing or contains an unreviewed Markdown file")
    for name, required_fragments in PLAN_TEMPLATES.items():
        path = PLAN_ROOT / name
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="strict")
        if "/ck:" in text or ".claude/scripts" in text or "YYMMDD" in text:
            errors.append(f"{name} contains a legacy ClaudeKit path, command, or naming pattern")
        for fragment in required_fragments:
            if fragment not in text:
                errors.append(f"{name} lacks: {fragment}")
        if name in PLAN_INDEX_TEMPLATES or name == "phase-template.md":
            match = re.match(r"\A---\n(?P<body>.*?)\n---\n", text, re.DOTALL)
            if match is None:
                errors.append(f"{name} lacks canonical YAML frontmatter")
            else:
                frontmatter = match.group("body")
                keys = FRONTMATTER_KEYS if name in PLAN_INDEX_TEMPLATES else PHASE_FRONTMATTER_KEYS
                for key in keys:
                    if len(re.findall(rf"(?m)^{re.escape(key)}\s*:", frontmatter)) != 1:
                        errors.append(f"{name} must define frontmatter key exactly once: {key}")
        if name in PLAN_INDEX_TEMPLATES:
            if re.search(r"(?m)^## (?:Implementation Steps|TODO Checklist)\s*$", text):
                errors.append(f"{name} duplicates phase-level execution detail in plan.md")
            if len(text.splitlines()) > 100:
                errors.append(f"{name} is too large for a concise canonical plan index")
    evidence.append(f"{len(actual_templates)} AgentKit plan templates are present")

    skill_commands: set[str] = set()
    for skill_file in (REPO_ROOT / "engineer/skills").rglob("SKILL.md"):
        folder = skill_file.parent.name
        if folder.startswith("ak-"):
            skill_commands.add(folder[3:])
        head = skill_file.read_text(encoding="utf-8", errors="strict")[:4096]
        command = re.search(r"(?m)^name:\s*ak:([a-z0-9-]+)\s*$", head)
        if command:
            skill_commands.add(command.group(1))
    command_text = AGENTS_PATH.read_text(encoding="utf-8", errors="strict") if AGENTS_PATH.is_file() else ""
    command_text += "\n" + "\n".join(
        path.read_text(encoding="utf-8", errors="strict") for path in PLAN_ROOT.glob("*.md")
    )
    referenced_commands = set(re.findall(r"/ak:([a-z0-9-]+)", command_text)) - {"name"}
    missing_commands = sorted(referenced_commands - skill_commands)
    if missing_commands:
        errors.append(f"AGENTS/templates reference missing AgentKit commands: {', '.join(missing_commands)}")
    evidence.append(f"{len(referenced_commands)} referenced /ak commands resolve to installed skills")

    for relative in PLAN_SKILL_PATHS + PLANNER_PATHS:
        path = REPO_ROOT / relative
        if not path.is_file():
            errors.append(f"active-plan routing file is missing: {relative}")
            continue
        text = path.read_text(encoding="utf-8", errors="strict")
        if PORTABLE_COMMAND not in text:
            errors.append(f"active-plan routing is not portable: {relative}")
        if ".claude/scripts/set-active-plan.cjs" in text:
            errors.append(f"legacy Claude-only active-plan routing remains: {relative}")
    evidence.append(f"{len(PLAN_SKILL_PATHS)} plan skill mirrors and {len(PLANNER_PATHS)} planner adapters use .agentkit routing")

    for root_relative, engineer_relative in CODEX_PORTABILITY_PAIRS:
        root_path = REPO_ROOT / root_relative
        engineer_path = REPO_ROOT / engineer_relative
        if not root_path.is_file() or not engineer_path.is_file():
            errors.append(f"Codex portability mirror is missing: {root_relative}")
        elif root_path.read_text(encoding="utf-8", errors="strict") != engineer_path.read_text(encoding="utf-8", errors="strict"):
            errors.append(f"Codex portability mirror differs: {root_relative}")

    for relative in PORTABLE_RUNTIME_SKILL_FILES:
        canonical = REPO_ROOT / "engineer/skills" / relative
        if not canonical.is_file():
            errors.append(f"portable runtime skill source is missing: engineer/skills/{relative}")
            continue
        expected = digest(canonical)
        for mirror_root in SKILL_MIRROR_ROOTS:
            mirror = REPO_ROOT / mirror_root / relative
            if not mirror.is_file():
                errors.append(f"portable runtime skill mirror is missing: {mirror_root}/{relative}")
            elif digest(mirror) != expected:
                errors.append(f"portable runtime skill mirror differs: {mirror_root}/{relative}")
    evidence.append(f"{len(PORTABLE_RUNTIME_SKILL_FILES)} portable runtime skill assets have four mirror copies")

    git_workflow_text = (REPO_ROOT / "engineer/skills/ak-git/references/workflow-commit.md").read_text(encoding="utf-8", errors="strict")
    git_safety_text = (REPO_ROOT / "engineer/skills/ak-git/references/safety-protocols.md").read_text(encoding="utf-8", errors="strict")
    ship_workflow_text = (REPO_ROOT / "engineer/skills/ak-ship/references/ship-workflow.md").read_text(encoding="utf-8", errors="strict")
    if re.search(r"(?m)^\s*git add (?:-A|\.)\s*$", git_workflow_text + ship_workflow_text):
        errors.append("Git/ship workflow contains an unscoped staging command")
    if re.search(r"(?m)^(?:\s*git reset --hard\b|\s*git checkout --\b)", git_safety_text):
        errors.append("Git safety reference contains a destructive recovery command")
    stitch_text = "\n".join(
        (REPO_ROOT / "engineer/skills" / relative).read_text(encoding="utf-8", errors="strict")
        for relative in [
            "ak-stitch/SKILL.md",
            "ak-stitch/scripts/stitch-quota.ts",
            "ak-stitch/scripts/stitch-generate.ts",
            "ak-stitch/scripts/stitch-export.ts",
            "ak-stitch/references/quota-management.md",
        ]
    )
    if ".claudekit" in stitch_text or "claudekit-default" in stitch_text:
        errors.append("Stitch runtime still contains a ClaudeKit-only quota or project fallback")
    coding_level_text = (REPO_ROOT / "engineer/skills/ak-coding-level/SKILL.md").read_text(encoding="utf-8", errors="strict")
    if ".agentkit/config.yaml" not in coding_level_text or ".claude/.ck.json" in coding_level_text:
        errors.append("coding-level skill does not document the AgentKit YAML configuration")
    evidence.append("Git staging, Stitch runtime paths, and coding-level configuration contracts are hardened")

    advisor_text = (REPO_ROOT / ".codex/agents/advisor.toml").read_text(encoding="utf-8", errors="strict")
    if ".codex/skills/ak-advise/SKILL.md" not in advisor_text or advisor_text.index(".codex/skills") > advisor_text.index("~/.claude/skills"):
        errors.append("Codex advisor does not prioritize its project-local skill")
    ui_text = (REPO_ROOT / ".codex/agents/ui-ux-designer.toml").read_text(encoding="utf-8", errors="strict")
    if ".claude/skills/ak-ui-ux-pro-max" in ui_text or ".codex/skills/ak-ui-ux-pro-max" not in ui_text:
        errors.append("Codex UI agent contains a Claude-only skill command")
    researcher_text = (REPO_ROOT / ".codex/agents/researcher.toml").read_text(encoding="utf-8", errors="strict")
    if ".claude/skills/*" in researcher_text or ".codex/skills/*" not in researcher_text:
        errors.append("Codex researcher does not inspect its project-local skill catalog")
    context_text = (REPO_ROOT / ".codex/hooks/lib/context-builder.cjs").read_text(encoding="utf-8", errors="strict")
    subagent_text = (REPO_ROOT / ".codex/hooks/subagent-init.cjs").read_text(encoding="utf-8", errors="strict")
    session_text = (REPO_ROOT / ".codex/hooks/session-init.cjs").read_text(encoding="utf-8", errors="strict")
    if 'configDirName = ".codex"' not in context_text or "resolveSkillsVenv('.codex')" not in subagent_text:
        errors.append("Codex hook context does not default to the .codex adapter")
    if "Python scripts in .claude/skills" in context_text + subagent_text:
        errors.append("Codex hook context still injects a Claude-only skill path")
    if "path.join(process.cwd(), '.claude', 'skills', '.shadowed')" in session_text:
        errors.append("Codex session cleanup mutates another adapter's skill tree")

    # Codex hooks must be copy-safe.  The command itself is deliberately
    # self-contained: it asks Git for the repository root instead of relying on
    # a Claude-only environment variable or a developer's absolute path.
    hook_configs: dict[str, dict] = {}
    for relative, target_prefix in CODEX_HOOK_CONFIGS:
        config_path = REPO_ROOT / relative
        if not config_path.is_file():
            errors.append(f"Codex hook configuration is missing: {relative}")
            continue
        try:
            config = json.loads(config_path.read_text(encoding="utf-8", errors="strict"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            errors.append(f"Codex hook configuration is invalid JSON: {relative}: {exc}")
            continue
        hook_configs[relative] = config
        if not isinstance(config.get("description"), str) or "Git root" not in config["description"]:
            errors.append(f"Codex hook configuration lacks its Git-root portability contract: {relative}")
        handlers = list(iter_hook_handlers(config))
        if not handlers:
            errors.append(f"Codex hook configuration has no command handlers: {relative}")
        for event, matcher, handler in handlers:
            if handler.get("type") != "command":
                errors.append(f"Codex hook handler is not a command: {relative}:{event}")
                continue
            command = handler.get("command")
            if not isinstance(command, str) or not command.strip():
                errors.append(f"Codex hook command is empty: {relative}:{event}")
                continue
            if HOOK_BOOTSTRAP_MARKER not in command:
                errors.append(f"Codex hook command does not resolve from Git root: {relative}:{event}")
            if "${CLAUDE_PROJECT_DIR}" in command or "CLAUDE_PROJECT_DIR" in command:
                errors.append(f"Codex hook command relies on Claude-only project environment: {relative}:{event}")
            if ".claude" in command.lower() or re.search(r"[A-Za-z]:\\(?:Users|home)\\", command, re.IGNORECASE):
                errors.append(f"Codex hook command contains a foreign or developer-specific path: {relative}:{event}")
            if "usage-quota-cache-refresh.cjs" in command or "team-context-inject.cjs" in command:
                errors.append(f"Codex hook configuration enables a cross-runtime/global side effect: {relative}:{event}")
            if target_prefix.replace("/", "','") not in command:
                errors.append(f"Codex hook command targets the wrong adapter root: {relative}:{event}")
        evidence.append(f"{relative} has {len(handlers)} Git-root-resolved local command hooks")

    ownership_path = REPO_ROOT / "engineer/codex-ownership.json"
    if ownership_path.is_file():
        try:
            ownership = json.loads(ownership_path.read_text(encoding="utf-8", errors="strict"))
            ownership_ids = ownership.get("hook_ids", [])
            if not isinstance(ownership_ids, list) or not ownership_ids:
                errors.append("engineer/codex-ownership.json has no hook identities")
            elif any("${CLAUDE_PROJECT_DIR}" in str(value) or "git-root/engineer/.codex/hooks/" not in str(value) for value in ownership_ids):
                errors.append("engineer/codex-ownership.json contains stale/non-portable hook identities")
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            errors.append(f"engineer/codex-ownership.json is invalid JSON: {exc}")
    else:
        errors.append("engineer/codex-ownership.json is missing")

    scout_text = (REPO_ROOT / ".codex/hooks/scout-block.cjs").read_text(encoding="utf-8", errors="strict")
    if "projectConfigDirName: '.codex'" not in scout_text or ".codex/.ckignore" not in scout_text:
        errors.append("Codex scout hook does not use the project-local .codex/.ckignore override")
    readme_text = (REPO_ROOT / "README.md").read_text(encoding="utf-8", errors="strict")
    if 'Copy-Item -LiteralPath "$kitRoot\\AGENTS.md"' not in readme_text or "Codex tìm `AGENTS.md` theo cây thư mục" not in readme_text:
        errors.append("README minimal install does not establish the root AGENTS.md contract")
    gitignore_path = REPO_ROOT / ".gitignore"
    gitignore_text = gitignore_path.read_text(encoding="utf-8", errors="strict") if gitignore_path.is_file() else ""
    if ".codex/hooks/.logs/" not in gitignore_text:
        errors.append("Codex hook logs are not ignored and can pollute a copied project")
    evidence.append(f"{len(CODEX_PORTABILITY_PAIRS)} Codex adapter pairs are project-local and text-identical")

    ak_binary = shutil.which("ak")
    if ak_binary:
        resolved_prefs = subprocess.run(
            [ak_binary, "config", "prefs", "resolve", "--json"],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            encoding="utf-8",
            errors="strict",
            check=False,
        )
        try:
            prefs_payload = json.loads(resolved_prefs.stdout or "{}")
        except json.JSONDecodeError:
            prefs_payload = {}
        prefs = prefs_payload.get("prefs") if isinstance(prefs_payload, dict) else None
        expected_prefs = {
            "codingLevel": 4,
            "paths": {"docs": "docs", "plans": "plans"},
            "workflowArtifactGate": {"enabled": True},
        }
        if resolved_prefs.returncode != 0 or prefs != expected_prefs:
            errors.append("AgentKit config.yaml does not resolve to the documented portable preferences")
        else:
            evidence.append("AgentKit config.yaml resolves coding level, paths, and workflow gate through the ak CLI")
    else:
        evidence.append("AgentKit CLI is unavailable; portable config resolution was not exercised")

    node = shutil.which("node")
    if node is None:
        errors.append("Node.js is required to validate the active-plan wrapper")
    elif not ROOT_WRAPPER.is_file() or not ENGINEER_WRAPPER.is_file():
        errors.append("root or engineer active-plan wrapper is missing")
    elif digest(ROOT_WRAPPER) != digest(ENGINEER_WRAPPER):
        errors.append("root and engineer active-plan wrappers differ")
    else:
        with tempfile.TemporaryDirectory(prefix="agentkit project ü-") as temporary:
            project_root = Path(temporary)
            project_variables = ["CLAUDE_PROJECT_DIR", "CODEX_PROJECT_DIR", "CURSOR_PROJECT_DIR", "CK_PROJECT_ROOT"]
            base_env = os.environ.copy()
            for variable in project_variables + ["CK_SESSION_ID"]:
                base_env.pop(variable, None)
            hook_dir = project_root / ".codex/hooks"
            hook_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(REPO_ROOT / ".codex/hooks", hook_dir)
            hook_lib = hook_dir / "lib"
            shutil.copytree(
                REPO_ROOT / "engineer/.codex/hooks",
                project_root / "engineer/.codex/hooks",
            )
            git = shutil.which("git")
            if git is None:
                errors.append("Git is required to smoke-test Git-root-resolved Codex hooks")
            else:
                initialized = subprocess.run(
                    [git, "init", "--quiet"],
                    cwd=project_root,
                    text=True,
                    capture_output=True,
                    encoding="utf-8",
                    errors="strict",
                    env=base_env,
                    check=False,
                )
                if initialized.returncode != 0:
                    errors.append("temporary Codex hook project could not be initialized as a Git worktree")
            venv_python = project_root / ".codex/skills/.venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python3")
            venv_python.parent.mkdir(parents=True, exist_ok=True)
            venv_python.write_bytes(b"")
            resolved_venv = subprocess.run(
                [
                    node,
                    "-e",
                    "const c=require(process.argv[1]); process.stdout.write(c.resolveSkillsVenv() || '')",
                    str(hook_lib / "context-builder.cjs"),
                ],
                cwd=project_root,
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="strict",
                env=base_env,
                check=False,
            )
            if resolved_venv.returncode != 0 or not resolved_venv.stdout.startswith(".codex/skills/.venv/"):
                errors.append("Codex context builder did not resolve the project-local .codex skill environment")
            wrapper = project_root / ".agentkit/scripts/set-active-plan.cjs"
            wrapper.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT_WRAPPER, wrapper)
            plan_dir = project_root / "plans/20260813-1430-validator"
            plan_dir.mkdir(parents=True, exist_ok=True)
            (plan_dir / "plan.md").write_text("---\nstatus: pending\n---\n# validator fixture\n", encoding="utf-8")
            (plan_dir / "phase-01-validator.md").write_text("---\nphase: 1\n---\n# phase\n", encoding="utf-8")

            nested_cwd = project_root / "nested folder/child ü"
            nested_cwd.mkdir(parents=True, exist_ok=True)

            # Smoke real Codex-mirror scripts in a copied project.  This catches
            # the historical failure where a skill only searched .claude and
            # silently read the developer's parent directory instead of the
            # project's .codex adapter.
            portable_env = base_env.copy()
            for variable in list(portable_env):
                if SENSITIVE_ENV_NAME_RE.search(variable):
                    portable_env.pop(variable, None)
            for variable in ["AGENTKIT_ADAPTER", "AK_PORTABLE_ENV_SENTINEL", "SHOPIFY_API_KEY"]:
                portable_env.pop(variable, None)
            for relative in PORTABLE_RUNTIME_SKILL_FILES:
                source = REPO_ROOT / ".codex/skills" / relative
                target = project_root / ".codex/skills" / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
            (project_root / ".codex/.env").write_text(
                "AK_PORTABLE_ENV_SENTINEL=codex-adapter\nSHOPIFY_API_KEY=codex-shopify\n",
                encoding="utf-8",
            )
            styles_dir = project_root / "assets/writing-styles"
            styles_dir.mkdir(parents=True, exist_ok=True)
            (styles_dir / "example.md").write_text("# Copy-ready style\n", encoding="utf-8")

            def load_python_module(source: Path, expression: str) -> subprocess.CompletedProcess[str]:
                loader = (
                    "import importlib.util,json,sys;from pathlib import Path;"
                    "spec=importlib.util.spec_from_file_location('portable_module',sys.argv[1]);"
                    "module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);"
                    + expression
                )
                return subprocess.run(
                    [sys.executable, "-c", loader, str(source), str(project_root)],
                    cwd=project_root,
                    text=True,
                    capture_output=True,
                    encoding="utf-8",
                    errors="strict",
                    env=portable_env,
                    check=False,
                )

            copywriting = subprocess.run(
                [sys.executable, str(project_root / ".codex/skills/ak-copywriting/scripts/extract-writing-styles.py"), "--list", "--json"],
                cwd=nested_cwd,
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="strict",
                env=portable_env,
                check=False,
            )
            try:
                copywriting_payload = json.loads(copywriting.stdout or "{}")
            except json.JSONDecodeError:
                copywriting_payload = {}
            if (
                copywriting.returncode != 0
                or not any(file.get("name") == "example" for file in copywriting_payload.get("files", []))
                or not canonical_contains(copywriting_payload.get("directory", ""), project_root)
            ):
                errors.append("Codex copywriting script did not resolve project assets from a copied .codex adapter")

            better_auth = load_python_module(
                project_root / ".codex/skills/ak-better-auth/scripts/better_auth_init.py",
                "print(json.dumps(module.BetterAuthInit(project_root=Path(sys.argv[2]))._load_env_files().get('AK_PORTABLE_ENV_SENTINEL')))",
            )
            shopify = load_python_module(
                project_root / ".codex/skills/ak-shopify/scripts/shopify_init.py",
                "print(json.dumps(module.EnvLoader.load_config(Path(sys.argv[2]) / '.codex/skills/ak-shopify').shopify_api_key))",
            )
            repomix = load_python_module(
                project_root / ".codex/skills/ak-repomix/scripts/repomix_batch.py",
                "print(json.dumps(module.EnvLoader.load_env_files().get('AK_PORTABLE_ENV_SENTINEL')))",
            )
            design = load_python_module(
                project_root / ".codex/skills/ak-design/scripts/poster/core.py",
                "module.load_env();print(json.dumps(__import__('os').environ.get('AK_PORTABLE_ENV_SENTINEL')))",
            )
            docs_seeker = subprocess.run(
                [
                    node,
                    "-e",
                    "const loader=require(process.argv[1]);process.stdout.write(JSON.stringify(loader.getEnv('AK_PORTABLE_ENV_SENTINEL')))",
                    str(project_root / ".codex/skills/ak-docs-seeker/scripts/utils/env-loader.js"),
                ],
                cwd=project_root,
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="strict",
                env=portable_env,
                check=False,
            )
            (project_root / ".codex/.mcp.json").write_text(
                json.dumps({"mcpServers": {"chrome-devtools": {"command": "npx", "args": ["-y", "chrome-devtools-mcp@latest"]}}}),
                encoding="utf-8",
            )
            chrome = load_python_module(
                project_root / ".codex/skills/ak-chrome-profile/scripts/chrome_profile_cli.py",
                "print(json.dumps(module._load_mcp_config_summary()))",
            )
            script_checks = [
                ("better-auth", better_auth, "codex-adapter"),
                ("shopify", shopify, "codex-shopify"),
                ("repomix", repomix, "codex-adapter"),
                ("design", design, "codex-adapter"),
                ("docs-seeker", docs_seeker, "codex-adapter"),
            ]
            def parsed_scalar(check: subprocess.CompletedProcess[str]):
                try:
                    return json.loads(check.stdout or "null")
                except json.JSONDecodeError:
                    return None

            for label, check, expected in script_checks:
                actual = parsed_scalar(check)
                if check.returncode != 0 or actual != expected:
                    errors.append(
                        f"Codex copied {label} script did not load the active adapter .env: "
                        f"expected={expected!r}, actual={actual!r}, returncode={check.returncode}"
                    )
            try:
                chrome_payload = json.loads(chrome.stdout)
            except json.JSONDecodeError:
                chrome_payload = {}
            if chrome.returncode != 0 or not canonical_contains(chrome_payload.get("path", ""), project_root / ".codex"):
                errors.append("Codex Chrome profile script did not prefer the project-local .codex MCP config")
            bash = shutil.which("bash")
            if bash and subprocess.run(
                [bash, "-n", "engineer/skills/ak-cti-expert/scripts/install.sh"],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="strict",
                check=False,
            ).returncode != 0:
                errors.append("Codex CTI installer is not portable Bash syntax")
            mcp_client = (project_root / ".codex/skills/ak-use-mcp/scripts/mcp-client.ts").read_text(encoding="utf-8", errors="strict")
            if "defaultConfigPath" not in mcp_client or "return '.codex/.mcp.json'" not in mcp_client:
                errors.append("Codex MCP client does not have an adapter-aware default config path")
            evidence.append("Codex copied skill scripts resolved project assets, .env, MCP config, and Bash runtime paths")

            def run_command_hook(command: str, payload: dict, cwd: Path) -> subprocess.CompletedProcess[str]:
                if os.name == "nt":
                    # Let Python invoke COMSPEC with the command as one string;
                    # passing a quoted command as a list item makes CreateProcess
                    # escape the inner Node `-e` quotes before cmd can parse them.
                    shell_command: str | list[str] = command
                    use_shell = True
                else:
                    shell_command = [shutil.which("sh") or "sh", "-lc", command]
                    use_shell = False
                return subprocess.run(
                    shell_command,
                    shell=use_shell,
                    cwd=cwd,
                    input=json.dumps(payload, ensure_ascii=False),
                    text=True,
                    capture_output=True,
                    encoding="utf-8",
                    errors="strict",
                    env=base_env,
                    check=False,
                )

            smoke_plan = project_root / "plans/hook smoke/plan.md"
            smoke_plan.parent.mkdir(parents=True, exist_ok=True)
            smoke_plan.write_text(
                "| 1 | [phase-01-validator.md](./phase-01-validator.md) | Pending |\n",
                encoding="utf-8",
            )

            def hook_command(config: dict, event: str, filename: str) -> str | None:
                for event_name, _matcher, handler in iter_hook_handlers(config):
                    if event_name == event and filename in str(handler.get("command", "")):
                        return handler["command"]
                return None

            plan_payload = {
                "session_id": "validator-hook-smoke",
                "cwd": str(nested_cwd),
                "hook_event_name": "PostToolUse",
                "tool_name": "Edit",
                "tool_input": {"file_path": str(smoke_plan)},
            }
            for config_relative, _target_prefix in CODEX_HOOK_CONFIGS:
                config = hook_configs.get(config_relative)
                command = hook_command(config or {}, "PostToolUse", "plan-format-kanban.cjs")
                if not command:
                    errors.append(f"Codex hook smoke command is missing: {config_relative}")
                    continue
                smoked = run_command_hook(command, plan_payload, nested_cwd)
                try:
                    output = json.loads(smoked.stdout.strip() or "{}")
                except json.JSONDecodeError:
                    output = {}
                hook_specific = output.get("hookSpecificOutput") if isinstance(output, dict) else None
                if smoked.returncode != 0 or not isinstance(hook_specific, dict) or hook_specific.get("hookEventName") != "PostToolUse" or not hook_specific.get("additionalContext"):
                    errors.append(f"Codex PostToolUse hook failed nested Git-root smoke: {config_relative}")

            # Codex's apply_patch alias reports tool_name=apply_patch and puts
            # the patch text in tool_input.command.  Keep this canonical path
            # covered so plan-format warnings do not silently disappear on the
            # normal patch-based edit route.
            apply_patch_plan = project_root / "plans/hook smoke/plan.md"
            apply_patch_plan.write_text(
                "| Phase | File | Status |\n"
                "|---|---|---|\n"
                "| 01 | [phase-01-implementation.md](./phase-01-implementation.md) | Pending |\n",
                encoding="utf-8",
            )
            apply_patch_payload = {
                "session_id": "validator-apply-patch-smoke",
                "cwd": str(nested_cwd),
                "hook_event_name": "PostToolUse",
                "tool_name": "apply_patch",
                "tool_input": {
                    "command": (
                        "*** Begin Patch\n"
                        "*** Update File: plans/hook smoke/plan.md\n"
                        "@@\n"
                        "*** End Patch\n"
                    ),
                },
            }
            for config_relative, _target_prefix in CODEX_HOOK_CONFIGS:
                config = hook_configs.get(config_relative)
                command = hook_command(config or {}, "PostToolUse", "plan-format-kanban.cjs")
                if not command:
                    continue
                smoked = run_command_hook(command, apply_patch_payload, nested_cwd)
                try:
                    output = json.loads(smoked.stdout.strip() or "{}")
                except json.JSONDecodeError:
                    output = {}
                hook_specific = output.get("hookSpecificOutput") if isinstance(output, dict) else None
                if (
                    smoked.returncode != 0
                    or not isinstance(hook_specific, dict)
                    or hook_specific.get("hookEventName") != "PostToolUse"
                    or "human-readable" not in str(hook_specific.get("additionalContext", ""))
                ):
                    errors.append(f"Codex apply_patch plan-format smoke did not emit its warning: {config_relative}")
            evidence.append("Codex apply_patch PostToolUse plan-format warning passed from a nested cwd")
            evidence.append("Codex PostToolUse hook dispatch passed from a Unicode/space-containing nested cwd")

            def run_wrapper(selection: str, environment: dict[str, str]) -> subprocess.CompletedProcess[str]:
                return subprocess.run(
                    [node, str(wrapper), selection],
                    cwd=project_root,
                    text=True,
                    capture_output=True,
                    encoding="utf-8",
                    errors="strict",
                    env=environment,
                    check=False,
                )

            selections = [
                "plans/20260813-1430-validator",
                "plans/20260813-1430-validator/plan.md",
            ]
            environments: list[tuple[str, dict[str, str]]] = [("cwd", base_env.copy())]
            for variable in project_variables:
                environment = base_env.copy()
                environment[variable] = str(project_root)
                environments.append((variable, environment))
            stale_fallback = base_env.copy()
            stale_fallback["CLAUDE_PROJECT_DIR"] = str(project_root / "stale-claude-root")
            stale_fallback["CODEX_PROJECT_DIR"] = str(project_root)
            environments.append(("stale-Claude-to-Codex-fallback", stale_fallback))
            existing_stale_root = project_root / "existing-stale-project"
            shutil.copytree(REPO_ROOT / ".codex/hooks/lib", existing_stale_root / ".codex/hooks/lib")
            existing_stale = base_env.copy()
            existing_stale["CLAUDE_PROJECT_DIR"] = str(existing_stale_root)
            existing_stale["CODEX_PROJECT_DIR"] = str(project_root)
            environments.append(("existing-stale-Claude-to-installed-project", existing_stale))
            for environment_name, environment in environments:
                for selection in selections:
                    completed = run_wrapper(selection, environment)
                    if completed.returncode != 0 or "Validated active plan:" not in completed.stdout:
                        errors.append(f"active-plan wrapper rejected {environment_name} selection: {selection}")
                    if any(host in completed.stdout for host in [str(REPO_ROOT), str(project_root), str(Path.home())]):
                        errors.append("active-plan wrapper leaked an absolute host path")
            no_phase = project_root / "plans/no-phase-plan"
            no_phase.mkdir(parents=True)
            (no_phase / "plan.md").write_text("---\nstatus: pending\n---\n# no phase\n", encoding="utf-8")
            invalid_phase = run_wrapper("plans/no-phase-plan", base_env)
            if invalid_phase.returncode == 0 or "at least one real phase-NN-*.md" not in invalid_phase.stderr:
                errors.append("active-plan wrapper accepted a plan without a canonical phase file")
            missing_index = project_root / "plans/invalid-plan"
            missing_index.mkdir(parents=True)
            (missing_index / "phase-01-invalid.md").write_text("# phase\n", encoding="utf-8")
            invalid = run_wrapper("plans/invalid-plan", base_env)
            if invalid.returncode == 0 or "containing plan.md" not in invalid.stderr:
                errors.append("active-plan wrapper accepted a directory without plan.md")
            traversal = run_wrapper("../outside-plan", base_env)
            if traversal.returncode == 0 or "must be below" not in traversal.stderr:
                errors.append("active-plan wrapper did not reject parent traversal")
            exact_parent = run_wrapper("..", base_env)
            if exact_parent.returncode == 0 or "must be below" not in exact_parent.stderr:
                errors.append("active-plan wrapper accepted the exact parent directory")
            divergent_lib = project_root / ".claude/hooks/lib"
            shutil.copytree(hook_lib, divergent_lib)
            divergent_file = divergent_lib / "ck-config-utils.cjs"
            divergent_file.write_text(divergent_file.read_text(encoding="utf-8") + "\n// divergent\n", encoding="utf-8")
            divergent = run_wrapper(selections[0], base_env)
            if divergent.returncode == 0 or "hook mirrors differ" not in divergent.stderr:
                errors.append("active-plan wrapper accepted divergent hook mirrors")
            shutil.rmtree(project_root / ".claude")
            symlink_plan = project_root / "plans/symlink-phase-plan"
            symlink_plan.mkdir(parents=True)
            (symlink_plan / "plan.md").write_text("# symlink phase\n", encoding="utf-8")
            outside_phase = project_root / "outside-phase.md"
            outside_phase.write_text("# outside\n", encoding="utf-8")
            try:
                (symlink_plan / "phase-01-linked.md").symlink_to(outside_phase)
                linked = run_wrapper("plans/symlink-phase-plan", base_env)
                if linked.returncode == 0:
                    errors.append("active-plan wrapper accepted a symlinked phase file")
                else:
                    evidence.append("active-plan wrapper rejected a symlinked phase file")
            except OSError:
                evidence.append("phase symlink regression was capability-blocked on this host")
            ak = shutil.which("ak")
            if ak:
                for template_name in sorted(PLAN_INDEX_TEMPLATES):
                    cli_plan = project_root / "plans" / template_name.removesuffix("-template.md")
                    cli_plan.mkdir(parents=True)
                    shutil.copy2(PLAN_ROOT / template_name, cli_plan / "plan.md")
                    shutil.copy2(PLAN_ROOT / "phase-template.md", cli_plan / "phase-01-implementation.md")
                    validated = subprocess.run(
                        [ak, "plan", "validate", str(cli_plan), "--json", "--no-interactive"],
                        cwd=project_root,
                        text=True,
                        capture_output=True,
                        encoding="utf-8",
                        errors="strict",
                        env=base_env,
                        check=False,
                    )
                    if validated.returncode != 0:
                        errors.append(f"AgentKit CLI rejected template pair: {template_name}")
                evidence.append("installed AgentKit CLI accepted all three plan/phase template pairs")
            else:
                evidence.append("AgentKit CLI validation not run because ak is unavailable")
        evidence.append("active-plan wrapper parity, directory/file selection, redaction, and traversal checks passed")

    result = {
        "kind": "agentkit.project-assets-validation.v1",
        "valid": not errors,
        "errors": errors,
        "evidence": evidence,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
