"""Tests for the semantic search endpoint."""

import pytest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app, rag_service, settings

client = TestClient(app)


def _reset_index() -> None:
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()


def _configure_ingest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rag_ingest_enabled", True)
    monkeypatch.setattr(settings, "rag_ingest_token", "test-ingest-token")


def _index_document(payload: dict[str, str]) -> None:
    response = client.post(
        "/rag/index",
        json=payload,
        headers={"X-RAG-Ingest-Token": "test-ingest-token"},
    )
    assert response.status_code == 200


def test_search_requires_query_or_specialty() -> None:
    _reset_index()
    response = client.get("/search")
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_returns_matching_documents(monkeypatch: pytest.MonkeyPatch) -> None:
    _reset_index()
    _configure_ingest(monkeypatch)
    # Index two specialties with distinct embeddings.
    with patch("app.main.embed") as mock_embed:
        # First call indexes cardio, second neuro; search uses [1,0,0].
        mock_embed.side_effect = [
            ([1.0, 0.0, 0.0], "local"),  # cardio ingest
            ([0.0, 1.0, 0.0], "local"),  # neuro ingest
            ([1.0, 0.0, 0.0], "local"),  # search query
        ]
        _index_document({
            "source_type": "specialty", "source_id": "cardio",
            "title": "Tim mạch", "content": "Khám tim mạch.",
        })
        _index_document({
            "source_type": "specialty", "source_id": "neuro",
            "title": "Thần kinh", "content": "Khám thần kinh.",
        })

    response = client.get("/search?q=tim")
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) >= 1
    # Cardio should rank first for a query embedding near [1,0,0].
    assert results[0]["source_id"] == "cardio"


def test_search_respects_top_k(monkeypatch: pytest.MonkeyPatch) -> None:
    _reset_index()
    _configure_ingest(monkeypatch)
    with patch("app.main.embed") as mock_embed:
        mock_embed.side_effect = [
            ([1.0, 0.0], "local"),
            ([0.9, 0.1], "local"),
            ([0.8, 0.2], "local"),
            ([1.0, 0.0], "local"),  # search
        ]
        for i, sid in enumerate(["a", "b", "c"]):
            _index_document({
                "source_type": "specialty", "source_id": sid,
                "title": f"Specialty {sid}", "content": f"Content {sid}",
            })

    response = client.get("/search?q=test&top_k=2")
    assert response.status_code == 200
    assert len(response.json()["results"]) <= 2


def test_rag_stats_reflects_index_size() -> None:
    _reset_index()
    response = client.get("/rag/stats")
    assert response.status_code == 200
    assert response.json()["documents"] == 0
