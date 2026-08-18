"""Static operational checks for sensitive request and health boundaries."""

from pathlib import Path


def test_container_and_compose_healthcheck_preserve_runtime_boundaries() -> None:
    repository_root = Path(__file__).resolve().parents[3]
    dockerfile = (repository_root / "apps/ai-service/Dockerfile").read_text(encoding="utf-8")
    compose = (repository_root / "infrastructure/docker-compose.yml").read_text(encoding="utf-8")

    assert "--no-access-log" in dockerfile
    assert "X-AI-Service-Token" in compose
    assert "AI_SERVICE_TOKEN" in compose


def test_internal_search_shape_does_not_put_query_in_the_upstream_path() -> None:
    backend_source = (
        Path(__file__).resolve().parents[3]
        / "apps/backend/src/main/java/com/healthcare/ai/service/AiService.java"
    ).read_text(encoding="utf-8")

    assert 'URI.create(endpoint("/search"))' in backend_source
    assert '.queryParam("q"' not in backend_source
