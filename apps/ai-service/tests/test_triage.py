from fastapi.testclient import TestClient
import pytest
from unittest.mock import patch

from app.main import app, settings

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_triage_cardiology_emergency() -> None:
    response = client.post(
        "/triage",
        json={"symptoms": "Tôi bị đau thắt ngực dữ dội, khó thở và vã mồ hôi"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["recommended_specialty"] == "Tim Mạch & Can Thiệp Mạch Máu"
    assert data["urgency_level"] == "EMERGENCY"


def test_triage_gastroenterology() -> None:
    response = client.post(
        "/triage",
        json={"symptoms": "Đau vùng thượng vị dạ dày, ợ chua và buồn nôn"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["recommended_specialty"] == "Tiêu Hóa - Gan Mật - Tụy"
    assert data["urgency_level"] == "NORMAL"


def test_triage_general_checkup() -> None:
    response = client.post(
        "/triage",
        json={"symptoms": "Cảm thấy người mệt mỏi nhẹ, muốn kiểm tra sức khỏe"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["recommended_specialty"] == "Gói Khám Sức Khỏe Tổng Quát Toàn Diện"


def test_triage_enforces_configured_input_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_max_input_chars", 4)

    response = client.post("/triage", json={"symptoms": "đau đầu"})

    assert response.status_code == 413
    assert "configured limit" in response.json()["detail"]


def test_emergency_triage_never_calls_remote_provider_outside_local_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "deepseek_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_service_token", "service-token")

    with patch("openai.OpenAI", side_effect=RuntimeError("provider down")) as remote_client:
        response = client.post(
            "/triage",
            json={"symptoms": "đau ngực dữ dội"},
            headers={"X-AI-Service-Token": "service-token"},
        )

    assert response.status_code == 200
    assert response.json()["provenance"] == "local_fallback"
    remote_client.assert_not_called()


def test_local_provider_failure_is_explicitly_labeled_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "deepseek_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "local")

    with patch("openai.OpenAI", side_effect=RuntimeError("provider down")):
        response = client.post("/triage", json={"symptoms": "đau ngực dữ dội"})

    assert response.status_code == 200
    assert response.json()["provenance"] == "local_fallback"
