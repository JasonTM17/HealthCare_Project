"""Security contracts for the optional Supabase clinical-knowledge CLI."""

from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
import sys


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "supabase" / "tools" / "deploy_clinical_knowledge_supabase.py"


def test_deploy_cli_has_no_embedded_database_credential() -> None:
    source = SCRIPT.read_text(encoding="utf-8")

    assert not re.search(
        r"postgres(?:ql)?://[^\s:@]+:[^\s@]+@",
        source,
        flags=re.IGNORECASE,
    )
    assert 'DEFAULT_DSN = os.environ.get("SUPABASE_DB_URL", "").strip()' in source


def test_non_dry_run_requires_explicit_database_url() -> None:
    environment = os.environ.copy()
    environment.pop("SUPABASE_DB_URL", None)

    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=REPO_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    assert "explicit database URL" in result.stderr


def test_database_enrichment_commits_only_after_verification() -> None:
    source = SCRIPT.read_text(encoding="utf-8")

    assert "psycopg.connect(dsn, autocommit=False" in source
    verification_marker = 'print("\\nTesting vector retrieval via match_chat_documents...")'
    assert source.index("conn.commit()") > source.index(verification_marker)
