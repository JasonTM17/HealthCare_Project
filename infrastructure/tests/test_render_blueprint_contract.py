from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
IMAGE_DIGESTS = {
    "healthcare-beta-ai": "sha256:0975fc41d617633107b65f522eee6c3b9badf15297c1f06364903184c3680856",
    "healthcare-beta-backend": "sha256:ff7a2d6a5df501ec07d7ba5cd6519a67912a217da1e157635b03e1ecb5c383ea",
    "healthcare-beta-av-scanner": "sha256:1db60a438d13d4a0952c5566e98779d41ddcac651f3fd2ba8876f244c440322d",
}
CLAMAV_IMAGE = (
    "clamav/clamav@sha256:"
    "761f6c99b8d9134b39431f8c200189cda749b17310091561bfa8b732f32bfada"
)


def _services_by_name() -> dict[str, dict]:
    blueprint = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    return {service["name"]: service for service in blueprint["services"]}


def _env_by_key(service: dict) -> dict[str, dict]:
    return {entry["key"]: entry for entry in service.get("envVars", [])}


def test_render_blueprint_uses_prebuilt_immutable_ghcr_images() -> None:
    services = _services_by_name()

    images = {
        "healthcare-beta-ai": "healthcare-project-ai-service",
        "healthcare-beta-backend": "healthcare-project-backend",
        "healthcare-beta-av-scanner": "healthcare-project-attachment-scanner",
    }
    for service_name, image_name in images.items():
        service = services[service_name]
        assert service["runtime"] == "image"
        assert "dockerfilePath" not in service
        assert "dockerContext" not in service
        image_url = service["image"]["url"]
        assert image_url == f"ghcr.io/jasontm17/{image_name}@{IMAGE_DIGESTS[service_name]}"
        assert "@sha256:" in image_url


def test_render_blueprint_makes_compute_cost_boundary_explicit() -> None:
    services = _services_by_name()

    # The backend can run as a Free web service for the beta. Render private
    # services have no Free compute tier, so keep the smallest paid plan
    # explicit instead of relying on a provider default.
    assert services["healthcare-beta-backend"]["plan"] == "free"
    for service_name in (
        "healthcare-beta-ai",
        "healthcare-beta-clamav",
        "healthcare-beta-av-scanner",
    ):
        service = services[service_name]
        assert service["type"] == "pserv"
        assert service["plan"] == "0.5c-512mb"


def test_render_application_image_pins_are_immutable_digest_references() -> None:
    services = _services_by_name()
    for service_name in IMAGE_DIGESTS:
        image_url = services[service_name]["image"]["url"]
        assert image_url.endswith(f"@{IMAGE_DIGESTS[service_name]}")
        assert ":sha-" not in image_url


def test_render_blueprint_provisions_private_attachment_scanner() -> None:
    services = _services_by_name()
    clamav = services["healthcare-beta-clamav"]
    scanner = services["healthcare-beta-av-scanner"]
    backend_env = _env_by_key(services["healthcare-beta-backend"])
    scanner_env = _env_by_key(scanner)

    assert clamav["type"] == "pserv"
    assert clamav["runtime"] == "image"
    assert clamav["image"]["url"] == CLAMAV_IMAGE
    assert scanner["type"] == "pserv"
    assert scanner["runtime"] == "image"
    assert scanner_env["SCANNER_SERVICE_TOKEN"]["sync"] is False
    assert scanner_env["CLAMD_HOST"]["fromService"] == {
        "type": "pserv",
        "name": "healthcare-beta-clamav",
        "property": "host",
    }
    assert scanner_env["CLAMD_PORT"]["value"] == "3310"

    assert backend_env["STORAGE_AV_REQUIRED"]["value"] == "true"
    assert backend_env["STORAGE_AV_SERVICE_URL"]["fromService"] == {
        "type": "pserv",
        "name": "healthcare-beta-av-scanner",
        "property": "hostport",
    }
    assert backend_env["STORAGE_AV_ALLOWED_HOSTS"]["fromService"] == {
        "type": "pserv",
        "name": "healthcare-beta-av-scanner",
        "property": "host",
    }
    assert backend_env["STORAGE_AV_SERVICE_TOKEN"]["fromService"] == {
        "type": "pserv",
        "name": "healthcare-beta-av-scanner",
        "envVarKey": "SCANNER_SERVICE_TOKEN",
    }
    assert backend_env["STORAGE_MIME_VALIDATION_REQUIRED"]["value"] == "true"


def test_render_ai_ingestion_is_explicitly_fail_closed() -> None:
    services = _services_by_name()
    ai_env = _env_by_key(services["healthcare-beta-ai"])
    assert ai_env["RAG_INGEST_ENABLED"]["value"] == "false"
    assert "RAG_INGEST_TOKEN" not in ai_env


def test_render_backend_requires_the_shared_redis_rate_limiter() -> None:
    services = _services_by_name()
    backend_env = _env_by_key(services["healthcare-beta-backend"])
    assert backend_env["APP_SECURITY_RATE_LIMIT_REDIS_REQUIRED"]["value"] == "true"
    assert backend_env["REDIS_URL"]["fromService"] == {
        "type": "keyvalue",
        "name": "healthcare-beta-redis",
        "property": "connectionString",
    }
