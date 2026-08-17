from fastapi.testclient import TestClient
from app.main import app

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
