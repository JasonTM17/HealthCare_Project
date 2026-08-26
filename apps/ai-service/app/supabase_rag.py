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
from functools import wraps
from threading import RLock
from typing import Any, Callable, Collection, Iterator, List, Mapping, Sequence, cast

from app.rag import (
    CLINICAL_SOURCE_TYPES,
    EmbeddingCallback,
    RagDocument,
    RagService,
    normalize_projection_kind,
)
from app.schemas import MAX_INPUT_CHARS, ProviderProvenance, SOURCE_TYPES


_IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")
_REVISION_KEY = "_sync_revision"
_TOMBSTONE_KEY = "_tombstone"
_LOCAL_RUNTIME_NAMES = frozenset({"local", "test", "demo"})
_PROJECTION_KINDS = frozenset({"OPERATIONAL", "CLINICAL"})
_CLINICAL_SOURCE_TYPES = CLINICAL_SOURCE_TYPES


class SupabaseRagError(RuntimeError):
    """Base class for durable RAG configuration and database failures."""


class SupabaseRagUnavailable(SupabaseRagError):
    """Raised when the configured Postgres dependency cannot be reached."""


class SupabaseRagContractError(SupabaseRagError, ValueError):
    """Raised when a document cannot satisfy the fixed pgvector contract."""


ConnectionFactory = Callable[[str, float], Any]


def _mutation_guard(method: Callable[..., Any]) -> Callable[..., Any]:
    """Serialize durable mutations that use whole-service snapshot rollback.

    ``PersistentRagService`` restores all in-memory watermarks when a durable
    write fails.  Without a service-wide guard, a concurrent mutation for a
    different source could commit between the snapshot and restore and then
    be erased by the failed operation.  The wrapped methods intentionally use
    an ``RLock`` because inactive ingestion delegates to ``self.remove``.
    """

    @wraps(method)
    def guarded(self: "PersistentRagService", *args: Any, **kwargs: Any) -> Any:
        with self._mutation_lock:
            return method(self, *args, **kwargs)

    return guarded


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
    raw = metadata.get("eligibility_revision")
    if raw is None:
        raw = metadata.get("content_revision")
    if raw is None:
        raw = metadata.get(_REVISION_KEY)
    if raw is None:
        return None
    try:
        value = int(str(raw))
    except (TypeError, ValueError):
        return None
    return value if value >= 0 else None


def _projection(metadata: Mapping[str, object]) -> str:
    value = str(metadata.get("projection_kind", "OPERATIONAL")).strip().upper()
    if value not in _PROJECTION_KINDS:
        raise SupabaseRagContractError("projection_kind must be OPERATIONAL or CLINICAL")
    return value


