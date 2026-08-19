"""Tests for the RAG index, search, and specialty recommendation."""

import pytest
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.rag import EmbeddingContractError, RagDocument, RagIndex, RagService
from app.schemas import MAX_EMBEDDING_DIMENSION
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


def test_sync_revision_tombstone_rejects_stale_resurrection() -> None:
    service = RagService()
    service.ingest(
        "specialty",
        "cardio",
        "Tim mạch",
        "Khám tim mạch.",
        [1.0, 0.0],
        metadata={"_sync_revision": "10"},
    )
    service.remove("specialty", "cardio", revision=11)

    stale = service.ingest(
        "specialty",
        "cardio",
        "Tim mạch cũ",
        "Nội dung cũ.",
        [1.0, 0.0],
        metadata={"_sync_revision": "10"},
    )
    assert stale.title == "Tim mạch cũ"
    assert service.index.size == 0

    service.ingest(
        "specialty",
        "cardio",
        "Tim mạch mới",
        "Nội dung mới.",
        [1.0, 0.0],
        metadata={"_sync_revision": "12"},
    )
    assert service.index.get("specialty:cardio").title == "Tim mạch mới"


def test_sync_revision_guard_rechecks_after_concurrent_delete() -> None:
    service = RagService()
    embedding_started = Event()
    release_embedding = Event()

    def delayed_embedder(_: str) -> list[float]:
        embedding_started.set()
        assert release_embedding.wait(timeout=2)
        return [1.0, 0.0]

    with ThreadPoolExecutor(max_workers=1) as executor:
        pending = executor.submit(
            service.ingest,
            "specialty",
            "cardio",
            "Tim mạch cũ",
            "Nội dung cũ.",
            metadata={"_sync_revision": "10"},
            embedder=delayed_embedder,
        )
        assert embedding_started.wait(timeout=2)
        service.remove("specialty", "cardio", revision=11)
        release_embedding.set()
        pending.result(timeout=2)

    assert service.index.size == 0


def test_ingest_normalizes_visible_content_and_reuses_embedding() -> None:
    service = RagService()
    calls: list[str] = []

    def embedder(content: str) -> list[float]:
        calls.append(content)
        return [1.0, 0.0]

    first = service.ingest(
        "article",
        "headache",
        "<h1>Đau đầu</h1>",
        "<p>Thông tin <strong>tham khảo</strong>.</p><script>secret()</script>",
        embedder=embedder,
    )
    second = service.ingest(
        "article",
        "headache",
        "Đau đầu cập nhật tiêu đề",
        "<p>Thông tin <strong>tham khảo</strong>.</p><script>secret()</script>",
        embedder=embedder,
    )

    assert first.content == "Thông tin tham khảo."
    assert second.embedding == [1.0, 0.0]
    assert calls == ["Thông tin tham khảo."]


def test_inactive_and_unpublished_documents_are_not_searchable() -> None:
    service = RagService()
    service.ingest("specialty", "cardio", "Tim mạch", "Khám tim.", [1.0, 0.0])

    inactive = service.ingest(
        "specialty",
        "cardio",
        "Tim mạch",
        "Khám tim.",
        active=False,
    )

    assert inactive.searchable is False
    assert service.index.size == 0
    assert service.search([1.0, 0.0]) == []

    service.ingest(
        "article",
        "draft",
        "Bản nháp",
        "Chưa công bố.",
        published=False,
        embedding=[1.0, 0.0],
    )
    assert service.index.size == 0


def test_rag_search_endpoint() -> None:
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()
    rag_service.ingest("specialty", "cardio", "Tim mạch", "Khám tim mạch, điều trị bệnh lý van tim.", [1.0, 0.0, 0.0])
    rag_service.ingest("specialty", "neuro", "Thần kinh", "Khám thần kinh, điều trị đau đầu.", [0.0, 1.0, 0.0])

    hits = rag_service.search([1.0, 0.0, 0.0], top_k=1)
    assert len(hits) == 1
    assert hits[0][0].source_id == "cardio"


