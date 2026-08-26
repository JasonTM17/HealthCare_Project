from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_deployable_images_expose_revision_and_health_contract() -> None:
    dockerfiles = (
        "apps/backend/Dockerfile",
        "apps/ai-service/Dockerfile",
        "apps/frontend/Dockerfile",
        "infrastructure/av-scanner/Dockerfile",
        "infrastructure/database/Dockerfile",
    )
    for relative in dockerfiles:
        text = _read(relative)
        assert "ARG VCS_REF=unknown" in text, relative
        assert "org.opencontainers.image.revision=${VCS_REF}" in text, relative
        assert "HEALTHCHECK" in text, relative


def test_application_images_drop_root_before_startup() -> None:
    expected_users = {
        "apps/backend/Dockerfile": "USER healthcare:healthcare",
        "apps/ai-service/Dockerfile": "USER app:app",
        "apps/frontend/Dockerfile": "USER node",
        "infrastructure/av-scanner/Dockerfile": "USER scanner",
    }
    for relative, user in expected_users.items():
        assert user in _read(relative), relative


def test_build_context_ignores_generated_outputs_and_secrets() -> None:
    for relative in (
        ".dockerignore",
        "apps/backend/.dockerignore",
        "apps/ai-service/.dockerignore",
        "apps/frontend/.dockerignore",
        "infrastructure/av-scanner/.dockerignore",
        "infrastructure/database/.dockerignore",
    ):
        text = _read(relative)
        assert ".next-*" in text or "**/.next-*" in text, relative
        assert ".tmp" in text, relative
        assert ".env" in text, relative
        assert "secrets" in text.lower(), relative
        assert "credentials" in text.lower(), relative