def _metadata_int(metadata: Mapping[str, object], *keys: str) -> int | None:
    for key in keys:
        raw = metadata.get(key)
        if raw is None:
            continue
        try:
            value = int(str(raw))
        except (TypeError, ValueError):
            raise SupabaseRagContractError(f"metadata field {key} must be an integer") from None
        if value <= 0:
            raise SupabaseRagContractError(f"metadata field {key} must be positive")
        return value
    return None


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
    table: str = "ai_chat_documents"
    rpc: str = "match_chat_documents"
    connect_timeout_seconds: float = 5.0
    embedding_dimension: int = 384
    max_documents: int = 5_000

    def __post_init__(self) -> None:
        if not self.dsn.strip():
            raise SupabaseRagContractError("SUPABASE_DB_URL is required for the Supabase backend")
        for identifier in (self.schema, self.table, self.rpc):
            _quote_identifier(identifier)
        if self.table != "ai_chat_documents" or self.rpc != "match_chat_documents":
            raise SupabaseRagContractError(
                "Supabase patient chat must use healthcare.ai_chat_documents and match_chat_documents"
            )
        if self.embedding_dimension != 384:
            raise SupabaseRagContractError("patient-chat vectors must use exactly 384 dimensions")
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
    """Small parameterized repository over the protected chat projection."""

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
            projection_kind,
            source_type,
            source_id,
            content_revision,
            eligibility_revision,
            database_content_hash,
            approval_round,
            approval_expires_at,
            title,
            content,
            metadata,
            embedding,
            embedding_model,
            embedding_provenance,
            active,
            published,
        ) = row
        normalized_source_type = cast(SOURCE_TYPES, str(source_type))
        normalized_source_id = str(source_id)
        # The UUID is a database identity; the public RAG contract identifies
        # a document by its stable source tuple.  Keeping that key here avoids
        # duplicate in-memory entries after hydration followed by an upsert.
        normalized_metadata = _metadata(metadata)
        normalized_metadata["projection_kind"] = str(projection_kind)
        normalized_metadata["content_revision"] = str(content_revision)
        normalized_metadata["eligibility_revision"] = str(eligibility_revision)
        if approval_round is not None:
            normalized_metadata["approval_id"] = str(approval_round)
        if approval_expires_at is not None:
            normalized_metadata["approval_expires_at"] = str(approval_expires_at)
        # The projection's database hash is the canonical clinical revision
        # hash.  RagDocument.content_hash remains the visible-text integrity
        # hash expected by the in-memory chatbot contract.
        visible_hash = hashlib.sha256(str(content).encode("utf-8")).hexdigest()
        if str(projection_kind).upper() == "CLINICAL":
            normalized_metadata["content_hash"] = str(database_content_hash)
        return RagDocument(
            id=f"{normalized_source_type}:{normalized_source_id}",
            source_type=normalized_source_type,
            source_id=normalized_source_id,
            title=str(title),
            content=str(content),
            embedding=parse_vector(embedding),
            embedding_model=str(embedding_model),
            embedding_provenance=cast(ProviderProvenance, str(embedding_provenance)),
            content_hash=visible_hash,
            active=bool(active),
            published=bool(published),
            metadata=normalized_metadata,
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
            raise SupabaseRagContractError("multiple embedding profiles exist in ai_chat_documents")
        return _profile_tuple(*rows[0][:2])

    def active_profile(self) -> tuple[str, ProviderProvenance] | None:
        with self._connection() as connection:
            return self._read_active_profile(connection)

    def health_probe(self) -> bool:
        """Verify the database and protected projection are reachable.

        The probe reads no document content and succeeds for an empty
        projection. Referencing the table also proves the service connection
        still has the required schema/table grant.
        """

        sql = f"select exists (select 1 from {self._table} limit 1)"
        try:
            with self._connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(sql)
                    row = cursor.fetchone()
            return bool(row and row[0] is not None)
        except Exception as exc:
            raise SupabaseRagUnavailable("Supabase RAG readiness probe failed") from exc

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
            "id, projection_kind, source_type, source_id, content_revision, "
            "eligibility_revision, content_hash, approval_round, approval_expires_at, "
            "title, content, metadata, embedding::text, embedding_model, "
            "embedding_provenance, active, published"
        )

    def upsert(self, document: RagDocument) -> bool:
        """Insert or update one document, respecting an optional sync revision."""

        if not document.embedding:
            raise SupabaseRagContractError("searchable documents require an embedding")
        embedding = vector_literal(document.embedding, self.config.embedding_dimension)
        projection = _projection(document.metadata)
        content_revision = _metadata_int(document.metadata, "content_revision", _REVISION_KEY)
        eligibility_revision = _metadata_int(
            document.metadata, "eligibility_revision", "content_revision", _REVISION_KEY
        )
        if content_revision is None:
            content_revision = 1
        if eligibility_revision is None:
            eligibility_revision = content_revision
        canonical_hash = str(document.metadata.get("content_hash", document.content_hash)).strip().lower()
        if not re.fullmatch(r"[0-9a-f]{64}", canonical_hash):
            raise SupabaseRagContractError("content_hash must be a lowercase SHA-256 value")
        approval_round = _metadata_int(document.metadata, "approval_round", "approval_id")
        approval_expires_at = document.metadata.get("approval_expires_at")
        if projection == "CLINICAL" and (approval_round is None or not approval_expires_at):
            raise SupabaseRagContractError("clinical projections require approval round and expiry")
        metadata = json.dumps(document.metadata, ensure_ascii=False, separators=(",", ":"))
        sql = f"""
            insert into {self._table} (
                projection_kind, source_type, source_id, content_revision,
                eligibility_revision, content_hash, approval_round,
                approval_expires_at, title, content, metadata, embedding,
                embedding_model, embedding_provenance, active, published, deleted_at
            ) values (
                %s, %s, %s, %s, %s, %s, %s, %s::timestamptz,
                %s, %s, %s::jsonb, %s::{self._vector_type}, %s, %s, %s, %s, null
            )
            on conflict (projection_kind, source_type, source_id) do update set
                content_revision = excluded.content_revision,
                eligibility_revision = excluded.eligibility_revision,
                approval_round = excluded.approval_round,
                approval_expires_at = excluded.approval_expires_at,
                title = excluded.title,
                content = excluded.content,
                metadata = excluded.metadata,
                embedding = excluded.embedding,
                embedding_model = excluded.embedding_model,
                embedding_provenance = excluded.embedding_provenance,
                content_hash = excluded.content_hash,
                active = excluded.active,
                published = excluded.published,
                deleted_at = null,
                updated_at = now()
            where (
                    excluded.eligibility_revision > {self._table}.eligibility_revision
                 or (
                    {self._table}.deleted_at is null
                    and
                    excluded.eligibility_revision = {self._table}.eligibility_revision
                    and excluded.content_revision = {self._table}.content_revision
                    and excluded.content_hash = {self._table}.content_hash
                 )
              )
            returning id
        """
        params = (
            projection,
            document.source_type,
            document.source_id,
            content_revision,
            eligibility_revision,
            canonical_hash,
            approval_round,
            approval_expires_at,
            document.title,
            document.content,
            metadata,
            embedding,
            document.embedding_model,
            document.embedding_provenance,
            document.active,
            document.published,
        )
        with self._connection() as connection:
            self._assert_profile(connection, document.embedding_model, document.embedding_provenance)
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                return cursor.fetchone() is not None

    def get(
        self,
        source_type: SOURCE_TYPES,
        source_id: str,
        *,
        projection: str | None = None,
    ) -> RagDocument | None:
        sql = f"""
            select {self._select_columns()}
            from {self._table}
            where source_type = %s and source_id = %s
              and projection_kind = %s
        """
        normalized_projection = (projection or "OPERATIONAL").strip().upper()
        if normalized_projection not in _PROJECTION_KINDS:
            raise SupabaseRagContractError("invalid projection kind")
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                cursor.execute(sql, (source_type, source_id, normalized_projection))
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

    def list_documents_page(self, offset: int = 0, limit: int = 1_000) -> tuple[list[RagDocument], int]:
        """Read a complete active-source snapshot a page at a time."""

        bounded_offset = max(0, int(offset))
        bounded_limit = max(1, min(int(limit), 5_000))
        sql = f"""
            select {self._select_columns()}
            from {self._table}
            where active and published and deleted_at is null and embedding is not null
            order by source_type, source_id, id
            offset %s limit %s
        """
        count_sql = f"""
            select count(*) from {self._table}
            where active and published and deleted_at is null and embedding is not null
        """
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                cursor.execute(count_sql)
                count_row = cursor.fetchone()
                total = int(count_row[0]) if count_row else 0
                cursor.execute(sql, (bounded_offset, bounded_limit))
                rows = cursor.fetchall()
        return [self._document_from_row(row) for row in rows], total

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
        *,
        projection: str = "OPERATIONAL",
    ) -> bool:
        """Persist one deletion marker in one database transaction."""

        return self.tombstone_many(
            source_type,
            source_id,
            revision,
            projections=[projection],
        ) == 1

    def tombstone_many(
        self,
        source_type: SOURCE_TYPES,
        source_id: str,
        revision: int | None,
        *,
        projections: Collection[str],
    ) -> int:
        """Persist multiple projection tombstones atomically.

        A projection-less legacy delete has an all-projection meaning.  Keep
        both upserts on one connection/transaction so a restart cannot see a
        partially applied delete and hydrate the clinical projection.
        """

        normalized_projections: list[str] = []
        for projection in projections:
            normalized_projection = projection.strip().upper()
            if normalized_projection not in _PROJECTION_KINDS:
                raise SupabaseRagContractError("invalid projection kind")
            if normalized_projection not in normalized_projections:
                normalized_projections.append(normalized_projection)
        if not normalized_projections:
            raise SupabaseRagContractError("at least one projection is required")
        if "CLINICAL" in normalized_projections and (revision is None or revision <= 0):
            # A clinical tombstone must carry the database-owned eligibility
            # watermark.  Falling back to revision 1 would let a legacy
            # delete remove only memory while a higher durable row survives
            # and rehydrates after restart.
            raise SupabaseRagContractError("clinical tombstone requires a positive revision")
        revision_value = revision if revision is not None and revision > 0 else 1
        content = "[tombstone]"
        sql = f"""
            insert into {self._table} (
                projection_kind, source_type, source_id, content_revision,
                eligibility_revision, content_hash, title, content, metadata,
                embedding, embedding_model, embedding_provenance,
                active, published, deleted_at
            ) values (
                %s, %s, %s, %s, %s, %s, '[tombstone]', %s, %s::jsonb,
                null, 'local-hash', 'local_provider', false, false, now()
            )
            on conflict (projection_kind, source_type, source_id) do update set
                content_revision = excluded.content_revision,
                eligibility_revision = excluded.eligibility_revision,
                title = excluded.title,
                content = excluded.content,
                metadata = excluded.metadata,
                embedding = null,
                embedding_model = excluded.embedding_model,
                embedding_provenance = excluded.embedding_provenance,
                content_hash = excluded.content_hash,
                active = false,
                published = false,
                deleted_at = now(),
                updated_at = now()
            where excluded.eligibility_revision > {self._table}.eligibility_revision
               or (
                    excluded.eligibility_revision = {self._table}.eligibility_revision
                    and excluded.content_hash = {self._table}.content_hash
                    and {self._table}.deleted_at is not null
               )
            returning id
        """
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        with self._connection() as connection:
            self._read_active_profile(connection)
            with connection.cursor() as cursor:
                applied = 0
                for normalized_projection in normalized_projections:
                    metadata = json.dumps(
                        {
                            "projection_kind": normalized_projection,
                            "content_revision": str(revision_value),
                            "eligibility_revision": str(revision_value),
                            _REVISION_KEY: str(revision_value),
                            _TOMBSTONE_KEY: "true",
                        },
                        separators=(",", ":"),
                    )
                    cursor.execute(
                        sql,
                        (
                            normalized_projection,
                            source_type,
                            source_id,
                            revision_value,
                            revision_value,
                            content_hash,
                            content,
                            metadata,
                        ),
                    )
                    if cursor.fetchone() is not None:
                        applied += 1
                return applied

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
                   projection_kind, content_revision, eligibility_revision,
                   content_hash, approval_round, approval_expires_at,
                   null::text as embedding, embedding_model, embedding_provenance,
                   active, published, score
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
            # RPC result order is normalized to the table projection contract.
            normalized_row = (
                row[0], row[6], row[1], row[2], row[7], row[8], row[9],
                row[10], row[11], row[3], row[4], row[5], row[12],
                row[13], row[14], row[15], row[16],
            )
            document = self._document_from_row(normalized_row)
            results.append((document, float(row[17])))
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
        # Mutations below restore a complete in-memory snapshot when durable
        # persistence rejects/fails.  Serialize those critical sections so a
        # concurrent mutation for another source cannot be erased by the
        # rollback.  This is re-entrant because inactive ingestion delegates
        # to ``self.remove``.
        self._mutation_lock = RLock()
        # Memory fallback is permitted only when this process has never
        # completed a durable operation. Once Supabase has answered any
        # authoritative read/write (even an empty snapshot or tombstone), a
        # later outage must fail closed instead of serving a divergent cache.
        self._durable_authority_seen = False
        # A successful durable read/write means the in-memory index may carry
        # data that is newer or older than the database after a dependency
        # failure.  Once that authority has been observed, never answer from
        # the stale local copy while the durable service is unavailable.
        self._durable_content_seen = False
        # A durable embedding profile is authority even when the projection
        # has no documents yet.  Remember that observation separately from
        # ``_durable_content_seen`` so a profile contract failure cannot be
        # followed by an unsafe memory fallback.
        self._durable_profile_seen = False
        # A failed readiness probe should fence later mutations back to
        # local-only until the durable authority answers cleanly again.
        self._durable_probe_unhealthy = False
        self._durable_probe_supported = callable(getattr(self.store, "health_probe", None))
        try:
            self._hydrate()
            self.persistence_available = True
        except SupabaseRagContractError:
            # A malformed/contradictory durable snapshot is not a transient
            # outage. Remember that the durable authority rejected this
            # process so a later request cannot silently use local fallback.
            self._durable_authority_seen = True
            if not fallback_to_memory:
                raise
        except Exception:
            if not fallback_to_memory:
                raise

    def _hydrate(self) -> None:
        documents = self.store.list_documents()
        self._durable_authority_seen = True
        self._durable_content_seen = bool(documents)
        for document in documents:
            if document.embedding:
                self.index.add(document)

    def _memory_fallback_is_safe(self, source_types: Collection[str] | None) -> bool:
        """Return whether memory-only retrieval is safe after a DB outage.

        Clinical projections are never served from memory after the durable
        authority is unavailable.  A service that hydrated any durable
        content is likewise fail-closed so a restart/failover cannot expose a
        stale snapshot.  A brand-new local-only service may still use its
        explicit development fallback.
        """

        if self._durable_authority_seen:
            return False
        if self._durable_profile_seen:
            return False
        allowed_source_types = set(source_types) if source_types else None
        for document in self.index.documents:
            if normalize_projection_kind(document.metadata) != "CLINICAL":
                continue
            if allowed_source_types is None or document.source_type in allowed_source_types:
                return False
        return True

    def _fallback_or_raise(self, error: Exception) -> None:
        self.persistence_available = False
        if not self.fallback_to_memory:
            raise SupabaseRagUnavailable("Supabase RAG operation failed") from error

    def _prepare_durable_mutation(self) -> bool:
        """Return whether this mutation must stay local-only.

        A process that started during a Supabase outage may still be allowed
        to use the explicit local-development fallback for operational
        upserts.  Before it writes, probe the durable authority when the store
        exposes that capability.  If the probe succeeds, fence the mutation
        before the write so a later commit-then-timeout cannot be reported as
        a successful memory fallback.  If the probe fails before any durable
        authority has ever answered, skip the durable write entirely and keep
        the existing local fallback boundary narrow and explicit.
        """

        if self._durable_probe_unhealthy:
            self.persistence_available = False
            if not self._durable_authority_seen:
                if not self.fallback_to_memory:
                    raise SupabaseRagUnavailable("Supabase RAG mutation failed")
                return True
            raise SupabaseRagUnavailable("Supabase RAG mutation failed")
        if self._durable_authority_seen:
            return False
        probe_obj = getattr(self.store, "health_probe", None)
        if not callable(probe_obj):
            # Constructor-time capability checks are cached for the normal
            # store, but keep the call site guarded as the authority boundary
            # in case a test double or adapter mutates after initialization.
            self.persistence_available = False
            return True
        probe = cast(Callable[[], bool], probe_obj)
        try:
            healthy = bool(probe())
        except SupabaseRagContractError:
            self._durable_authority_seen = True
            self._durable_probe_unhealthy = True
            self.persistence_available = False
            raise
        except Exception:
            self._durable_probe_unhealthy = True
            self.persistence_available = False
            return True
        if healthy:
            self._durable_authority_seen = True
            self._durable_probe_unhealthy = False
            self.persistence_available = True
            return False
        self._durable_probe_unhealthy = True
        self.persistence_available = False
        return True

    def _snapshot_state(
        self,
    ) -> tuple[
        dict[str, RagDocument],
        dict[str, int],
        dict[str, int],
        dict[str, tuple[object, ...]],
        int,
        dict[str, int],
    ]:
        with self.index._lock:
            return (
                dict(self.index._documents),
                dict(self._tombstones),
                dict(self._latest_revisions),
                dict(self._latest_projection_states),
                self._operation_sequence,
                dict(self._latest_operations),
            )

    def _restore_state(
        self,
        snapshot: tuple[
            dict[str, RagDocument],
            dict[str, int],
            dict[str, int],
            dict[str, tuple[object, ...]],
            int,
            dict[str, int],
        ],
    ) -> None:
        (
            documents,
            tombstones,
            latest_revisions,
            latest_projection_states,
            operation_sequence,
            latest_operations,
        ) = snapshot
        with self.index._lock:
            self.index._documents = dict(documents)
        self._tombstones = dict(tombstones)
        self._latest_revisions = dict(latest_revisions)
        self._latest_projection_states = dict(latest_projection_states)
        self._operation_sequence = operation_sequence
        self._latest_operations = dict(latest_operations)

    def _require_fallback(self) -> None:
        if not self.persistence_available and not self.fallback_to_memory:
            raise SupabaseRagUnavailable("Supabase RAG operation failed")

    def health_probe(self) -> bool:
        """Check durable RAG readiness without silently using stale memory."""

        with self._mutation_lock:
            if self._durable_probe_supported:
                try:
                    healthy = bool(self.store.health_probe())
                    self.persistence_available = healthy
                    self._durable_probe_unhealthy = not healthy
                    if healthy:
                        self._durable_authority_seen = True
                    return healthy
                except SupabaseRagContractError:
                    self._durable_probe_unhealthy = True
                    self._durable_authority_seen = True
                    self.persistence_available = False
                    return False
                except Exception as error:
                    self._durable_probe_unhealthy = True
                    self.persistence_available = False
                    if self._durable_authority_seen:
                        return False
                    self._fallback_or_raise(error)
                    return False
            if not self.persistence_available:
                return self.fallback_to_memory and not self._durable_authority_seen
            return True

    @_mutation_guard
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
        snapshot = self._snapshot_state()
        prior_persistence_available = self.persistence_available
        memory_only_mutation = False
        if not self._durable_probe_supported and not self._durable_authority_seen:
            if not self.fallback_to_memory:
                self._restore_state(snapshot)
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG mutation failed")
            memory_only_mutation = True
        else:
            memory_only_mutation = self._prepare_durable_mutation()
        try:
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
        except SupabaseRagUnavailable:
            # ``RagService.ingest`` can delegate inactive documents to this
            # class' durable ``remove`` method.  That method has already
            # restored the pre-event snapshot and marked persistence
            # unavailable; preserve that signal instead of resetting it to
            # the value observed before entering ``super()``.
            self._restore_state(snapshot)
            raise
        except SupabaseRagContractError:
            # Inactive ingestion delegates to ``self.remove``. Preserve the
            # durable contract failure signal and its sticky authority fence
            # instead of restoring the pre-call availability flag.
            self._restore_state(snapshot)
            self._durable_authority_seen = True
            self.persistence_available = False
            raise
        except Exception:
            # ``RagService.ingest`` advances revision/operation watermarks
            # before it invokes an embedder.  If embedding or normalization
            # fails, restore every mutation so a deterministic retry with the
            # same revision is accepted rather than treated as a stale event.
            self._restore_state(snapshot)
            self.persistence_available = prior_persistence_available
            raise
        if memory_only_mutation:
            try:
                self._require_fallback()
            except SupabaseRagUnavailable:
                self._restore_state(snapshot)
                raise
            return document
        durable_rejection = False
        try:
            if document.searchable:
                applied = self.store.upsert(document)
                self._durable_authority_seen = True
                if not applied:
                    durable_rejection = True
                    current = self.store.get(
                        source_type,
                        document.source_id,
                        projection=_projection(document.metadata),
                    )
                    self._durable_authority_seen = True
                    if current is not None:
                        # A stale event must never reintroduce a local row
                        # that the durable store rejected, including a
                        # tombstone. Restore the pre-event in-memory state.
                        self._restore_state(snapshot)
                        if current.searchable and current.embedding:
                            self.index.add(current)
                        else:
                            projection_kind = _projection(document.metadata)
                            self.index.remove(document.id, projection=projection_kind)
                            if projection_kind == "OPERATIONAL":
                                # Legacy operational rows predate the
                                # discriminator and live under the direct
                                # source key; clear that compatibility key as
                                # well without touching clinical projections.
                                self.index.remove(
                                    document.id,
                                    projection=None,
                                    include_projections=False,
                                )
                        self.persistence_available = True
                        if current.searchable and current.embedding:
                            self._durable_content_seen = True
                        return current
                    # A false return is the store's conflict/no-op signal,
                    # not a provider contract exception.  Preserve the
                    # historical unavailable error so callers cannot mistake
                    # a rejected write for a successful memory fallback.
                    raise SupabaseRagUnavailable("durable upsert rejected")
                self._durable_content_seen = True
            else:
                # ``RagService.ingest`` delegates non-searchable documents to
                # ``self.remove``. Since this subclass overrides ``remove``,
                # that call already wrote and verified the projection-aware
                # durable tombstone; do not issue a second write here.
                pass
            self.persistence_available = True
        except SupabaseRagContractError:
            # Contract violations are deterministic and cannot be made safe
            # by serving a potentially stale local document, even when the
            # development fallback flag is enabled.
            self._restore_state(snapshot)
            self._durable_authority_seen = True
            self.persistence_available = False
            raise
        except SupabaseRagUnavailable as error:
            if durable_rejection:
                # A rejected durable write is never eligible for the local
                # fallback: the database may still hold a newer row or
                # tombstone. Restore the pre-event snapshot and require an
                # explicit retry with authoritative provenance.
                self._restore_state(snapshot)
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG mutation failed") from error
            if not self.fallback_to_memory:
                self._restore_state(snapshot)
            elif not document.searchable:
                # A durable delete/revoke cannot be treated as a successful
                # memory fallback: the durable row may still be active. Keep
                # the old memory state and require an explicit retry.
                self._restore_state(snapshot)
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG mutation failed") from error
            elif self._durable_authority_seen:
                # Once durable authority has been observed, a local-only
                # success would be misleading: a restart could rehydrate a
                # different durable row and the caller would have no durable
                # acknowledgement for this mutation. Restore the pre-event
                # snapshot and fail closed instead.
                self._restore_state(snapshot)
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG mutation failed") from error
            self._fallback_or_raise(error)
        except AttributeError as error:
            # A test/local adapter that does not expose the optional durable
            # write method behaves like an unavailable dependency.  Keep the
            # explicit fallback narrow to this capability-missing case;
            # arbitrary adapter errors remain fail-closed below.
            if not self.fallback_to_memory or self._durable_authority_seen:
                self._restore_state(snapshot)
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG mutation failed") from error
            self._fallback_or_raise(SupabaseRagUnavailable("Supabase RAG adapter unavailable"))
        except Exception as error:
            # Only an explicitly classified dependency outage is eligible for
            # memory fallback.  Unexpected adapter errors fail closed.
            self._restore_state(snapshot)
            self.persistence_available = False
            raise SupabaseRagUnavailable("Supabase RAG mutation failed") from error
        self._require_fallback()
        return document

    @_mutation_guard
    def remove(
        self,
        source_type: SOURCE_TYPES,
        source_id: str,
        revision: int | None = None,
        *,
        operation_token: int | None = None,
        projection: str | None = None,
    ) -> None:
        normalized_projection = projection.strip().upper() if projection else None
        if normalized_projection not in {None, "OPERATIONAL", "CLINICAL"}:
            raise SupabaseRagContractError("invalid projection kind")
        if (
            (normalized_projection == "CLINICAL" or (
                normalized_projection is None
                and source_type in _CLINICAL_SOURCE_TYPES
            ))
            and (revision is None or revision <= 0)
        ):
            # Do not clear the in-memory clinical projection unless the
            # caller supplies the current database-owned eligibility revision.
            # This keeps a failed legacy delete from creating a restart-only
            # resurrection window.
            raise SupabaseRagContractError("clinical delete requires a positive revision")
        snapshot = self._snapshot_state()
        prior_persistence_available = self.persistence_available
        memory_only_mutation = False
        if not self._durable_probe_supported and not self._durable_authority_seen:
            if not self.fallback_to_memory:
                self._restore_state(snapshot)
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG mutation failed")
            memory_only_mutation = True
        else:
            memory_only_mutation = self._prepare_durable_mutation()
        try:
            # Base-service validation and watermark updates are part of the
            # same rollback boundary as the durable tombstone. Projectionless
            # clinical deletes touch multiple projections; an equal-revision
            # conflict in a later target must not leave earlier targets
            # tombstoned in memory when no durable write was sent.
            super().remove(
                source_type,
                source_id,
                revision=revision,
                operation_token=operation_token,
                projection=projection,
            )
            if memory_only_mutation:
                self._require_fallback()
                return
            # A projection-less clinical delete removes every in-memory view;
            # operational legacy deletes only need an operational tombstone.
            # Never manufacture a clinical watermark for an operational source.
            if projection is None:
                projections = (
                    ["OPERATIONAL", "CLINICAL"]
                    if source_type in _CLINICAL_SOURCE_TYPES
                    else ["OPERATIONAL"]
                )
            else:
                assert normalized_projection is not None
                projections = [normalized_projection]
            if len(projections) > 1 and hasattr(self.store, "tombstone_many"):
                applied = self.store.tombstone_many(  # type: ignore[attr-defined]
                    source_type,
                    source_id,
                    revision,
                    projections=projections,
                )
                self._durable_authority_seen = True
                if applied != len(projections):
                    raise SupabaseRagContractError("durable tombstone rejected")
            else:
                for normalized_projection in projections:
                    applied = self.store.tombstone(
                        source_type,
                        source_id,
                        revision,
                        projection=normalized_projection,
                    )
                    self._durable_authority_seen = True
                    if not applied:
                        raise SupabaseRagContractError("durable tombstone rejected")
            self.persistence_available = True
        except SupabaseRagContractError:
            self._restore_state(snapshot)
            self._durable_authority_seen = True
            self.persistence_available = False
            raise
        except ValueError:
            self._restore_state(snapshot)
            self.persistence_available = prior_persistence_available
            raise
        except Exception as error:
            # A mutation cannot safely fall back after durable failure. Keep
            # the pre-delete snapshot intact so a later restart cannot
            # rehydrate a durable row that this process reported as removed.
            self._restore_state(snapshot)
            self.persistence_available = False
            raise SupabaseRagUnavailable("Supabase RAG mutation failed") from error

    def sources(self) -> list[tuple[SOURCE_TYPES, str]]:
        if not self.persistence_available:
            with self._mutation_lock:
                if self._durable_authority_seen:
                    raise SupabaseRagUnavailable("Supabase RAG operation failed")
                self._require_fallback()
                return super().sources()
        try:
            sources = self.store.list_sources()
            self._durable_authority_seen = True
            return sources
        except SupabaseRagContractError:
            self._durable_authority_seen = True
            self.persistence_available = False
            raise
        except Exception as error:
            if self._durable_authority_seen:
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
            self._fallback_or_raise(error)
            if not self.fallback_to_memory:
                raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
            return super().sources()

    def source_page(self, offset: int = 0, limit: int = 1_000) -> tuple[list[RagDocument], int]:
        if not self.persistence_available:
            with self._mutation_lock:
                if self._durable_authority_seen:
                    raise SupabaseRagUnavailable("Supabase RAG operation failed")
                self._require_fallback()
                return super().source_page(offset, limit)
        try:
            page = self.store.list_documents_page(offset, limit)
            self._durable_authority_seen = True
            return page
        except SupabaseRagContractError:
            self._durable_authority_seen = True
            self.persistence_available = False
            raise
        except Exception as error:
            if self._durable_authority_seen:
                self.persistence_available = False
                raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
            self._fallback_or_raise(error)
            if not self.fallback_to_memory:
                raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
            return super().source_page(offset, limit)

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
            # Hold the same guard as mutations across the safety check and
            # local search. Otherwise a durable ingest could become
            # authoritative between those two operations and the caller
            # would receive a stale memory answer after the commit.
            with self._mutation_lock:
                if not self._memory_fallback_is_safe(source_types):
                    raise SupabaseRagUnavailable("Supabase RAG operation failed")
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
                self._durable_authority_seen = True
                self._durable_profile_seen = profile is not None
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
            except SupabaseRagContractError:
                # A contract failure (including multiple persisted profiles)
                # is itself durable-authority evidence.  Do not allow a later
                # request to silently fall back to stale in-memory content.
                self._durable_profile_seen = True
                self._durable_authority_seen = True
                self.persistence_available = False
                raise
            except SupabaseRagUnavailable as error:
                if not self._memory_fallback_is_safe(source_types):
                    self.persistence_available = False
                    raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
                self._fallback_or_raise(error)
                if not self.fallback_to_memory:
                    raise SupabaseRagUnavailable("Supabase RAG operation failed") from error
            except Exception as error:
                self.persistence_available = False
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
