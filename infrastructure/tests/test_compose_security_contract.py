from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]


def test_compose_keeps_attachment_scanner_private_and_fail_closed() -> None:
    compose = yaml.safe_load(
        (ROOT / "infrastructure" / "docker-compose.yml").read_text(encoding="utf-8")
    )
    services = compose["services"]

    clamav = services["clamav"]
    assert clamav["image"] == (
        "clamav/clamav@sha256:"
        "761f6c99b8d9134b39431f8c200189cda749b17310091561bfa8b732f32bfada"
    )
    assert "ports" not in clamav

    scanner = services["attachment-scanner"]
    assert "ports" not in scanner
    assert scanner["environment"]["SCANNER_SERVICE_TOKEN"].endswith(
        "STORAGE_AV_SERVICE_TOKEN is required}"
    )
    assert scanner["depends_on"]["clamav"]["condition"] == "service_healthy"

    backend = services["backend"]
    backend_env = backend["environment"]
    assert backend_env["SPRING_MAIL_HOST"] == "mailpit"
    assert backend_env["SPRING_MAIL_PORT"] == "1025"
    assert backend_env["STORAGE_UPLOAD_ENABLED"].endswith(":-false}")
    assert backend_env["STORAGE_CONSULTATION_ENABLED"].endswith(":-false}")
    assert backend_env["STORAGE_AV_REQUIRED"] == "true"
    assert backend_env["STORAGE_AV_SERVICE_URL"] == "http://attachment-scanner:8080/scan"
    assert backend_env["STORAGE_AV_SERVICE_TOKEN"].endswith(
        "STORAGE_AV_SERVICE_TOKEN is required}"
    )
    assert backend_env["STORAGE_AV_ALLOWED_HOSTS"] == "attachment-scanner"
    assert backend_env["STORAGE_MIME_VALIDATION_REQUIRED"] == "true"
    assert backend["depends_on"]["attachment-scanner"]["condition"] == "service_healthy"

    assert backend_env["APP_AUTH_OTP_WINDOW_SECONDS"].endswith(":-900}")
    assert backend_env["APP_AUTH_OTP_IP_LIMIT"].endswith(":-20}")
    assert backend_env["APP_AUTH_OTP_EMAIL_LIMIT"].endswith(":-5}")
    assert backend_env["APP_SECURITY_RATE_LIMIT_REDIS_REQUIRED"].endswith(":-true}")

    minio_ports = services["minio"]["ports"]
    assert all(str(port).startswith("127.0.0.1:") for port in minio_ports)
    for service in ("postgres", "backend", "frontend"):
        assert all(str(port).startswith("127.0.0.1:") for port in services[service]["ports"])


def test_compose_ai_defaults_keep_remote_path_killed_and_rag_fail_closed() -> None:
    compose = yaml.safe_load(
        (ROOT / "infrastructure" / "docker-compose.yml").read_text(encoding="utf-8")
    )
    ai_env = compose["services"]["ai-service"]["environment"]
    assert ai_env["REMOTE_AI_KILL_SWITCH"].endswith(":-true}")
    assert ai_env["SUPABASE_RAG_FALLBACK_TO_MEMORY"].endswith(":-false}")
    assert ai_env["RAG_INGEST_ENABLED"].endswith(":-false}")

    backend_env = compose["services"]["backend"]["environment"]
    assert backend_env["AI_RAG_INGEST_ENABLED"].endswith(":-false}")

    example = (ROOT / ".env.example").read_text(encoding="utf-8")
    assert "RAG_INGEST_ENABLED=false" in example
    assert "AI_RAG_INGEST_ENABLED=false" in example
    assert "STORAGE_UPLOAD_ENABLED=false" in example
    assert "STORAGE_CONSULTATION_ENABLED=false" in example
    assert "APP_SECURITY_RATE_LIMIT_REDIS_REQUIRED=false" in example


def test_local_bootstrap_requires_private_bucket_and_encrypted_outbox() -> None:
    compose = yaml.safe_load(
        (ROOT / "infrastructure" / "docker-compose.yml").read_text(encoding="utf-8")
    )
    services = compose["services"]
    backend = services["backend"]
    assert backend["environment"]["APP_MAIL_OUTBOX_ENABLED"] == "true"
    assert backend["environment"]["APP_MAIL_OUTBOX_ENCRYPTION_KEY"].endswith(
        "APP_MAIL_OUTBOX_ENCRYPTION_KEY is required}"
    )
    assert backend["environment"]["STORAGE_PUBLIC_ENDPOINT"].endswith(":-http://127.0.0.1:9000}")
    assert backend["environment"]["STORAGE_REGION"].endswith(":-us-east-1}")
    assert backend["depends_on"]["minio-init"]["condition"] == "service_completed_successfully"
    bootstrap = services["minio-init"]
    assert bootstrap["restart"] == "no"
    assert "mc anonymous set none" in bootstrap["command"][0]
    assert "mc anonymous set public" not in bootstrap["command"][0]
    assert "*" not in services["minio"]["environment"]["MINIO_API_CORS_ALLOW_ORIGIN"]
    assert services["frontend"]["depends_on"]["local-seed"]["condition"] == "service_completed_successfully"


def test_compose_default_network_is_egress_isolated() -> None:
    compose = yaml.safe_load((ROOT / "infrastructure" / "docker-compose.yml").read_text(encoding="utf-8"))
    assert compose["networks"]["default"]["internal"] is True
    assert compose["services"]["ai-service"]["networks"] == ["default"]
    for service in ("backend", "frontend", "postgres", "redis", "mailpit", "minio"):
        assert set(compose["services"][service]["networks"]) == {"default", "edge"}
    assert compose["networks"]["edge"]["driver"] == "bridge"
