"""Static contracts for the canonical Render Free beta topology.

These tests validate repository intent only. Provider validation, deployment,
and live health probes remain separate evidence gates.
"""

from pathlib import Path
import re

import yaml


ROOT = Path(__file__).resolve().parents[2]
# Digest of the backend image published by publish-images for the current
# release line, built from 019dbd56 (profile-less account setup contract on
# top of the 25227993 display-name sync line).
# Update together with the blueprint when a new image is released.
BACKEND_DIGEST = (
    "sha256:4cde960998676b99a06649012267f37b00c4caf10db5eb598afaacc4846fef75"
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
    assert set(services) == {
        "healthcare-beta-redis", "healthcare-beta-ai", "healthcare-beta-backend"
    }
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


def test_render_manifest_runs_the_deepseek_ai_service_on_free() -> None:
    ai = _services()["healthcare-beta-ai"]
    assert ai["runtime"] == "python"
    assert ai["plan"] == "free"
    assert ai["region"] == "singapore"
    assert ai["autoDeployTrigger"] == "off"
    assert ai["healthCheckPath"] == "/livez"
    assert "pip install --no-cache-dir -r apps/ai-service/requirements.txt" in ai["buildCommand"]
    assert "uvicorn app.main:app" in ai["startCommand"]
    ai_env = _env(ai)
    assert ai_env["AI_PROVIDER"]["value"] == "deepseek"
    assert ai_env["AI_CHAT_MODEL"]["value"] == "deepseek-flash"
    assert ai_env["AI_BASE_URL"]["value"] == "https://api.deepseek.com"
    assert ai_env["EMBEDDING_PROVIDER"]["value"] == "local"
    assert ai_env["RAG_STORAGE_BACKEND"]["value"] == "supabase"
    assert ai_env["RAG_INGEST_ENABLED"]["value"] == "true"
    assert ai_env["AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED"]["value"] == "true"
    # Post-2026-10-07 env-wipe posture: both tokens are API-managed shared
    # secrets (generateValue output was unrecoverable).
    assert ai_env["AI_SERVICE_TOKEN"]["sync"] is False
    assert ai_env["RAG_INGEST_TOKEN"]["sync"] is False
    # [L2 2026-09-30] Patient remote egress ON — one atomic set with the
    # backend AI_CHAT_REMOTE_PROVIDER_ENABLED flip (release commit 7bdbd52):
    # patient flag + release hold + synthetic-only off. The ai-service copy of
    # AI_CHAT_REMOTE_PROVIDER_ENABLED stays "false": it is read only by the
    # boot validator (app/config.py), not by routing.
    assert ai_env["AI_PATIENT_CHAT_REMOTE_ENABLED"]["value"] == "true"
    assert ai_env["REMOTE_AI_RELEASE_HOLD"]["value"] == "true"
    assert ai_env["REMOTE_AI_SYNTHETIC_ONLY"]["value"] == "false"
    assert ai_env["AI_CHAT_REMOTE_PROVIDER_ENABLED"]["value"] == "false"
    # [L1] Cross-warmer ai→backend must stay enabled: without this key the
    # startup hook in app/main.py self-disables and the warm chain is one-way.
    assert ai_env["BACKEND_WARM_URL"]["value"] == (
        "https://healthcare-backup-backend-oqv4.onrender.com/actuator/health"
    )


def test_render_manifest_wires_managed_dependencies_and_fail_closed_switches() -> None:
    services = _services()
    backend = _env(services["healthcare-beta-backend"])
    # 2026-10-07: healthcare-beta-postgres no longer exists and the stale
    # fromDatabase materialization kept resolving to the decommissioned
    # Supabase user; DATABASE_* plus the SPRING_DATASOURCE_* relaxed-binding
    # override are now dashboard/API-managed secrets (see render.yaml comment).
    for key in (
        "DATABASE_URL", "DATABASE_USERNAME", "DATABASE_PASSWORD",
        "SPRING_DATASOURCE_URL", "SPRING_DATASOURCE_USERNAME",
        "SPRING_DATASOURCE_PASSWORD",
    ):
        assert backend[key]["sync"] is False
    # healthcare-beta-redis lives in a different workspace; REDIS_URL is a
    # dashboard/API-managed internal connection string.
    assert backend["REDIS_URL"]["sync"] is False
    for key in ("BFF_ALLOWED_ORIGINS", "JWT_SECRET", "BACKEND_BFF_SERVICE_TOKEN"):
        assert backend[key]["sync"] is False
    assert backend["BACKEND_BFF_REQUIRED"]["value"] == "true"
    assert backend["STORAGE_REQUIRE_PRIVATE_ENDPOINT"]["value"] == "false"
    assert backend["STORAGE_AV_REQUIRED"]["value"] == "false"
    assert backend["STORAGE_MIME_VALIDATION_REQUIRED"]["value"] == "true"
    assert backend["MANAGEMENT_HEALTH_MAIL_ENABLED"]["value"] == "false"
    assert backend["RAG_STORAGE_BACKEND"]["value"] == "memory"
    assert backend["AI_SERVICE_URL"]["value"] == "https://healthcare-beta-ai-9mip.onrender.com"
    # Shared-secret pair set verbatim on both services after the env wipe
    # (generateValue secrets could not be recovered through the API).
    assert backend["AI_SERVICE_TOKEN"]["sync"] is False
    assert backend["AI_RAG_INGEST_TOKEN"]["sync"] is False
    assert backend["AI_RAG_INGEST_ENABLED"]["value"] == "true"
    assert backend["CMS_DISTRIBUTED_REALTIME_ENABLED"]["value"] == "true"
    # Clinical chat modes went live after the grounded catalog + rule-based
    # triage pipeline proved safe; keep them pinned ON in the blueprint.
    assert backend["AI_CHAT_SYMPTOM_TRIAGE_ENABLED"]["value"] == "true"
    assert backend["AI_CHAT_HEALTH_EDUCATION_ENABLED"]["value"] == "true"
    for key in (
        "AI_CHAT_SYNTHETIC_BETA_ASSERTED",
        "AI_CHAT_CHUNKED_ENABLED",
        "APP_MAIL_OUTBOX_ENABLED", "APP_PAYMENT_BANK_TRANSFER_ENABLED",
        "STORAGE_UPLOAD_ENABLED", "STORAGE_CONSULTATION_ENABLED",
    ):
        assert backend[key]["value"] == "false"
    # Transactional mail is live through the Resend HTTPS API (Render Free
    # cannot reach outbound SMTP). The sender domain is verified in the
    # Resend account; the API key is a dashboard-managed secret.
    assert backend["APP_MAIL_ENABLED"]["value"] == "true"
    assert backend["APP_MAIL_FROM"]["value"] == "no-reply@healthcare.id.vn"
    assert backend["APP_MAIL_PORTAL_BASE_URL"]["value"] == "https://www.healthcare.id.vn"
    assert backend["RESEND_API_KEY"]["sync"] is False
    # [L2 2026-09-30] Patient egress flip (commit 7bdbd52): the Spring-side
    # provenance gate now accepts remote_provider on the patient path. Paired
    # atomically with the ai-service keys asserted in the ai test above; the
    # deploy order (backend first) is recorded in the commit message because
    # an ai-service emitting remote_provider against an old backend 502s the
    # turn AFTER the provider call was spent.
    assert backend["AI_CHAT_REMOTE_PROVIDER_ENABLED"]["value"] == "true"
    # Clinical PDF storage is server-side only: endpoint/region/bucket are
    # non-secret posture, the access key pair is a dashboard-managed secret.
    # storage.backend=supabase selects the REST adapter because the Supabase
    # S3 endpoint requires a /storage/v1/s3 path the MinIO client rejects.
    assert backend["STORAGE_BACKEND"]["value"] == "supabase"
    assert backend["STORAGE_REGION"]["value"] == "ap-northeast-1"
    assert backend["STORAGE_BUCKET"]["value"] == "healthcare-files"
    for key in (
        "STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY",
        "STORAGE_SESSION_TOKEN",
    ):
        assert backend[key]["sync"] is False
    for key in (
        "SUPABASE_DB_URL",
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
