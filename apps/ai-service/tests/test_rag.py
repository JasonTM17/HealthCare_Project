"""Tests for the RAG index, search, and specialty recommendation."""

from app.rag import RagIndex, RagService
from app.main import rag_service


def test_index_add_and_search():
    index = RagIndex()
    # Similar embeddings should rank closer.
    index.add(_doc("sp-1", "Tim mạch", "Khám và điều trị bệnh lý tim, mạch máu, tăng huyết áp.", [1.0, 0.0, 0.0]))
    index.add(_doc("sp-2", "Thần kinh", "Khám và điều trị đau đầu, đau nửa đầu, rối loạn giấc ngủ.", [0.0, 1.0, 0.0]))

    hits = index.search([1.0, 0.0, 0.0], top_k=2)
    assert len(hits) == 2
    assert hits[0][0].source_id == "sp-1"
    assert hits[0][1] > hits[1][1]


def test_index_empty_search_returns_empty():
    index = RagIndex()
    assert index.search([1.0, 0.0]) == []


def test_service_ingest_and_remove():
    service = RagService()
    service.ingest("specialty", "cardio", "Tim mạch", "Khám tim mạch.", [1.0, 0.0])
    assert service.index.size == 1
    service.remove("specialty", "cardio")
    assert service.index.size == 0


def test_rag_search_endpoint():
    rag_service.index = __import__("app.rag", fromlist=["RagIndex"]).RagIndex()
    rag_service.ingest("specialty", "cardio", "Tim mạch", "Khám tim mạch, điều trị bệnh lý van tim.", [1.0, 0.0, 0.0])
    rag_service.ingest("specialty", "neuro", "Thần kinh", "Khám thần kinh, điều trị đau đầu.", [0.0, 1.0, 0.0])

    hits = rag_service.search([1.0, 0.0, 0.0], top_k=1)
    assert len(hits) == 1
    assert hits[0][0].source_id == "cardio"


def _doc(source_id: str, title: str, content: str, embedding: list):
    from app.rag import RagDocument

    return RagDocument(
        id=f"specialty:{source_id}",
        source_type="specialty",
        source_id=source_id,
        title=title,
        content=content,
        embedding=embedding,
    )
