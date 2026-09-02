from fastapi.testclient import TestClient
import pytest
from unittest.mock import patch

from app.main import app, rag_service, settings

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "service" in response.json()
    assert "ai_provider" in response.json()
    assert response.json()["rag_ready"] is True


def test_readyz_fails_closed_when_rag_probe_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "local")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", True)
    monkeypatch.setattr(rag_service, "health_probe", lambda: False)

    response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["ready"] is False
    assert response.json()["rag_ready"] is False


def test_health_misconfiguration_is_not_http_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", False)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["detail"] == "AI service authentication is not configured"


def test_health_rejects_missing_or_mismatched_configured_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "expected-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")

    missing = client.get("/health")
    mismatched = client.get(
        "/health",
        headers={"X-AI-Service-Token": "wrong-token"},
    )

    assert missing.status_code == 401
    assert mismatched.status_code == 401


def test_health_accepts_configured_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "expected-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")

    response = client.get(
        "/health",
        headers={"X-AI-Service-Token": "expected-token"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_remote_provider_without_credentials_is_unready_outside_local_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "deepseek_api_key", "")

    response = client.get("/health", headers={"X-AI-Service-Token": "service-token"})

    assert response.status_code == 503
    assert response.json()["provider_configured"] is False


def test_configured_remote_provider_is_fail_closed_without_a_liveness_probe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")

    with patch("openai.OpenAI") as remote_client:
        response = client.get(
            "/health",
            headers={"X-AI-Service-Token": "service-token"},
        )

    assert response.status_code == 503
    assert response.json()["provider_configured"] is True
    assert response.json()["remote_probe_required"] is True
    assert response.json()["ready"] is False
    remote_client.assert_not_called()


def test_public_hospital_support_remote_configuration_is_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_public_hospital_support_remote_enabled", True)

    response = client.get(
        "/health",
        headers={"X-AI-Service-Token": "service-token"},
    )

    assert response.status_code == 200
    assert response.json()["provider_configured"] is True
    assert response.json()["remote_probe_required"] is False
    assert response.json()["ready"] is True


def test_unknown_chat_provider_is_unready_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "unsupported-provider")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")

    response = client.get("/health", headers={"X-AI-Service-Token": "service-token"})

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
