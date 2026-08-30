from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
IMAGE_DIGESTS = {
    "healthcare-beta-ai": "sha256:5fb34f66df688625d98edbeca897c1597b4e5bb8a70c9b5d0f0324797256f5dc",
    "healthcare-beta-backend": "sha256:0877e3eaeac04189673910a458b4b87a3c1637dbb6311fceeb27ab1bdda578e1",
    "healthcare-beta-av-scanner": "sha256:192bd03fe43f94b59b99ffba439834704de9006f777b17b60412294dde394224",
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
