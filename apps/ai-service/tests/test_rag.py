"""Tests for the RAG index, search, and specialty recommendation."""

import pytest
from fastapi.testclient import TestClient

from app.rag import RagDocument, RagIndex, RagService
from app.main import app, rag_service, settings

client = TestClient(app)


def test_index_add_and_search() -> None:
    index = RagIndex()
    # Similar embeddings should rank closer.
    index.add(_doc("sp-1", "Tim mạch", "Khám và điều trị bệnh lý tim, mạch máu, tăng huyết áp.", [1.0, 0.0, 0.0]))
    index.add(_doc("sp-2", "Thần kinh", "Khám và điều trị đau đầu, đau nửa đầu, rối loạn giấc ngủ.", [0.0, 1.0, 0.0]))

    hits = index.search([1.0, 0.0, 0.0], top_k=2)
    assert len(hits) == 2
    assert hits[0][0].source_id == "sp-1"
    assert hits[0][1] > hits[1][1]


def test_index_empty_search_returns_empty() -> None:
    index = RagIndex()
    assert index.search([1.0, 0.0]) == []


def test_service_ingest_and_remove() -> None:
    service = RagService()
    service.ingest("specialty", "cardio", "Tim mạch", "Khám tim mạch.", [1.0, 0.0])
    assert service.index.size == 1
    service.remove("specialty", "cardio")
    assert service.index.size == 0


def test_rag_search_endpoint() -> None:
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()
    rag_service.ingest("specialty", "cardio", "Tim mạch", "Khám tim mạch, điều trị bệnh lý van tim.", [1.0, 0.0, 0.0])
    rag_service.ingest("specialty", "neuro", "Thần kinh", "Khám thần kinh, điều trị đau đầu.", [0.0, 1.0, 0.0])

    hits = rag_service.search([1.0, 0.0, 0.0], top_k=1)
    assert len(hits) == 1
    assert hits[0][0].source_id == "cardio"


def test_rag_ingest_is_disabled_or_token_protected(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {
        "source_type": "specialty",
        "source_id": "cardio",
        "title": "Tim mạch",
        "content": "Khám tim mạch.",
    }
    monkeypatch.setattr(settings, "rag_ingest_enabled", False)
    disabled = client.post("/rag/index", json=payload)
    assert disabled.status_code == 404

    monkeypatch.setattr(settings, "rag_ingest_enabled", True)
    monkeypatch.setattr(settings, "rag_ingest_token", "test-ingest-token")
    forbidden = client.post("/rag/index", json=payload)
    assert forbidden.status_code == 403

    accepted = client.post(
        "/rag/index",
        json=payload,
        headers={"X-RAG-Ingest-Token": "test-ingest-token"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["id"] == "specialty:cardio"


def test_ai_service_token_protects_search_routes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "test-service-token")

    unauthorized = client.get("/rag/stats")
    assert unauthorized.status_code == 401

    authorized = client.get(
        "/rag/stats",
        headers={"X-AI-Service-Token": "test-service-token"},
    )
    assert authorized.status_code == 200


def test_ai_service_without_token_fails_closed_when_local_escape_hatch_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", False)

    response = client.get("/rag/stats")

    assert response.status_code == 503


def _doc(source_id: str, title: str, content: str, embedding: list[float]) -> RagDocument:
    return RagDocument(
        id=f"specialty:{source_id}",
        source_type="specialty",
        source_id=source_id,
        title=title,
        content=content,
        embedding=embedding,
    )
