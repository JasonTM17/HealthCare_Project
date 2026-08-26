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
from typing import Callable, Collection, List, Mapping, Optional, Protocol

from app.schemas import MAX_EMBEDDING_DIMENSION, ProviderProvenance, SOURCE_TYPES


MAX_DOCUMENT_CHARS = 20_000
MAX_RAG_DOCUMENTS = 5_000
SYNC_REVISION_METADATA_KEY = "_sync_revision"
_IGNORED_HTML_TAGS = frozenset({"script", "style", "noscript", "template"})
_PROJECTION_METADATA_KEY = "projection_kind"
_PROJECTION_KINDS = frozenset({"OPERATIONAL", "CLINICAL"})


def normalize_projection_kind(metadata: Mapping[str, object] | None = None, value: str | None = None) -> str | None:
    """Normalize the optional projection discriminator used by patient chat.

    The legacy public RAG contract keys documents by ``source_type:source_id``.
    Patient chat has two intentionally separate projections for a specialty,
    so an explicit discriminator is required before those rows share an index.
    """

    candidate = value
    if candidate is None and metadata is not None:
        candidate = metadata.get(_PROJECTION_METADATA_KEY)  # type: ignore[assignment]
    normalized = str(candidate).strip().upper() if candidate is not None else ""
    return normalized if normalized in _PROJECTION_KINDS else None


