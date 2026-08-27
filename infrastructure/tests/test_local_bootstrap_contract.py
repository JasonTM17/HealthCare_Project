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


def test_isolated_verifier_accepts_backend_health_endpoint() -> None:
    script = (ROOT / "scripts" / "verify-local-mvp.ps1").read_text(encoding="utf-8")
    assert '[string]$BackendHealthUrl = "http://localhost:8080"' in script
    assert 'Invoke-RestMethod "$BackendHealthUrl/actuator/health"' in script


def test_local_verifier_records_booking_privacy_consent() -> None:
    script = (ROOT / "scripts" / "verify-local-mvp.ps1").read_text(encoding="utf-8")
    assert 'privacyConsent = $true' in script


def test_local_verifier_reads_current_mailpit_message_detail() -> None:
    script = (ROOT / "scripts" / "verify-local-mvp.ps1").read_text(encoding="utf-8")
    assert '[HealthCare] Xác nhận đặt lịch' in script
    assert '$MailpitApiUrl/api/v1/message/$($message.ID)' in script
    assert 'Wait-ForBookingOtp $hold.bookingCode "patient@healthcare.local" $holdStartedAt' in script


def test_backup_script_accepts_the_same_compose_environment_file() -> None:
    script = (ROOT / "scripts" / "backup-local-data.ps1").read_text(encoding="utf-8")
    assert '[string]$EnvFile = ""' in script
    assert '"--env-file", $envPath' in script
    assert 'Compose environment file does not exist' in script


def test_database_publication_binds_manual_attestation_to_workflow_ref() -> None:
    workflow = (ROOT / ".github" / "workflows" / "publish-database.yml").read_text(encoding="utf-8")
    assert 'GITHUB_SHA:-' in workflow
    assert 'must be launched with --ref equal to source_ref' in workflow
