from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_local_bootstrap_generates_all_required_compose_secrets() -> None:
    script = (ROOT / "scripts" / "start-and-verify-local-mvp.ps1").read_text(encoding="utf-8")
    block_start = script.index('foreach ($requiredSecret')
    block_end = script.index('if ($prepareEnvironment -or $environmentChanged)', block_start)
    block = script[block_start:block_end]
    assert "New-DisposableSecret" in block
    for key in (
        "APP_MAIL_OUTBOX_ENCRYPTION_KEY",
        "BACKEND_BFF_SERVICE_TOKEN",
        "STORAGE_AV_SERVICE_TOKEN",
    ):
        marker = f'Key = "{key}"'
        assert marker in block


def test_local_bootstrap_repairs_required_secrets_when_existing_env_is_reused() -> None:
    script = (ROOT / "scripts" / "start-and-verify-local-mvp.ps1").read_text(encoding="utf-8")
    assert "$environmentChanged = $false" in script
    assert "if ($prepareEnvironment -or $environmentChanged)" in script
    assert "Added missing disposable Compose secrets to the existing local .env." in script
    required_loop = script.index('foreach ($requiredSecret')
    prepare_branch = script.index("$prepareEnvironment =")
    assert required_loop > prepare_branch


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
    assert '$content -notmatch [regex]::Escape($BookingCode)' in script
    assert '"attachment-scanner"' in script
    assert 'MIME mismatch upload was not rejected' in script
    assert 'AV infected upload was not rejected' in script
    assert 'TryAddWithoutValidation("Authorization", "Bearer $Token")' in script
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


def test_application_publication_binds_manual_attestation_and_tag_immutability() -> None:
    workflow = (ROOT / ".github" / "workflows" / "publish-images.yml").read_text(encoding="utf-8")
    assert 'GITHUB_EVENT_NAME:-' in workflow
    assert 'must be launched with --ref equal to source_ref' in workflow
    assert 'Reject an existing immutable tag' in workflow
    assert '\n  push:' not in workflow
    assert 'group: beta-images-${{ github.event.inputs.source_ref || github.sha }}' in workflow


def test_database_publication_rejects_immutable_tag_replacement() -> None:
    workflow = (ROOT / ".github" / "workflows" / "publish-database.yml").read_text(encoding="utf-8")
    assert "Reject an existing immutable database SHA tag" in workflow
    assert "Verify published database digest and immutable SHA tag" in workflow
    assert "group: beta-database-${{ github.event.inputs.source_ref || github.sha }}" in workflow


def test_production_env_requires_fail_closed_attachment_scanning() -> None:
    script = (ROOT / "scripts" / "validate-production-env.ps1").read_text(encoding="utf-8")
    assert 'Require-Boolean "STORAGE_AV_REQUIRED" $true' in script
    assert 'Require-TrustedScannerEndpoint' in script
    assert 'Require-Value "STORAGE_AV_ALLOWED_HOSTS"' in script
    assert 'Require-Secret "STORAGE_AV_SERVICE_TOKEN" 32' in script
    assert 'Require-Boolean "STORAGE_MIME_VALIDATION_REQUIRED" $true' in script