def test_specialty_recommendation_cites_indexed_sources_only() -> None:
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()
    rag_service.ingest(
        "specialty",
        "cardio",
        "Tim mạch",
        "Khám tim mạch. Nguồn nội bộ: https://catalog.test/cardio.",
        [1.0, 0.0, 0.0],
        embedding_model="local",
    )

    with patch("app.main.embed") as mock_embed:
        mock_embed.return_value = ([1.0, 0.0, 0.0], "local")
        response = client.post(
            "/recommendations/specialty",
            json={"symptoms": "đau ngực"},
        )

    assert response.status_code == 200
    assert response.json()["citations"] == [
        {"source_type": "specialty", "source_id": "cardio", "title": "Tim mạch"}
    ]
    assert "url" not in response.json()["citations"][0]


def test_local_fallback_recommendation_suppresses_retrieved_citations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()
    rag_service.ingest(
        "specialty",
        "cardio",
        "Tim mạch",
        "Khám tim mạch.",
        [1.0, 0.0, 0.0],
        embedding_model="local",
    )
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "deepseek_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "local")

    with patch("app.main.embed", return_value=([1.0, 0.0, 0.0], "local")):
        with patch("openai.OpenAI", side_effect=RuntimeError("provider down")):
            response = client.post(
                "/recommendations/specialty",
                json={"symptoms": "đau ngực"},
            )

    assert response.status_code == 200
    assert response.json()["provenance"] == "local_fallback"
    assert response.json()["citations"] == []


def test_index_tracks_embedding_contract_and_rejects_mixed_vectors() -> None:
    service = RagService()
    remote = service.ingest(
        "specialty",
        "cardio",
        "Tim mạch",
        "Khám tim mạch.",
        embedder=lambda _: ([1.0, 0.0], "model-a", "remote_provider"),
    )

    assert remote.embedding_model == "model-a"
    assert remote.embedding_provenance == "remote_provider"

    with pytest.raises(EmbeddingContractError):
        service.ingest(
            "specialty",
            "neuro",
            "Thần kinh",
            "Khám thần kinh.",
            embedder=lambda _: ([1.0, 0.0, 0.0], "model-b", "remote_provider"),
        )

    with pytest.raises(EmbeddingContractError):
        service.search([1.0, 0.0], embedding_model="model-b", embedding_provenance="remote_provider")


def test_index_bounds_embedding_dimension_and_document_count() -> None:
    index = RagIndex(max_documents=1)
    index.add(_doc("one", "One", "Content", [1.0, 0.0]))

    with pytest.raises(EmbeddingContractError):
        index.add(_doc("two", "Two", "Content", [1.0, 0.0]))
    with pytest.raises(EmbeddingContractError):
        RagService().ingest(
            "specialty",
            "too-large",
            "Too large",
            "Content",
            [0.0] * (MAX_EMBEDDING_DIMENSION + 1),
        )


def test_rag_ingest_is_disabled_or_token_protected(monkeypatch: pytest.MonkeyPatch) -> None:
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()
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

    sources = client.get(
        "/rag/sources",
        headers={"X-RAG-Ingest-Token": "test-ingest-token"},
    )
    assert sources.status_code == 200
    assert sources.json()["sources"] == [{"source_type": "specialty", "source_id": "cardio"}]

    deleted = client.post(
        "/rag/delete",
        json={"source_type": "specialty", "source_id": "cardio"},
        headers={"X-RAG-Ingest-Token": "test-ingest-token"},
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"removed": True, "index_size": 0}


def test_rag_ingest_skips_inactive_source(monkeypatch: pytest.MonkeyPatch) -> None:
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()
    monkeypatch.setattr(settings, "rag_ingest_enabled", True)
    monkeypatch.setattr(settings, "rag_ingest_token", "test-ingest-token")

    response = client.post(
        "/rag/index",
        json={
            "source_type": "article",
            "source_id": "draft",
            "title": "Bản nháp",
            "content": "Không được hiển thị.",
            "active": False,
            "published": False,
        },
        headers={"X-RAG-Ingest-Token": "test-ingest-token"},
    )

    assert response.status_code == 200
    assert response.json()["indexed"] is False
    assert response.json()["index_size"] == 0


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
