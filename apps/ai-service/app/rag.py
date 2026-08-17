"""Lightweight in-memory RAG over trusted hospital knowledge.

This is a foundation-phase implementation: documents are embedded on
startup (or on demand) using the configured embedding provider and held
in an in-memory vector index. Production would persist embeddings in
pgvector and chunk larger documents. The interface (add_document, search)
is stable so the backing store can be swapped without changing callers.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import List, Optional

from app.schemas import EmbeddingRequest


@dataclass
class RagDocument:
    id: str
    source_type: str       # specialty, doctor, service, package, article, faq
    source_id: str
    title: str
    content: str
    embedding: List[float] = field(default_factory=list)
    content_hash: str = ""


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class RagIndex:
    """In-memory vector index with cosine similarity search."""

    def __init__(self) -> None:
        self._documents: dict[str, RagDocument] = {}

    def add(self, doc: RagDocument) -> None:
        self._documents[doc.id] = doc

    def remove(self, doc_id: str) -> None:
        self._documents.pop(doc_id, None)

    def get(self, doc_id: str) -> Optional[RagDocument]:
        return self._documents.get(doc_id)

    @property
    def size(self) -> int:
        return len(self._documents)

    def search(self, query_embedding: List[float], top_k: int = 5) -> List[tuple[RagDocument, float]]:
        if not query_embedding:
            return []
        scored = []
        for doc in self._documents.values():
            if not doc.embedding:
                continue
            score = _cosine_similarity(query_embedding, doc.embedding)
            scored.append((doc, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]


class RagService:
    """Coordinates ingestion and retrieval against the in-memory index."""

    def __init__(self, index: Optional[RagIndex] = None) -> None:
        self.index = index or RagIndex()

    def ingest(self, source_type: str, source_id: str, title: str, content: str,
               embedding: List[float]) -> RagDocument:
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        doc = RagDocument(
            id=f"{source_type}:{source_id}",
            source_type=source_type,
            source_id=source_id,
            title=title,
            content=content,
            embedding=embedding,
            content_hash=content_hash,
        )
        self.index.add(doc)
        return doc

    def remove(self, source_type: str, source_id: str) -> None:
        self.index.remove(f"{source_type}:{source_id}")

    def search(self, query_embedding: List[float], top_k: int = 5) -> List[tuple[RagDocument, float]]:
        return self.index.search(query_embedding, top_k)


def build_embedding_request(text: str) -> EmbeddingRequest:
    return EmbeddingRequest(text=text)
