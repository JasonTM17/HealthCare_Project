#!/usr/bin/env python3
"""Generate or verify the Engineer kit install manifest.

The manifest records SHA-256 hashes using canonical LF line endings for text
files. That keeps verification stable between Windows checkouts (CRLF) and
the Git/package source (LF).

Usage:
  python .agentkit/scripts/generate-install-manifest.py
  python .agentkit/scripts/generate-install-manifest.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


KIT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = KIT_ROOT / ".agentkit" / "install-manifest.json"
EXCLUDED_PATHS = {
    ".agentkit/install-manifest.json",
    "codex-ownership.json",
}
EXCLUDED_DIR_NAMES = {"__pycache__"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo"}


def canonical_bytes(file_path: Path) -> bytes:
    """Return bytes suitable for portable manifest hashing.

    Binary files are kept byte-for-byte. Text files use LF so Git checkouts
    with core.autocrlf do not appear corrupted solely due to line endings.
    """

    data = file_path.read_bytes()
    if b"\0" in data:
        return data
    try:
        text = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        # Invalid UTF-8 is binary for identity purposes.  Never decode with
        # replacement characters: distinct byte streams must remain distinct.
        return data
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def sha256(file_path: Path) -> str:
    return hashlib.sha256(canonical_bytes(file_path)).hexdigest()


def build_manifest(current: dict) -> dict:
    discovered = {}
    for file_path in sorted(KIT_ROOT.rglob("*")):
        if not file_path.is_file():
            continue
        relative = file_path.relative_to(KIT_ROOT)
        rel_path = relative.as_posix()
        if rel_path in EXCLUDED_PATHS:
            continue
        if any(part in EXCLUDED_DIR_NAMES for part in relative.parts):
            continue
        if file_path.suffix.lower() in EXCLUDED_SUFFIXES:
            continue
        discovered[rel_path] = sha256(file_path)

    # Keep existing order stable to make manifest diffs reviewable. Newly added
    # files are appended in lexical order; removed files disappear.
    files = []
    seen = set()
    for entry in current.get("files", []):
        rel_path = entry.get("rel_path")
        if rel_path in discovered and rel_path not in seen:
            files.append({"rel_path": rel_path, "sha256": discovered[rel_path]})
            seen.add(rel_path)
    for rel_path in sorted(set(discovered) - seen):
        files.append({"rel_path": rel_path, "sha256": discovered[rel_path]})

    skills_dir = KIT_ROOT / "skills"
    selected_skills = sorted(
        directory.name for directory in skills_dir.iterdir() if directory.is_dir()
    )

    return {
        "version": current.get("version", 1),
        "kit": current.get("kit", "engineer"),
        "kit_version": current.get("kit_version", "0.2.0"),
        "files": files,
        "skill_selection": {
            "mode": "all",
            "skills": selected_skills,
            "selected_count": len(selected_skills),
            "total_count": len(selected_skills),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when the existing manifest differs from the current kit",
    )
    args = parser.parse_args()

    current = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    expected = build_manifest(current)

    if args.check:
        if current != expected:
            print("install-manifest.json is out of date. Run this script without --check.")
            return 1
        print(f"install-manifest.json is valid ({len(expected['files'])} files).")
        return 0

    MANIFEST_PATH.write_bytes(
        (json.dumps(expected, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    )
    print(f"Wrote {MANIFEST_PATH} ({len(expected['files'])} files).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
