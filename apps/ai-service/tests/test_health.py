from fastapi.testclient import TestClient
import pytest

from app.main import app, settings

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "service" in response.json()
    assert "ai_provider" in response.json()


def test_health_misconfiguration_is_not_http_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", False)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["status"] == "misconfigured"
    assert response.json()["ready"] is False


def test_remote_provider_without_credentials_is_unready_outside_local_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "deepseek_api_key", "")

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["provider_configured"] is False


def test_unknown_chat_provider_is_unready_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "unsupported-provider")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["provider_configured"] is False


def test_local_runtime_reports_degraded_remote_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "local")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", True)
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "deepseek_api_key", "")

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["fallback_allowed"] is True
