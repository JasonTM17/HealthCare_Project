"""Static contracts for the canonical Render Free beta topology.

These tests validate repository intent only. Provider validation, deployment,
and live health probes remain separate evidence gates.
"""

from pathlib import Path
import re

import yaml


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIGEST = (
    "sha256:165ae73c81b1236c1e4499c1f75bf50"
    "cef2d387e92ef2bf22f95452cf1f8020d"
)
def _blueprint(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _services(path: Path = ROOT / "render.yaml") -> dict[str, dict]:
    return {service["name"]: service for service in _blueprint(path)["services"]}


def _env(service: dict) -> dict[str, dict]:
    return {entry["key"]: entry for entry in service.get("envVars", [])}


def _sql_without_line_comments(path: Path) -> str:
    return "\n".join(
        line.split("--", 1)[0] for line in path.read_text(encoding="utf-8").splitlines()
    )


def test_render_manifest_is_free_only() -> None:
    blueprint = _blueprint(ROOT / "render.yaml")
    services = _services()
    database = blueprint["databases"][0]
    assert database["name"] == "healthcare-beta-postgres"
    assert database["plan"] == "free"
    assert database["postgresMajorVersion"] == "16"
    assert database["user"] == "healthcare_beta_app_20260830r1"
    assert database["ipAllowList"] == []
    assert set(services) == {"healthcare-beta-redis", "healthcare-beta-backend"}
    assert all(service["plan"] == "free" for service in services.values())
    assert all(service["type"] != "pserv" for service in services.values())


def test_named_free_manifest_matches_canonical() -> None:
    assert _blueprint(ROOT / "render-free-beta.yaml") == _blueprint(ROOT / "render.yaml")


def test_render_manifest_uses_immutable_backend_image() -> None:
    services = _services()
    backend = services["healthcare-beta-backend"]
    assert backend["runtime"] == "image"
    assert backend["autoDeployTrigger"] == "off"
    assert backend["image"]["url"] == (
        "ghcr.io/jasontm17/healthcare-project-backend@" + BACKEND_DIGEST
    )
    image = backend["image"]["url"]
    assert "@sha256:" in image
    assert ":latest" not in image
    assert ":sha-" not in image
    assert backend["healthCheckPath"] == "/actuator/health"


def test_render_manifest_wires_managed_dependencies_and_fail_closed_switches() -> None:
    services = _services()
    backend = _env(services["healthcare-beta-backend"])
    assert backend["DATABASE_URL"]["fromDatabase"] == {
        "name": "healthcare-beta-postgres", "property": "connectionString"
    }
    assert backend["DATABASE_USERNAME"]["fromDatabase"]["property"] == "user"
    assert backend["DATABASE_PASSWORD"]["fromDatabase"]["property"] == "password"
    assert backend["REDIS_URL"]["fromService"] == {
        "type": "keyvalue", "name": "healthcare-beta-redis",
        "property": "connectionString"
    }
    for key in ("BFF_ALLOWED_ORIGINS", "JWT_SECRET", "BACKEND_BFF_SERVICE_TOKEN"):
        assert backend[key]["sync"] is False
    assert backend["BACKEND_BFF_REQUIRED"]["value"] == "true"
    assert backend["STORAGE_REQUIRE_PRIVATE_ENDPOINT"]["value"] == "false"
    assert backend["STORAGE_AV_REQUIRED"]["value"] == "false"
    assert backend["STORAGE_MIME_VALIDATION_REQUIRED"]["value"] == "true"
    assert backend["MANAGEMENT_HEALTH_MAIL_ENABLED"]["value"] == "false"
    assert backend["RAG_STORAGE_BACKEND"]["value"] == "memory"
    assert backend["CMS_DISTRIBUTED_REALTIME_ENABLED"]["value"] == "true"
    for key in (
        "AI_CHAT_REMOTE_PROVIDER_ENABLED", "AI_CHAT_SYMPTOM_TRIAGE_ENABLED",
        "AI_CHAT_HEALTH_EDUCATION_ENABLED", "AI_CHAT_SYNTHETIC_BETA_ASSERTED",
        "AI_CHAT_CHUNKED_ENABLED", "AI_RAG_INGEST_ENABLED", "APP_MAIL_ENABLED",
        "APP_MAIL_OUTBOX_ENABLED", "APP_PAYMENT_BANK_TRANSFER_ENABLED",
        "STORAGE_UPLOAD_ENABLED", "STORAGE_CONSULTATION_ENABLED",
    ):
        assert backend[key]["value"] == "false"
    for key in (
        "AI_SERVICE_URL", "AI_SERVICE_TOKEN", "SUPABASE_DB_URL",
        "STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY",
        "STORAGE_AV_SERVICE_URL", "STORAGE_AV_SERVICE_TOKEN",
        "STORAGE_CONSULTATION_KEY_SIGNING_SECRET",
    ):
        assert key not in backend
    assert "CORS_ALLOWED_ORIGINS" not in backend
    assert not any(key.startswith("NEXT_PUBLIC_") for key in backend)


def test_disabled_mail_does_not_break_render_health_probe() -> None:
    application = (ROOT / "apps/backend/src/main/resources/application.yml").read_text(
        encoding="utf-8"
    )
    assert "enabled: ${MANAGEMENT_HEALTH_MAIL_ENABLED:${APP_MAIL_ENABLED:false}}" in application


def test_hosted_catalog_seed_is_idempotent_and_non_clinical() -> None:
    seed = _sql_without_line_comments(ROOT / "infrastructure/database/seed-hosted-catalog.sql")
    normalized = seed.upper()
    insert_targets = {
        match.group(1).lower()
        for match in re.finditer(r"\bINSERT\s+INTO\s+([a-z_]+)", seed, re.IGNORECASE)
    }
    allowed = {
        "specialties", "branches", "doctors", "services", "packages", "articles",
        "faqs", "doctor_specialties", "doctor_branches", "doctor_schedules", "cms_contents",
    }
    assert normalized.strip().startswith("BEGIN;")
    assert normalized.strip().endswith("COMMIT;")
    assert insert_targets == allowed
    assert normalized.count("ON CONFLICT") == len(allowed)
    assert "PG_ADVISORY_XACT_LOCK" in normalized
    assert "HOSTED CATALOG SEED REFUSED" in normalized
    assert not re.search(r"\b(TRUNCATE|DELETE\s+FROM|DROP|ALTER)\b", normalized)
    assert not re.search(
        r"\b(users|customers|patient_profiles|appointments|medical_records|diagnostic_results|prescriptions)\b",
        normalized,
        re.IGNORECASE,
    )


def test_hosted_catalog_rollback_is_exact_snapshot_and_fail_closed() -> None:
    sql = _sql_without_line_comments(ROOT / "infrastructure/database/seed-hosted-catalog-rollback.sql")
    normalized = sql.upper()
    delete_targets = {
        match.group(1).lower()
        for match in re.finditer(r"\bDELETE\s+FROM\s+([a-z_]+)", sql, re.IGNORECASE)
    }
    assert normalized.strip().startswith("BEGIN;")
    assert normalized.strip().endswith("COMMIT;")
    assert "IN ACCESS EXCLUSIVE MODE" in normalized
    assert "PG_ADVISORY_XACT_LOCK" in normalized
    assert "EXPECTED_FINGERPRINT" in normalized
    assert "FINGERPRINT MISMATCH" in normalized
    assert "ROLLBACK REFUSED" in normalized
    assert "APPOINTMENTS" in normalized
    assert "MEDICAL_RECORDS" in normalized
    assert "PATIENT_CONSULTATION_THREADS" in normalized
    assert "DOCTOR_SCHEDULE_EXCEPTIONS" in normalized
    assert delete_targets == {
        "specialties", "branches", "doctors", "services", "packages", "articles",
        "faqs", "doctor_specialties", "doctor_branches", "doctor_schedules",
        "cms_contents", "cms_content_changes",
    }
    assert "TRUNCATE" not in normalized
    assert "CASCADE" not in normalized
    assert "FLYWAY_SCHEMA_HISTORY" not in normalized
