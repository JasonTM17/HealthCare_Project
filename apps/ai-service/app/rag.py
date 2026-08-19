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
from threading import RLock
from typing import Callable, Collection, List, Optional, Protocol

from app.schemas import MAX_EMBEDDING_DIMENSION, ProviderProvenance


MAX_DOCUMENT_CHARS = 20_000
MAX_RAG_DOCUMENTS = 5_000
SYNC_REVISION_METADATA_KEY = "_sync_revision"
_IGNORED_HTML_TAGS = frozenset({"script", "style", "noscript", "template"})


class EmbeddingContractError(ValueError):
    """Raised when vectors cannot safely share the in-memory index."""


EmbeddingCallbackResult = tuple[List[float], str, ProviderProvenance]
EmbeddingCallback = Callable[[str], List[float] | EmbeddingCallbackResult]


def _normalize_embedding(
    value: List[float] | EmbeddingCallbackResult,
    *,
    default_model: str,
    default_provenance: ProviderProvenance,
) -> tuple[List[float], str, ProviderProvenance]:
    if isinstance(value, tuple):
        if len(value) != 3:
            raise EmbeddingContractError("embedding callback returned invalid metadata")
        vector, model, provenance = value
    else:
        vector, model, provenance = value, default_model, default_provenance

    if not model.strip() or provenance not in {
        "local_provider",
        "remote_provider",
        "local_fallback",
    }:
        raise EmbeddingContractError("embedding metadata is invalid")
    if not vector or len(vector) > MAX_EMBEDDING_DIMENSION:
        raise EmbeddingContractError("embedding dimension is outside the configured bound")
    try:
        normalized = [float(value) for value in vector]
    except (TypeError, ValueError) as exc:
        raise EmbeddingContractError("embedding vector is not numeric") from exc
    if any(not math.isfinite(value) for value in normalized):
        raise EmbeddingContractError("embedding vector contains a non-finite value")
    return normalized, model.strip(), provenance


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
    embedding_model: str = "provided"
    embedding_provenance: ProviderProvenance = "local_provider"
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
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
    ) -> List[tuple[RagDocument, float]]:
        """Return bounded, searchable documents ordered by relevance."""


class RagIndex:
    """In-memory hybrid vector/keyword index with active-content filtering."""

    def __init__(self, max_documents: int = MAX_RAG_DOCUMENTS) -> None:
        if max_documents < 1:
            raise ValueError("max_documents must be positive")
        self._documents: dict[str, RagDocument] = {}
        self._lock = RLock()
        self.max_documents = max_documents

    def _reference_contract(self) -> tuple[int, str, ProviderProvenance] | None:
        with self._lock:
            for document in self._documents.values():
                if document.searchable and document.embedding:
                    return (
                        len(document.embedding),
                        document.embedding_model,
                        document.embedding_provenance,
                    )
        return None

    def add(self, doc: RagDocument) -> None:
        with self._lock:
            if not doc.searchable:
                self.remove(doc.id)
                return

            vector, model, provenance = _normalize_embedding(
                doc.embedding,
                default_model=doc.embedding_model,
                default_provenance=doc.embedding_provenance,
            )
            reference = self._reference_contract()
            contract = (len(vector), model, provenance)
            if reference and contract != reference:
                raise EmbeddingContractError("embedding model, provenance, or dimension is incompatible")
            if doc.id not in self._documents and self.size >= self.max_documents:
                raise EmbeddingContractError("RAG document limit reached")
            doc.embedding = vector
            doc.embedding_model = model
            doc.embedding_provenance = provenance
            self._documents[doc.id] = doc

    def remove(self, doc_id: str) -> None:
        with self._lock:
            self._documents.pop(doc_id, None)

    def get(self, doc_id: str) -> Optional[RagDocument]:
        with self._lock:
            return self._documents.get(doc_id)

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._documents)

    @property
    def documents(self) -> tuple[RagDocument, ...]:
        """Return a stable snapshot for bounded reconciliation operations."""
        with self._lock:
            return tuple(self._documents.values())

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
    ) -> List[tuple[RagDocument, float]]:
        with self._lock:
            if not query_embedding:
                return []
            normalized_query, query_model, query_provenance = _normalize_embedding(
                query_embedding,
                default_model=embedding_model,
                default_provenance=embedding_provenance,
            )
            reference = self._reference_contract()
            if reference and (len(normalized_query), query_model, query_provenance) != reference:
                raise EmbeddingContractError("query embedding is incompatible with the indexed vectors")
            top_k = max(1, min(top_k, 100))
            allowed_source_types = set(source_types) if source_types else None
            scored: list[tuple[RagDocument, float]] = []
            for doc in self._documents.values():
                if not doc.searchable or not doc.embedding:
                    continue
                if allowed_source_types and doc.source_type not in allowed_source_types:
                    continue
                vector_score = max(0.0, _cosine_similarity(normalized_query, doc.embedding))
                lexical_score = _keyword_similarity(query_text, doc) if query_text else 0.0
                score = 0.75 * vector_score + 0.25 * lexical_score if query_text else vector_score
                scored.append((doc, score))
            scored.sort(key=lambda item: (item[1], item[0].id), reverse=True)
            return scored[:top_k]


class RagServiceContract(Protocol):
    """Service-level contract for swapping the in-memory index later."""

    index: RagIndex

    def sources(self) -> list[tuple[str, str]]:
        """Return the source identities currently present in the index."""

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
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
        embedder: EmbeddingCallback | None = None,
    ) -> RagDocument:
        """Create or update one public document."""

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
    ) -> List[tuple[RagDocument, float]]:
        """Retrieve bounded public documents."""


