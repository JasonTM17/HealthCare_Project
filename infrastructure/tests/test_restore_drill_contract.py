from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _drill_script() -> str:
    return (ROOT / "scripts" / "restore-drill.ps1").read_text(encoding="utf-8")


def _document_migration() -> str:
    return (
        ROOT
        / "apps"
        / "backend"
        / "src"
        / "main"
        / "resources"
        / "db"
        / "migration"
        / "V71__patient_synthetic_documents.sql"
    ).read_text(encoding="utf-8")


def test_restore_drill_script_exists_and_is_strict() -> None:
    script = _drill_script()
    assert "Set-StrictMode -Version Latest" in script
    assert '$ErrorActionPreference = "Stop"' in script


def test_restore_drill_uses_unique_disposable_containers_on_isolated_loopback_ports() -> None:
    script = _drill_script()
    # Per-run GUID container names cannot collide with the primary Compose
    # project or a concurrent drill run.
    assert "[guid]::NewGuid()" in script
    assert '"healthcare-restore-drill-$drillId-postgres"' in script
    assert '"healthcare-restore-drill-$drillId-minio"' in script
    # Host ports are ephemeral OS-assigned loopback ports, never the primary
    # Compose host ports.
    assert "Get-FreeLoopbackPort" in script
    assert '"-p", "127.0.0.1:${pgPort}:5432"' in script
    assert '"-p", "127.0.0.1:${minioPort}:9000"' in script
    # Drill image defaults must match the primary Compose images so the
    # restored engine is the one that produced the snapshot.
    compose = (ROOT / "infrastructure" / "docker-compose.yml").read_text(encoding="utf-8")
    primary_postgres_image = next(
        line.split("image: ", 1)[1].strip()
        for line in compose.splitlines()
        if line.strip().startswith("image: postgres:")
    )
    primary_minio_image = next(
        line.split("image: ", 1)[1].strip()
        for line in compose.splitlines()
        if line.strip().startswith("image: minio/minio:")
    )
    assert f'$PostgresImage = "{primary_postgres_image}"' in script
    assert f'$MinioImage = "{primary_minio_image}"' in script


def test_restore_drill_never_drives_the_primary_compose_project_or_snapshot() -> None:
    script = _drill_script()
    # The drill only speaks plain `docker run/cp/exec/rm`; the primary Compose
    # project and its named volumes are unreachable by construction.
    assert '"compose"' not in script
    assert "docker-compose" not in script
    # `-T` belongs to `docker compose exec`, not plain `docker exec`.
    assert '"exec", "-T"' not in script
    # MinIO starts from a scratch copy under the drill workspace, never from
    # the snapshot directory itself.
    assert 'Join-Path $workRoot "minio-restore"' in script
    assert '"-v", "$($minioWorkData -replace \'\\\\\', \'/\'):/data"' in script


def test_restore_drill_verifies_snapshot_hashes_and_relational_integrity() -> None:
    script = _drill_script()
    assert "manifest.json" in script
    assert "Get-FileHash" in script
    assert "SHA256" in script
    assert "sha256" in script
    assert '--dbname=`"`$POSTGRES_DB`" --username=`"`$POSTGRES_USER`"' in script
    assert 'StartsWith("minio-data/.minio.sys/tmp/"' in script
    assert "$stableMinioSnapshotEntries" in script
    for table in ("users", "patient_profiles", "doctors", "branches", "specialties", "appointments", "medical_records"):
        assert table in script
    assert (
        "SELECT count(*) FROM appointments a LEFT JOIN patient_profiles p "
        "ON p.id = a.patient_id WHERE p.id IS NULL"
    ) in script
    assert (
        "SELECT count(*) FROM patient_profiles pp LEFT JOIN users u "
        "ON u.id = pp.user_id WHERE pp.user_id IS NOT NULL AND u.id IS NULL"
    ) in script
    assert "orphan row" in script
    assert "Restored MinIO is missing snapshot object file" in script


def test_restore_drill_reconciles_patient_document_metadata_to_minio_objects() -> None:
    script = _drill_script()
    assert '$StorageBucket = "healthcare-files"' in script
    assert "SELECT to_regclass('public.patient_documents') IS NOT NULL" in script
    assert "SELECT to_regclass('public.patient_document_object_cleanup') IS NOT NULL" in script
    assert '$coreTables += "patient_document_object_cleanup"' in script
    assert "patient_documents.patient_id -> patient_profiles.id" in script
    assert "patient_documents.generated_by -> users.id" in script
    assert "WHERE status IN ('AVAILABLE', 'SUPERSEDED', 'REVOKED')" in script
    assert "^documents/[A-Za-z0-9._/-]+$" in script
    assert '"mc", "alias", "set", "restore"' in script
    assert '"mc", "ready", "restore"' in script
    assert "mc cat --quiet" in script
    assert "sha256sum" in script
    assert "wc -c" in script
    assert "| sha256sum" not in script
    assert "Restored document object hash mismatch" in script
    assert "Restored document object byte-size mismatch" in script
    assert "Document restore reconciliation PASS" in script


def test_patient_document_migration_enforces_object_backed_metadata() -> None:
    migration = _document_migration()
    assert "patient_documents_object_key_safe" in migration
    assert "object_key LIKE 'documents/%'" in migration
    assert "object_key NOT LIKE '%..%'" in migration
    assert "object_key NOT LIKE '%//%'" in migration
    assert "position(chr(92) in object_key) = 0" in migration
    assert "patient_documents_object_metadata_by_status" in migration
    assert "status IN ('AVAILABLE', 'SUPERSEDED', 'REVOKED')" in migration
    assert "sha256 ~ '^[0-9a-f]{64}$'" in migration
    assert "byte_size > 0" in migration
    assert "status IN ('PENDING', 'FAILED')" in migration
    assert "sha256 IS NULL" in migration
    assert "byte_size IS NULL" in migration


def test_restore_drill_reports_rpo_rto_and_always_tears_down() -> None:
    script = _drill_script()
    assert "RPO (snapshot age at drill start)" in script
    assert "RTO (measured restore-drill elapsed time)" in script
    assert "RESTORE DRILL PASS" in script
    # Teardown lives in `finally`, removes the containers with their anonymous
    # volumes, and deletes the scratch workspace even when a check fails.
    assert "} finally {" in script
    assert "docker rm -f -v" in script
    assert "Remove-Item -LiteralPath $workRoot -Recurse -Force" in script
