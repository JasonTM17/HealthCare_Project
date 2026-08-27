from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_local_bootstrap_generates_all_required_compose_secrets() -> None:
    script = (ROOT / "scripts" / "start-and-verify-local-mvp.ps1").read_text(encoding="utf-8")
    block_start = script.index('foreach ($requiredSecret')
    block_end = script.index('    # This explicit local-only preparation', block_start)
    block = script[block_start:block_end]
    assert "New-DisposableSecret" in block
    for key in (
        "APP_MAIL_OUTBOX_ENCRYPTION_KEY",
        "BACKEND_BFF_SERVICE_TOKEN",
        "STORAGE_AV_SERVICE_TOKEN",
    ):
        marker = f'Key = "{key}"'
        assert marker in block