class RagService:
    """Coordinates normalized, idempotent ingestion and hybrid retrieval."""

    def __init__(
        self,
        index: Optional[RagIndex] = None,
        max_documents: int = MAX_RAG_DOCUMENTS,
    ) -> None:
        self.index = index or RagIndex(max_documents=max_documents)
        self._revision_lock = RLock()
        self._tombstones: dict[str, int] = {}
        self._latest_revisions: dict[str, int] = {}
        self._operation_sequence = 0
        self._latest_operations: dict[str, int] = {}

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
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
        embedder: EmbeddingCallback | None = None,
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
        revision = self._revision(document_metadata)
        with self._revision_lock:
            existing = self.index.get(document_id)
            tombstone_revision = self._tombstones.get(document_id)
            existing_revision = self._revision(existing.metadata) if existing else None
            latest_revision = self._latest_revisions.get(document_id)
            if revision is not None:
                known_revision = max(
                    revision if tombstone_revision is None else tombstone_revision,
                    existing_revision if existing_revision is not None else revision,
                    latest_revision if latest_revision is not None else revision,
                )
                if revision < known_revision:
                    return existing or RagDocument(
                        id=document_id,
                        source_type=source_type,
                        source_id=source_id,
                        title=normalized_title,
                        content=normalized_content,
                        metadata=document_metadata,
                    )
                self._latest_revisions[document_id] = revision
            self._operation_sequence += 1
            operation_token = self._operation_sequence
            self._latest_operations[document_id] = operation_token

        document = RagDocument(
            id=document_id,
            source_type=source_type,
            source_id=source_id,
            title=normalized_title,
            content=normalized_content,
            embedding=[],
            embedding_model=embedding_model,
            embedding_provenance=embedding_provenance,
            content_hash=content_hash,
            active=active,
            published=published,
            metadata=document_metadata,
        )

        # A sync revision prevents an older in-flight request from resurrecting
        # a source after a newer delete. Direct local/test calls without a
        # revision retain the legacy replace behavior.
        with self._revision_lock:
            if revision is None:
                self._tombstones.pop(document_id, None)
            else:
                if tombstone_revision is not None and revision <= tombstone_revision:
                    return existing or document
                if existing_revision is not None and revision < existing_revision:
                    return existing

        # Inactive or unpublished records are tombstoned from the searchable
        # index. This prevents stale public knowledge from remaining visible.
        if not document.searchable:
            self.remove(source_type, source_id, revision=revision, operation_token=operation_token)
            return document

        # Reuse a prior vector when only metadata/title/publication state
        # changes.  A content hash change is the only reason to call embedder.
        if existing and existing.content_hash == content_hash and existing.embedding:
            document.embedding = existing.embedding
            document.embedding_model = existing.embedding_model
            document.embedding_provenance = existing.embedding_provenance
        elif embedding is None:
            if embedder is None:
                raise ValueError("an embedding or embedder is required for new documents")
            (
                document.embedding,
                document.embedding_model,
                document.embedding_provenance,
            ) = _normalize_embedding(
                embedder(normalized_content),
                default_model=embedding_model,
                default_provenance=embedding_provenance,
            )
        else:
            (
                document.embedding,
                document.embedding_model,
                document.embedding_provenance,
            ) = _normalize_embedding(
                embedding,
                default_model=embedding_model,
                default_provenance=embedding_provenance,
            )

        # Embedding may run outside this lock. Re-check the revision after it
        # completes so a newer delete/update cannot be overwritten by an older
        # in-flight request.
        with self._revision_lock:
            current = self.index.get(document_id)
            if self._latest_operations.get(document_id) != operation_token:
                return current or document
            if revision is not None:
                current_revision = self._revision(current.metadata) if current else None
                current_tombstone = self._tombstones.get(document_id)
                if current_tombstone is not None and revision <= current_tombstone:
                    return current or document
                if current_revision is not None and revision < current_revision:
                    return current
                if current_tombstone is not None and revision > current_tombstone:
                    self._tombstones.pop(document_id, None)
            self.index.add(document)
        return document

    def remove(
        self,
        source_type: str,
        source_id: str,
        revision: int | None = None,
        *,
        operation_token: int | None = None,
    ) -> None:
        document_id = f"{source_type}:{source_id}"
        with self._revision_lock:
            existing = self.index.get(document_id)
            if revision is not None:
                current_revision = self._revision(existing.metadata) if existing else None
                latest_revision = self._latest_revisions.get(document_id)
                known_revision = max(
                    self._tombstones.get(document_id, revision),
                    current_revision if current_revision is not None else revision,
                    latest_revision if latest_revision is not None else revision,
                )
                if revision < known_revision:
                    return
                self._latest_revisions[document_id] = revision
                self._tombstones[document_id] = known_revision
            if operation_token is None:
                self._operation_sequence += 1
                operation_token = self._operation_sequence
                self._latest_operations[document_id] = operation_token
            self.index.remove(document_id)

    @staticmethod
    def _revision(metadata: dict[str, str]) -> int | None:
        raw_revision = metadata.get(SYNC_REVISION_METADATA_KEY)
        if raw_revision is None:
            return None
        try:
            revision = int(raw_revision)
        except (TypeError, ValueError):
            return None
        return revision if revision >= 0 else None

    def sources(self) -> list[tuple[str, str]]:
        with self._revision_lock:
            return [(document.source_type, document.source_id) for document in self.index.documents]

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
    ) -> List[tuple[RagDocument, float]]:
        with self._revision_lock:
            return self.index.search(
                query_embedding,
                top_k,
                query_text=query_text,
                source_types=source_types,
                embedding_model=embedding_model,
                embedding_provenance=embedding_provenance,
            )
