"""Bounded in-memory RAG over trusted, public hospital knowledge.

The index remains an intentionally non-durable foundation store.  Its service
boundary is designed so a future pgvector-backed implementation can preserve
the same ingestion, retrieval, filtering, and citation rules.
"""

from __future__ import annotations

import hashlib
import html
import math
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Callable, Collection, List, Optional, Protocol


MAX_DOCUMENT_CHARS = 20_000
_IGNORED_HTML_TAGS = frozenset({"script", "style", "noscript", "template"})


class _VisibleTextParser(HTMLParser):
    """Extract visible text without indexing script/style payloads."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._ignored_depth = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag.casefold() in _IGNORED_HTML_TAGS:
            self._ignored_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in _IGNORED_HTML_TAGS and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self._parts.append(data)

    @property
    def text(self) -> str:
        return " ".join(self._parts)


def normalize_content(content: str) -> str:
    """Convert trusted catalog HTML to bounded visible text."""

    parser = _VisibleTextParser()
    try:
        parser.feed(content)
        parser.close()
        visible = parser.text
    except Exception:
        # Malformed markup must not make the ingestion worker fail open.  The
        # fallback strips tags rather than indexing raw HTML payloads.
        visible = re.sub(
            r"<\s*(script|style|noscript|template)\b[^>]*>.*?<\s*/\s*\1\s*>",
            " ",
            content,
            flags=re.IGNORECASE | re.DOTALL,
        )
        visible = re.sub(r"<[^>]*>", " ", visible)
    normalized = " ".join(html.unescape(visible).split())
    return re.sub(r"\s+([,.;:!?、。！？])", r"\1", normalized)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    if any(not math.isfinite(value) for value in (*a, *b)):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _tokens(value: str) -> set[str]:
    return set(re.findall(r"[\wÀ-ỹ]+", value.casefold(), flags=re.UNICODE))


def _keyword_similarity(query: str, doc: "RagDocument") -> float:
    query_tokens = _tokens(query)
    if not query_tokens:
        return 0.0
    document_tokens = _tokens(" ".join([doc.title, doc.content, *doc.metadata.values()]))
    return len(query_tokens & document_tokens) / len(query_tokens)


@dataclass
class RagDocument:
    id: str
    source_type: str  # specialty, doctor, service, package, article, faq
    source_id: str
    title: str
    content: str
    embedding: List[float] = field(default_factory=list)
    content_hash: str = ""
    active: bool = True
    published: bool = True
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def searchable(self) -> bool:
        return self.active and self.published and bool(self.content)


class Retriever(Protocol):
    """Provider-neutral retrieval contract."""

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
    ) -> List[tuple[RagDocument, float]]:
        """Return bounded, searchable documents ordered by relevance."""


class RagIndex:
    """In-memory hybrid vector/keyword index with active-content filtering."""

    def __init__(self) -> None:
        self._documents: dict[str, RagDocument] = {}

    def add(self, doc: RagDocument) -> None:
        if doc.searchable:
            self._documents[doc.id] = doc
        else:
            self.remove(doc.id)

    def remove(self, doc_id: str) -> None:
        self._documents.pop(doc_id, None)

    def get(self, doc_id: str) -> Optional[RagDocument]:
        return self._documents.get(doc_id)

    @property
    def size(self) -> int:
        return len(self._documents)

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
    ) -> List[tuple[RagDocument, float]]:
        if not query_embedding:
            return []
        top_k = max(1, min(top_k, 100))
        allowed_source_types = set(source_types) if source_types else None
        scored: list[tuple[RagDocument, float]] = []
        for doc in self._documents.values():
            if not doc.searchable or not doc.embedding:
                continue
            if allowed_source_types and doc.source_type not in allowed_source_types:
                continue
            vector_score = max(0.0, _cosine_similarity(query_embedding, doc.embedding))
            lexical_score = _keyword_similarity(query_text, doc) if query_text else 0.0
            score = 0.75 * vector_score + 0.25 * lexical_score if query_text else vector_score
            scored.append((doc, score))
        scored.sort(key=lambda item: (item[1], item[0].id), reverse=True)
        return scored[:top_k]


class RagServiceContract(Protocol):
    """Service-level contract for swapping the in-memory index later."""

    index: RagIndex

    def ingest(
        self,
        source_type: str,
        source_id: str,
        title: str,
        content: str,
        embedding: List[float] | None = None,
        *,
        active: bool = True,
        published: bool = True,
        metadata: dict[str, str] | None = None,
        embedder: Callable[[str], List[float]] | None = None,
    ) -> RagDocument:
        """Create or update one public document."""

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
    ) -> List[tuple[RagDocument, float]]:
        """Retrieve bounded public documents."""


class RagService:
    """Coordinates normalized, idempotent ingestion and hybrid retrieval."""

    def __init__(self, index: Optional[RagIndex] = None) -> None:
        self.index = index or RagIndex()

    def ingest(
        self,
        source_type: str,
        source_id: str,
        title: str,
        content: str,
        embedding: List[float] | None = None,
        *,
        active: bool = True,
        published: bool = True,
        metadata: dict[str, str] | None = None,
        embedder: Callable[[str], List[float]] | None = None,
    ) -> RagDocument:
        normalized_title = normalize_content(title)
        normalized_content = normalize_content(content)
        if not normalized_title or not normalized_content:
            raise ValueError("RAG documents require non-empty normalized title and content")
        if len(normalized_content) > MAX_DOCUMENT_CHARS:
            raise ValueError("RAG document exceeds the maximum content size")

        document_id = f"{source_type}:{source_id}"
        content_hash = hashlib.sha256(normalized_content.encode("utf-8")).hexdigest()
        document_metadata = dict(metadata or {})
        existing = self.index.get(document_id)

        document = RagDocument(
            id=document_id,
            source_type=source_type,
            source_id=source_id,
            title=normalized_title,
            content=normalized_content,
            embedding=embedding or [],
            content_hash=content_hash,
            active=active,
            published=published,
            metadata=document_metadata,
        )

        # Inactive or unpublished records are tombstoned from the searchable
        # index.  This prevents stale public knowledge from remaining visible.
        if not document.searchable:
            self.index.remove(document_id)
            return document

        # Reuse a prior vector when only metadata/title/publication state
        # changes.  A content hash change is the only reason to call embedder.
        if existing and existing.content_hash == content_hash and existing.embedding:
            document.embedding = existing.embedding
        elif embedding is None:
            if embedder is None:
                raise ValueError("an embedding or embedder is required for new documents")
            document.embedding = embedder(normalized_content)

        self.index.add(document)
        return document

    def remove(self, source_type: str, source_id: str) -> None:
        self.index.remove(f"{source_type}:{source_id}")

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
    ) -> List[tuple[RagDocument, float]]:
        return self.index.search(
            query_embedding,
            top_k,
            query_text=query_text,
            source_types=source_types,
        )
