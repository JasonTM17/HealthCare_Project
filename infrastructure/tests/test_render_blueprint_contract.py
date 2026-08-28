from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
SOURCE_SHA = "7669b7389edfefdb251d4e131bcd2c0fbb030559"


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
        assert service["image"]["url"] == (
            f"ghcr.io/jasontm17/{image_name}:sha-{SOURCE_SHA}"
        )


def test_render_blueprint_provisions_private_attachment_scanner() -> None:
    services = _services_by_name()
    clamav = services["healthcare-beta-clamav"]
    scanner = services["healthcare-beta-av-scanner"]
    backend_env = _env_by_key(services["healthcare-beta-backend"])
    scanner_env = _env_by_key(scanner)

    assert clamav["type"] == "pserv"
    assert clamav["runtime"] == "image"
    assert clamav["image"]["url"] == "clamav/clamav:1.4"
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
