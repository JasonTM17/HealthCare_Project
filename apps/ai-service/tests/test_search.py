"""Tests for the semantic search endpoint."""

from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app, rag_service

client = TestClient(app)


def _reset_index():
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()


def test_search_requires_query_or_specialty():
    _reset_index()
    response = client.get("/search")
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_returns_matching_documents():
    _reset_index()
    # Index two specialties with distinct embeddings.
    with patch("app.main.embed") as mock_embed:
        # First call indexes cardio, second neuro; search uses [1,0,0].
        mock_embed.side_effect = [
            ([1.0, 0.0, 0.0], "local"),  # cardio ingest
            ([0.0, 1.0, 0.0], "local"),  # neuro ingest
            ([1.0, 0.0, 0.0], "local"),  # search query
        ]
        client.post("/rag/index", json={
            "source_type": "specialty", "source_id": "cardio",
            "title": "Tim mạch", "content": "Khám tim mạch.",
        })
        client.post("/rag/index", json={
            "source_type": "specialty", "source_id": "neuro",
            "title": "Thần kinh", "content": "Khám thần kinh.",
        })

    response = client.get("/search?q=tim")
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) >= 1
    # Cardio should rank first for a query embedding near [1,0,0].
    assert results[0]["source_id"] == "cardio"


def test_search_respects_top_k():
    _reset_index()
    with patch("app.main.embed") as mock_embed:
        mock_embed.side_effect = [
            ([1.0, 0.0], "local"),
            ([0.9, 0.1], "local"),
            ([0.8, 0.2], "local"),
            ([1.0, 0.0], "local"),  # search
        ]
        for i, sid in enumerate(["a", "b", "c"]):
            client.post("/rag/index", json={
                "source_type": "specialty", "source_id": sid,
                "title": f"Specialty {sid}", "content": f"Content {sid}",
            })

    response = client.get("/search?q=test&top_k=2")
    assert response.status_code == 200
    assert len(response.json()["results"]) <= 2


def test_rag_stats_reflects_index_size():
    _reset_index()
    response = client.get("/rag/stats")
    assert response.status_code == 200
    assert response.json()["documents"] == 0
