"""Supabase/Postgres persistence for the bounded RAG contract.

The current service deliberately defaults to :class:`RagService` in memory.
This module adds an opt-in pgvector store without changing the public document
contract: one source identity, bounded content, active/published filtering,
idempotent ingest, and monotonic sync tombstones.

The adapter uses a direct PostgreSQL URI (or a Supavisor URI) rather than a
Supabase client because pgvector similarity operators are exposed through the
database RPC created by the Supabase migration.  Every SQL value is
parameterized; configurable identifiers are validated before interpolation.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Collection, Iterator, List, Mapping, Sequence, cast

from app.rag import EmbeddingCallback, RagDocument, RagService
from app.schemas import MAX_INPUT_CHARS, ProviderProvenance, SOURCE_TYPES


_IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")
_REVISION_KEY = "_sync_revision"
_TOMBSTONE_KEY = "_tombstone"
_LOCAL_RUNTIME_NAMES = frozenset({"local", "test", "demo"})


class SupabaseRagError(RuntimeError):
    """Base class for durable RAG configuration and database failures."""


class SupabaseRagUnavailable(SupabaseRagError):
    """Raised when the configured Postgres dependency cannot be reached."""


class SupabaseRagContractError(SupabaseRagError, ValueError):
    """Raised when a document cannot satisfy the fixed pgvector contract."""


ConnectionFactory = Callable[[str, float], Any]


def _quote_identifier(value: str) -> str:
    """Validate a configured identifier before using it in a SQL statement."""

    if not _IDENTIFIER.fullmatch(value):
        raise SupabaseRagContractError(f"invalid SQL identifier: {value!r}")
    return f'"{value}"'


def vector_literal(values: Sequence[float], dimension: int = 384) -> str:
    """Serialize a finite, fixed-size vector to pgvector's text input form."""

    if len(values) != dimension:
        raise SupabaseRagContractError(
            f"embedding dimension {len(values)} does not match configured dimension {dimension}"
        )
    normalized: list[str] = []
    for value in values:
        number = float(value)
        if not math.isfinite(number):
            raise SupabaseRagContractError("embedding contains a non-finite value")
        normalized.append(format(number, ".9g"))
    return "[" + ",".join(normalized) + "]"


def parse_vector(value: object) -> list[float]:
    """Parse the text representation returned by psycopg for a vector column."""

    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [float(item) for item in value]
    raw = str(value).strip()
    if not (raw.startswith("[") and raw.endswith("]")):
        raise SupabaseRagContractError("database returned an invalid vector representation")
    body = raw[1:-1].strip()
    return [] if not body else [float(item) for item in body.split(",")]


def _revision(metadata: Mapping[str, object]) -> int | None:
    raw = metadata.get(_REVISION_KEY)
    if raw is None:
        return None
    try:
        value = int(str(raw))
    except (TypeError, ValueError):
        return None
    return value if value >= 0 else None