def document_storage_key(
    source_type: str,
    source_id: str,
    *,
    metadata: Mapping[str, object] | None = None,
    projection: str | None = None,
) -> str:
    """Return an index key without changing the legacy ``RagDocument.id``."""

    normalized_projection = normalize_projection_kind(metadata, projection)
    if normalized_projection is None:
        return f"{source_type}:{source_id}"
    return f"{normalized_projection.lower()}:{source_type}:{source_id}"


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
    source_type: SOURCE_TYPES
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
                self.remove(doc.id, projection=normalize_projection_kind(doc.metadata))
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
            storage_key = document_storage_key(
                doc.source_type,
                doc.source_id,
                metadata=doc.metadata,
            )
            legacy_key = f"{doc.source_type}:{doc.source_id}"
            legacy = self._documents.get(legacy_key)
            if (
                legacy is not None
                and storage_key != legacy_key
                and normalize_projection_kind(legacy.metadata) == normalize_projection_kind(doc.metadata)
            ):
                # Upgrade a legacy operational row in place when the writer
                # starts emitting an explicit projection discriminator.
                self._documents.pop(legacy_key, None)
            if storage_key not in self._documents and self.size >= self.max_documents:
                raise EmbeddingContractError("RAG document limit reached")
            doc.embedding = vector
            doc.embedding_model = model
            doc.embedding_provenance = provenance
            self._documents[storage_key] = doc

    def remove(
        self,
        doc_id: str,
        *,
        projection: str | None = None,
        include_projections: bool = True,
    ) -> None:
        with self._lock:
            if projection is not None and ":" in doc_id:
                source_type, source_id = doc_id.split(":", 1)
                self._documents.pop(
                    document_storage_key(source_type, source_id, projection=projection),
                    None,
                )
                return
            self._documents.pop(doc_id, None)
            # A legacy caller does not carry a projection. Remove both bounded
            # patient-chat projections while preserving unrelated source IDs.
            if projection is None and include_projections and ":" in doc_id:
                source_type, source_id = doc_id.split(":", 1)
                for kind in _PROJECTION_KINDS:
                    self._documents.pop(
                        document_storage_key(source_type, source_id, projection=kind),
                        None,
                    )

    def get(self, doc_id: str, *, projection: str | None = None) -> Optional[RagDocument]:
        with self._lock:
            if projection is not None and ":" in doc_id:
                source_type, source_id = doc_id.split(":", 1)
                keyed = self._documents.get(
                    document_storage_key(source_type, source_id, projection=projection)
                )
                if keyed is not None:
                    return keyed
                legacy = self._documents.get(doc_id)
                normalized_target = normalize_projection_kind(value=projection)
                if (
                    legacy is not None
                    and normalized_target == "OPERATIONAL"
                    and normalize_projection_kind(legacy.metadata) in {None, "OPERATIONAL"}
                ):
                    return legacy
                return None
            direct = self._documents.get(doc_id)
            if direct is not None:
                return direct
            # Preserve compatibility for callers that only know the public
            # source identity. If both projections exist, ambiguity is a hard
            # miss; mode-specific callers must pass the projection.
            matches = [document for document in self._documents.values() if document.id == doc_id]
            return matches[0] if len(matches) == 1 else None

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

    def sources(self) -> list[tuple[SOURCE_TYPES, str]]:
        """Return the source identities currently present in the index."""

    def ingest(
        self,
        source_type: SOURCE_TYPES,
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

    def remove(
        self,
        source_type: SOURCE_TYPES,
        source_id: str,
        revision: int | None = None,
        *,
        projection: str | None = None,
    ) -> None:
        """Tombstone one projection, or all projections for a legacy caller."""


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
        self._latest_projection_states: dict[str, tuple[object, ...]] = {}
        self._operation_sequence = 0
        self._latest_operations: dict[str, int] = {}

    def health_probe(self) -> bool:
        """Return whether the in-memory index is ready for local use."""

        return True

    def ingest(
        self,
        source_type: SOURCE_TYPES,
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
        # Keep the database-owned governance hash (when supplied) separate
        # from the integrity hash of the visible text actually embedded.  A
        # canonical JSON snapshot hash and a rendered RAG-text hash are not
        # interchangeable; both must be carried for clinical authorization.
        document_metadata["visible_content_hash"] = content_hash
        projection = normalize_projection_kind(document_metadata)
        state_key = document_storage_key(
            source_type,
            source_id,
            projection=projection,
        )
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
        incoming_state = self._projection_state(document)
        # Clinical approval can be revoked and renewed without changing the
        # immutable content revision.  Its eligibility revision is therefore
        # the monotonic projection watermark; operational catalog sync keeps
        # using the explicit `_sync_revision` value.
        revision = self._revision(document_metadata)
        with self._revision_lock:
            existing = self.index.get(document_id, projection=projection)
            tombstone_revision = self._tombstones.get(state_key)
            existing_revision = self._revision(existing.metadata) if existing else None
            latest_revision = self._latest_revisions.get(state_key)
            if revision is not None:
                known_revisions = [
                    candidate
                    for candidate in (tombstone_revision, existing_revision, latest_revision)
                    if candidate is not None
                ]
                known_revision = max(known_revisions) if known_revisions else None
                if known_revision is not None and revision == known_revision:
                    authoritative_state = self._latest_projection_states.get(state_key)
                    if authoritative_state is None and existing is not None:
                        authoritative_state = self._projection_state(existing)
                    if (
                        authoritative_state is None
                        and tombstone_revision is not None
                        and existing is None
                    ):
                        authoritative_state = ("TOMBSTONE", projection)
                    if authoritative_state != incoming_state:
                        raise ValueError(
                            "equal-revision projection update must be idempotent"
                        )
                    if existing is not None:
                        return existing
                    # An exact replay of an inactive projection stays
                    # tombstoned and never performs embedding work.
                    if tombstone_revision is not None:
                        return document
                if known_revision is not None and revision < known_revision:
                    return existing or RagDocument(
                        id=document_id,
                        source_type=source_type,
                        source_id=source_id,
                        title=normalized_title,
                        content=normalized_content,
                        metadata=document_metadata,
                    )
                self._latest_revisions[state_key] = revision
                self._latest_projection_states[state_key] = incoming_state
            self._operation_sequence += 1
            operation_token = self._operation_sequence
            self._latest_operations[state_key] = operation_token

        # A sync revision prevents an older in-flight request from resurrecting
        # a source after a newer delete. Direct local/test calls without a
        # revision retain the legacy replace behavior.
        with self._revision_lock:
            if revision is None:
                self._tombstones.pop(state_key, None)
            else:
                if tombstone_revision is not None and revision <= tombstone_revision:
                    return existing or document
                if existing_revision is not None and revision < existing_revision:
                    assert existing is not None
                    return existing

        # Inactive or unpublished records are tombstoned from the searchable
        # index. This prevents stale public knowledge from remaining visible.
        if not document.searchable:
            self.remove(
                source_type,
                source_id,
                revision=revision,
                operation_token=operation_token,
                projection=projection,
            )
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
            current = self.index.get(document_id, projection=projection)
            if self._latest_operations.get(state_key) != operation_token:
                return current or document
            if revision is not None:
                current_revision = self._revision(current.metadata) if current else None
                current_tombstone = self._tombstones.get(state_key)
                if current_tombstone is not None and revision <= current_tombstone:
                    return current or document
                if current_revision is not None and revision < current_revision:
                    assert current is not None
                    return current
                if current_tombstone is not None and revision > current_tombstone:
                    self._tombstones.pop(state_key, None)
            self.index.add(document)
        return document

    def remove(
        self,
        source_type: SOURCE_TYPES,
        source_id: str,
        revision: int | None = None,
        *,
        operation_token: int | None = None,
        projection: str | None = None,
    ) -> None:
        normalized_projection = normalize_projection_kind(value=projection)
        target_projections: list[str | None] = (
            [normalized_projection]
            if normalized_projection is not None
            else [None, "OPERATIONAL", "CLINICAL"]
        )
        with self._revision_lock:
            for target_projection in target_projections:
                state_key = document_storage_key(
                    source_type,
                    source_id,
                    projection=target_projection,
                )
                existing = self.index.get(
                    f"{source_type}:{source_id}",
                    projection=target_projection,
                )
                if revision is not None:
                    current_revision = self._revision(existing.metadata) if existing else None
                    latest_revision = self._latest_revisions.get(state_key)
                    current_tombstone = self._tombstones.get(state_key)
                    known_revisions = [
                        candidate
                        for candidate in (current_tombstone, current_revision, latest_revision)
                        if candidate is not None
                    ]
                    known_revision = max(known_revisions) if known_revisions else None
                    if known_revision is not None and revision < known_revision:
                        continue
                    if (
                        operation_token is None
                        and known_revision is not None
                        and revision == known_revision
                    ):
                        if current_tombstone is not None and existing is None:
                            continue
                        raise ValueError(
                            "equal-revision projection update must be idempotent"
                        )
                    self._latest_revisions[state_key] = revision
                    if operation_token is None:
                        self._latest_projection_states[state_key] = (
                            "TOMBSTONE",
                            target_projection,
                        )
                    self._tombstones[state_key] = revision
                current_operation_token = operation_token
                if current_operation_token is None:
                    self._operation_sequence += 1
                    current_operation_token = self._operation_sequence
                    self._latest_operations[state_key] = current_operation_token
                self.index.remove(
                    f"{source_type}:{source_id}",
                    projection=target_projection,
                    include_projections=False,
                )

    @staticmethod
    def _projection_state(document: RagDocument) -> tuple[object, ...]:
        """Return the complete authoritative state for an idempotent revision."""

        return (
            document.title,
            document.content,
            document.active,
            document.published,
            tuple(sorted((str(key), str(value)) for key, value in document.metadata.items())),
        )

    @staticmethod
    def _revision(metadata: dict[str, str]) -> int | None:
        raw_revision = metadata.get(SYNC_REVISION_METADATA_KEY)
        if raw_revision is None:
            projection = normalize_projection_kind(metadata)
            if projection == "CLINICAL":
                # Approval/revocation/renewal changes advance eligibility even
                # when the canonical content snapshot remains unchanged.
                raw_revision = metadata.get("eligibility_revision")
            if raw_revision is None:
                raw_revision = metadata.get("content_revision")
        if raw_revision is None:
            return None
        try:
            revision = int(raw_revision)
        except (TypeError, ValueError):
            return None
        return revision if revision >= 0 else None

    def sources(self) -> list[tuple[SOURCE_TYPES, str]]:
        with self._revision_lock:
            return [(document.source_type, document.source_id) for document in self.index.documents]

    def source_page(self, offset: int = 0, limit: int = 1_000) -> tuple[list[RagDocument], int]:
        """Return a deterministic page and total for complete reconciliation."""

        bounded_offset = max(0, int(offset))
        bounded_limit = max(1, min(int(limit), 5_000))
        with self._revision_lock:
            documents = sorted(
                self.index.documents,
                key=lambda item: (item.source_type, item.source_id, item.id),
            )
        return documents[bounded_offset : bounded_offset + bounded_limit], len(documents)

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