def _metadata(value: object) -> dict[str, str]:
    if value is None:
        return {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise SupabaseRagContractError("database returned invalid document metadata") from exc
    if not isinstance(value, Mapping):
        raise SupabaseRagContractError("database returned non-object document metadata")
    return {str(key): str(item) for key, item in value.items()}


def _profile_tuple(model: object, provenance: object) -> tuple[str, ProviderProvenance]:
    normalized_model = str(model).strip()
    normalized_provenance = str(provenance).strip()
    if not normalized_model or normalized_provenance not in {
        "local_provider",
        "remote_provider",
        "local_fallback",
    }:
        raise SupabaseRagContractError("database returned an invalid embedding profile")
    return normalized_model, cast(ProviderProvenance, normalized_provenance)


@dataclass(frozen=True)
class SupabaseRagConfig:
    """Connection and schema contract for the Supabase adapter."""

    dsn: str
    schema: str = "healthcare"
    table: str = "ai_documents"
    rpc: str = "match_documents"
    connect_timeout_seconds: float = 5.0
    embedding_dimension: int = 384
    max_documents: int = 5_000

    def __post_init__(self) -> None:
        if not self.dsn.strip():
            raise SupabaseRagContractError("SUPABASE_DB_URL is required for the Supabase backend")
        for identifier in (self.schema, self.table, self.rpc):
            _quote_identifier(identifier)
        if self.embedding_dimension != 384:
            raise SupabaseRagContractError(
                "the healthcare.ai_documents migration currently supports exactly 384 dimensions"
            )
        if self.connect_timeout_seconds <= 0 or self.connect_timeout_seconds > 30:
            raise SupabaseRagContractError("Supabase connection timeout must be between 0 and 30 seconds")
        if self.max_documents < 1:
            raise SupabaseRagContractError("max_documents must be positive")

    @classmethod
    def from_settings(cls, settings: Any) -> "SupabaseRagConfig":
        return cls(
            dsn=str(settings.supabase_db_url),
            schema=str(settings.supabase_db_schema),
            table=str(settings.supabase_rag_table),
            rpc=str(settings.supabase_rag_rpc),
            connect_timeout_seconds=float(settings.supabase_db_connect_timeout_seconds),
            embedding_dimension=int(settings.rag_embedding_dimension),
            max_documents=int(settings.rag_max_documents),
        )


class SupabaseRagStore:
    """Small parameterized repository over ``healthcare.ai_documents``."""

    def __init__(
        self,
        config: SupabaseRagConfig,
        *,
        connection_factory: ConnectionFactory | None = None,
    ) -> None:
        self.config = config
        self._connection_factory = connection_factory
        self._table = f"{_quote_identifier(config.schema)}.{_quote_identifier(config.table)}"
        self._rpc = f"{_quote_identifier(config.schema)}.{_quote_identifier(config.rpc)}"
        self._vector_type = f"extensions.vector({config.embedding_dimension})"

    def _open(self) -> Any:
        if self._connection_factory is not None:
            try:
                return self._connection_factory(
                    self.config.dsn,
                    self.config.connect_timeout_seconds,
                )
            except Exception as exc:  # pragma: no cover - exercised by integration environments
                raise SupabaseRagUnavailable("Supabase database connection failed") from exc
        try:
            import psycopg
        except ImportError as exc:  # pragma: no cover - dependency installation concern
            raise SupabaseRagUnavailable("psycopg is required for Supabase RAG persistence") from exc
        try:
            return psycopg.connect(
                self.config.dsn,
                connect_timeout=math.ceil(self.config.connect_timeout_seconds),
            )
        except Exception as exc:  # pragma: no cover - exercised by integration environments
            raise SupabaseRagUnavailable("Supabase database connection failed") from exc

    @contextmanager
    def _connection(self) -> Iterator[Any]:
        connection = self._open()
        try:
            yield connection
            commit = getattr(connection, "commit", None)
            if callable(commit):
                commit()
        except Exception:
            rollback = getattr(connection, "rollback", None)
            if callable(rollback):
                rollback()
            raise
        finally:
            close = getattr(connection, "close", None)
            if callable(close):
                close()

    def _document_from_row(self, row: Sequence[object]) -> RagDocument:
        (
            _database_id,
            source_type,
            source_id,
            title,
            content,
            metadata,
            embedding,
            embedding_model,
            embedding_provenance,
            content_hash,
            active,
            published,
        ) = row
        normalized_source_type = cast(SOURCE_TYPES, str(source_type))
        normalized_source_id = str(source_id)
        # The UUID is a database identity; the public RAG contract identifies
        # a document by its stable source tuple.  Keeping that key here avoids
        # duplicate in-memory entries after hydration followed by an upsert.
        return RagDocument(
            id=f"{normalized_source_type}:{normalized_source_id}",
            source_type=normalized_source_type,
            source_id=normalized_source_id,
            title=str(title),
            content=str(content),
            embedding=parse_vector(embedding),
            embedding_model=str(embedding_model),
            embedding_provenance=cast(ProviderProvenance, str(embedding_provenance)),
            content_hash=str(content_hash),
            active=bool(active),
            published=bool(published),
            metadata=_metadata(metadata),
        )

    def _read_active_profile(self, connection: Any) -> tuple[str, ProviderProvenance] | None:
        sql = f"""
            select embedding_model, embedding_provenance
            from {self._table}
            where active and published and deleted_at is null and embedding is not null
            group by embedding_model, embedding_provenance
            order by count(*) desc, embedding_model, embedding_provenance
            limit 2
        """
        with connection.cursor() as cursor:
            cursor.execute(sql)
            rows = cursor.fetchall()
        if not rows:
            return None
        if len(rows) > 1:
            raise SupabaseRagContractError(
                "multiple embedding profiles exist in healthcare.ai_documents"
            )
        return _profile_tuple(*rows[0][:2])

    def active_profile(self) -> tuple[str, ProviderProvenance] | None:
        with self._connection() as connection:
            return self._read_active_profile(connection)

    def _assert_profile(
        self,
        connection: Any,
        embedding_model: str,
        embedding_provenance: ProviderProvenance,
    ) -> None:
        profile = self._read_active_profile(connection)
        if profile and profile != (embedding_model, embedding_provenance):
            raise SupabaseRagContractError(
                "embedding model or provenance does not match the persisted profile"
            )

    def _select_columns(self) -> str:
        return (
            "id, source_type, source_id, title, content, metadata, "
            "embedding::text, embedding_model, embedding_provenance, content_hash, active, published"
        )

    def upsert(self, document: RagDocument) -> bool:
        """Insert or update one document, respecting an optional sync revision."""

        if not document.embedding:
            raise SupabaseRagContractError("searchable documents require an embedding")
        embedding = vector_literal(document.embedding, self.config.embedding_dimension)
        revision = _revision(document.metadata)
        revision_value = revision if revision is not None else 0
        metadata = json.dumps(document.metadata, ensure_ascii=False, separators=(",", ":"))
        content_hash = document.content_hash or hashlib.sha256(document.content.encode("utf-8")).hexdigest()
        revision_guard = (
            f"where excluded.sync_revision >= {self._table}.sync_revision"
            if revision is not None
            else ""
        )
        sql = f"""
            insert into {self._table} (
                source_type, source_id, title, content, metadata, embedding,
                embedding_model, embedding_provenance, content_hash,
                sync_revision, active, published, deleted_at
            ) values (
                %s, %s, %s, %s, %s::jsonb, %s::{self._vector_type},
                %s, %s, %s, %s, %s, %s, null
            )
            on conflict (source_type, source_id) do update set
                title = excluded.title,
                content = excluded.content,
                metadata = excluded.metadata,
                embedding = excluded.embedding,
                embedding_model = excluded.embedding_model,
                embedding_provenance = excluded.embedding_provenance,
                content_hash = excluded.content_hash,
                sync_revision = excluded.sync_revision,
                active = excluded.active,
                published = excluded.published,
                deleted_at = null,
                updated_at = now()
            {revision_guard}
            returning id
        """
        params = (
            document.source_type,
            document.source_id,
            document.title,
            document.content,
            metadata,
            embedding,
            document.embedding_model,
            document.embedding_provenance,
            content_hash,
            revision_value,
            document.active,
            document.published,
        )
        with self._connection() as connection:
            self._assert_profile(connection, document.embedding_model, document.embedding_provenance)
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                return cursor.fetchone() is not None

    def get(self, source_type: SOURCE_TYPES, source_id: str) -> RagDocument | None:
        sql = f"""
            select {self._select_columns()}
            from {self._table}
            where source_type = %s and source_id = %s
        """
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                cursor.execute(sql, (source_type, source_id))
                row = cursor.fetchone()
        return self._document_from_row(row) if row is not None else None

    def list_documents(self, limit: int | None = None) -> list[RagDocument]:
        bounded_limit = min(limit or self.config.max_documents, self.config.max_documents)
        sql = f"""
            select {self._select_columns()}
            from {self._table}
            where active and published and deleted_at is null and embedding is not null
            order by updated_at desc, id
            limit %s
        """
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                cursor.execute(sql, (bounded_limit,))
                rows = cursor.fetchall()
        return [self._document_from_row(row) for row in rows]

    def list_sources(self) -> list[tuple[SOURCE_TYPES, str]]:
        sql = f"""
            select source_type, source_id
            from {self._table}
            where active and published and deleted_at is null
            order by source_type, source_id
            limit %s
        """
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                cursor.execute(sql, (self.config.max_documents,))
                rows = cursor.fetchall()
        return [(cast(SOURCE_TYPES, str(row[0])), str(row[1])) for row in rows]

    def count(self) -> int:
        sql = f"""
            select count(*)
            from {self._table}
            where active and published and deleted_at is null
        """
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                cursor.execute(sql)
                row = cursor.fetchone()
        return int(row[0]) if row else 0

    def tombstone(
        self,
        source_type: SOURCE_TYPES,
        source_id: str,
        revision: int | None,
    ) -> bool:
        """Persist a deletion marker so stale sync work cannot resurrect a source."""

        revision_value = revision if revision is not None else 0
        metadata = json.dumps(
            {_REVISION_KEY: str(revision_value), _TOMBSTONE_KEY: "true"},
            separators=(",", ":"),
        )
        content = "[tombstone]"
        revision_guard = (
            f"where excluded.sync_revision >= {self._table}.sync_revision"
            if revision is not None
            else ""
        )
        sql = f"""
            insert into {self._table} (
                source_type, source_id, title, content, metadata, embedding,
                embedding_model, embedding_provenance, content_hash,
                sync_revision, active, published, deleted_at
            ) values (
                %s, %s, '[tombstone]', %s, %s::jsonb, null,
                'local-hash', 'local_provider', %s, %s, false, false, now()
            )
            on conflict (source_type, source_id) do update set
                title = excluded.title,
                content = excluded.content,
                metadata = excluded.metadata,
                embedding = null,
                embedding_model = excluded.embedding_model,
                embedding_provenance = excluded.embedding_provenance,
                content_hash = excluded.content_hash,
                sync_revision = excluded.sync_revision,
                active = false,
                published = false,
                deleted_at = now(),
                updated_at = now()
            {revision_guard}
            returning id
        """
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                cursor.execute(
                    sql,
                    (source_type, source_id, content, metadata, content_hash, revision_value),
                )
                return cursor.fetchone() is not None

    def search(
        self,
        query_embedding: Sequence[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
        match_threshold: float = 0.0,
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
    ) -> list[tuple[RagDocument, float]]:
        """Use the migration's bounded SECURITY INVOKER hybrid RPC."""

        embedding = vector_literal(query_embedding, self.config.embedding_dimension)
        if len(query_text) > MAX_INPUT_CHARS:
            raise SupabaseRagContractError("RAG query exceeds the maximum input size")
        normalized_query_text = query_text.strip()
        bounded_top_k = max(1, min(int(top_k), 20))
        bounded_threshold = max(-1.0, min(float(match_threshold), 1.0))
        filters = list(source_types) if source_types else None
        sql = f"""
            select id, source_type, source_id, title, content, metadata,
                   null::text as embedding, embedding_model, embedding_provenance,
                   content_hash, active, published, score
            from {self._rpc}(
                %s::{self._vector_type}, %s::real, %s::integer, %s::text[], %s::text
            )
            order by score desc, id
        """
        with self._connection() as connection:
            self._assert_profile(connection, embedding_model, embedding_provenance)
            with connection.cursor() as cursor:
                cursor.execute(
                    sql,
                    (embedding, bounded_threshold, bounded_top_k, filters, normalized_query_text),
                )
                rows = cursor.fetchall()
        results: list[tuple[RagDocument, float]] = []
        for row in rows:
            document = self._document_from_row(row[:12])
            results.append((document, float(row[12])))
        return results[:bounded_top_k]


class PersistentRagService(RagService):
    """RagService with durable writes/search and a bounded local fallback."""

    def __init__(
        self,
        store: SupabaseRagStore,
        *,
        max_documents: int = 5_000,
        fallback_to_memory: bool = False,
    ) -> None:
        super().__init__(max_documents=max_documents)
        self.store = store
        self.fallback_to_memory = fallback_to_memory
        self.persistence_available = False
        try:
            self._hydrate()
            self.persistence_available = True
        except Exception:
            if not fallback_to_memory:
                raise

    def _hydrate(self) -> None:
        for document in self.store.list_documents():
            if document.embedding:
                self.index.add(document)

    def _fallback_or_raise(self, error: Exception) -> None:
        self.persistence_available = False
        if not self.fallback_to_memory:
            raise SupabaseRagUnavailable("Supabase RAG operation failed") from error

    def _snapshot_state(
        self,
    ) -> tuple[dict[str, RagDocument], dict[str, int], dict[str, int], int, dict[str, int]]:
        return (
            dict(self.index._documents),
            dict(self._tombstones),
            dict(self._latest_revisions),
            self._operation_sequence,
            dict(self._latest_operations),
        )

    def _restore_state(
        self,
        snapshot: tuple[dict[str, RagDocument], dict[str, int], dict[str, int], int, dict[str, int]],
    ) -> None:
        documents, tombstones, latest_revisions, operation_sequence, latest_operations = snapshot
        self.index._documents = dict(documents)
        self._tombstones = dict(tombstones)
        self._latest_revisions = dict(latest_revisions)
        self._operation_sequence = operation_sequence
        self._latest_operations = dict(latest_operations)

    def _require_fallback(self) -> None:
        if not self.persistence_available and not self.fallback_to_memory:
            raise SupabaseRagUnavailable("Supabase RAG operation failed")

    def _restore_index_entry(self, previous: RagDocument | None, document_id: str) -> None:
        if previous is None:
            self.index.remove(document_id)
            return
        self.index.add(previous)

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
        document_id = f"{source_type}:{source_id}"
        previous = self.index.get(document_id)
        snapshot = self._snapshot_state()
        document = super().ingest(
            source_type,
            source_id,
            title,
            content,
            embedding,
            active=active,
            published=published,
            metadata=metadata,
            embedding_model=embedding_model,
            embedding_provenance=embedding_provenance,
            embedder=embedder,
        )
        revision = _revision(document.metadata)
        try:
            if document.searchable:
                applied = self.store.upsert(document)
                if not applied and revision is not None:
                    current = self.store.get(source_type, document.source_id)
                    if current is not None and current.searchable and current.embedding:
                        self.index.add(current)
                        self.persistence_available = True
                        return current
            else:
                self.store.tombstone(source_type, document.source_id, revision)
            self.persistence_available = True
        except Exception as error:
            if not self.fallback_to_memory:
                self._restore_state(snapshot)
                self._restore_index_entry(previous, document_id)
            self._fallback_or_raise(error)
        self._require_fallback()
        return document

    def remove(
        self,
        source_type: SOURCE_TYPES,
        source_id: str,
        revision: int | None = None,
        *,
        operation_token: int | None = None,
    ) -> None:
        document_id = f"{source_type}:{source_id}"
        previous = self.index.get(document_id)
        snapshot = self._snapshot_state()
        super().remove(source_type, source_id, revision=revision, operation_token=operation_token)
        try:
            self.store.tombstone(source_type, source_id, revision)
            self.persistence_available = True
        except Exception as error:
            if not self.fallback_to_memory:
                self._restore_state(snapshot)
                self._restore_index_entry(previous, document_id)
            self._fallback_or_raise(error)

    def sources(self) -> list[tuple[SOURCE_TYPES, str]]:
        if not self.persistence_available:
            self._require_fallback()
            return super().sources()
        try:
            return self.store.list_sources()
        except Exception as error:
            self._fallback_or_raise(error)
            if not self.fallback_to_memory:
                raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
            return super().sources()

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        *,
        query_text: str = "",
        source_types: Collection[str] | None = None,
        embedding_model: str = "provided",
        embedding_provenance: ProviderProvenance = "local_provider",
    ) -> list[tuple[RagDocument, float]]:
        if not self.persistence_available:
            self._require_fallback()
            return super().search(
                query_embedding,
                top_k,
                query_text=query_text,
                source_types=source_types,
                embedding_model=embedding_model,
                embedding_provenance=embedding_provenance,
            )
        if self.persistence_available:
            try:
                profile = self.store.active_profile()
                if profile and profile != (embedding_model, embedding_provenance):
                    raise SupabaseRagContractError(
                        "query embedding profile does not match the persisted profile"
                    )
                return self.store.search(
                    query_embedding,
                    top_k,
                    query_text=query_text,
                    source_types=source_types,
                    embedding_model=embedding_model,
                    embedding_provenance=embedding_provenance,
                )
            except Exception as error:
                self._fallback_or_raise(error)
                if not self.fallback_to_memory:
                    raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
        return super().search(
            query_embedding,
            top_k,
            query_text=query_text,
            source_types=source_types,
            embedding_model=embedding_model,
            embedding_provenance=embedding_provenance,
        )


def build_rag_service(settings: Any) -> RagService:
    """Select durable storage only when explicitly configured.

    A missing DSN is a configuration error for non-local Supabase mode. Local,
    test, and demo runtimes intentionally fall back to the existing service so
    unit tests and offline development never require a network database.
    """

    backend = str(getattr(settings, "rag_storage_backend", "memory")).strip().casefold()
    max_documents = int(getattr(settings, "rag_max_documents", 5_000))
    if backend != "supabase":
        return RagService(max_documents=max_documents)

    runtime = str(getattr(settings, "ai_service_runtime", "non-local")).strip().casefold()
    fallback = bool(getattr(settings, "supabase_rag_fallback_to_memory", True)) and runtime in _LOCAL_RUNTIME_NAMES
    dsn = str(getattr(settings, "supabase_db_url", ""))
    if not dsn.strip():
        if fallback:
            return RagService(max_documents=max_documents)
        raise SupabaseRagUnavailable("RAG_STORAGE_BACKEND=supabase requires SUPABASE_DB_URL")

    config = SupabaseRagConfig.from_settings(settings)
    return PersistentRagService(
        SupabaseRagStore(config),
        max_documents=max_documents,
        fallback_to_memory=fallback,
    )
