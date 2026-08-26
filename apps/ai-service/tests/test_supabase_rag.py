from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from app.config import Settings
from app.rag import RagDocument, RagService
from app.supabase_rag import (
    PersistentRagService,
    SupabaseRagConfig,
    SupabaseRagContractError,
    SupabaseRagStore,
    SupabaseRagUnavailable,
    build_rag_service,
    parse_vector,
    vector_literal,
)


class FakeCursor:
    def __init__(self, *, one: Any = None, many: list[Any] | None = None) -> None:
        self.one = one
        self.many = many or []
        self.executed: list[tuple[str, tuple[Any, ...] | None]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, sql: str, params: tuple[Any, ...] | None = None) -> None:
        self.executed.append((sql, params))

    def fetchone(self) -> Any:
        return self.one

    def fetchall(self) -> list[Any]:
        return self.many


class FakeConnection:
    def __init__(self, *cursors: FakeCursor) -> None:
        self.fake_cursors = list(cursors) or [FakeCursor()]
        self._fallback_cursor = self.fake_cursors[-1]
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self) -> FakeCursor:
        if self.fake_cursors:
            return self.fake_cursors.pop(0)
        return self._fallback_cursor

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.closed = True


def _config() -> SupabaseRagConfig:
    return SupabaseRagConfig(dsn="postgresql://service.test/healthcare")


def _document(revision: int = 7) -> RagDocument:
    return RagDocument(
        id="specialty:cardio",
        source_type="specialty",
        source_id="cardio",
        title="Tim mach",
        content="Kham tim mach.",
        embedding=[0.25] * 384,
        embedding_model="local-hash",
        embedding_provenance="local_provider",
        content_hash="a" * 64,
        active=True,
        published=True,
        metadata={"_sync_revision": str(revision), "slug": "tim-mach"},
    )


def test_vector_contract_is_fixed_and_finite() -> None:
    assert vector_literal([0.25] * 384).startswith("[0.25")
    assert len(parse_vector("[1,2.5,-3]")) == 3

    with pytest.raises(SupabaseRagContractError):
        vector_literal([0.0] * 383)
    with pytest.raises(SupabaseRagContractError):
        vector_literal([float("nan")] * 384)


def test_settings_default_to_memory_and_supabase_contract_is_explicit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in (
        "RAG_STORAGE_BACKEND",
        "SUPABASE_DB_URL",
        "SUPABASE_DB_SCHEMA",
        "SUPABASE_RAG_TABLE",
        "SUPABASE_RAG_RPC",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = Settings()
    assert settings.rag_storage_backend == "memory"
    assert settings.supabase_rag_configured is False
    assert isinstance(build_rag_service(settings), RagService)
    assert not isinstance(build_rag_service(settings), PersistentRagService)


def test_supabase_mode_requires_dsn_outside_local_runtime() -> None:
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="production",
        supabase_db_url="",
    )
    with pytest.raises(SupabaseRagUnavailable):
        build_rag_service(settings)


def test_supabase_mode_without_dsn_keeps_local_fallback() -> None:
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="test",
        supabase_db_url="",
    )
    assert isinstance(build_rag_service(settings), RagService)


def test_upsert_is_parameterized_and_revision_guarded() -> None:
    profile_cursor = FakeCursor(many=[])
    upsert_cursor = FakeCursor(one=("document-id",))
    connection = FakeConnection(profile_cursor, upsert_cursor)
    store = SupabaseRagStore(_config(), connection_factory=lambda _dsn, _timeout: connection)

    assert store.upsert(_document()) is True
    sql, params = upsert_cursor.executed[0]
    assert "on conflict (projection_kind, source_type, source_id)" in sql.lower()
    assert "excluded.eligibility_revision > \"healthcare\".\"ai_chat_documents\".eligibility_revision" in sql
    assert "deleted_at is null" in sql
    assert params is not None
    assert params[0] == "OPERATIONAL"
    assert params[1] == "specialty"
    assert params[11].startswith("[0.25")
    assert "Kham tim mach." not in sql
    assert connection.commits == 1
    assert connection.closed is True


def test_health_probe_checks_protected_projection_without_reading_content() -> None:
    cursor = FakeCursor(one=(False,))
    connection = FakeConnection(cursor)
    store = SupabaseRagStore(_config(), connection_factory=lambda _dsn, _timeout: connection)

    assert store.health_probe() is True
    sql, params = cursor.executed[0]
    assert "select exists" in sql.lower()
    assert "ai_chat_documents" in sql
    assert params is None


def test_search_maps_rpc_rows_to_citations_without_needing_raw_vectors() -> None:
    profile_cursor = FakeCursor(many=[("local-hash", "local_provider")])
    row = (
        "document-id",
        "specialty",
        "cardio",
        "Tim mach",
        "Kham tim mach.",
        {"slug": "tim-mach"},
        "OPERATIONAL",
        7,
        7,
        "a" * 64,
        None,
        None,
        None,
        "local-hash",
        "local_provider",
        True,
        True,
        0.91,
    )
    search_cursor = FakeCursor(many=[row])
    connection = FakeConnection(profile_cursor, search_cursor)
    store = SupabaseRagStore(_config(), connection_factory=lambda _dsn, _timeout: connection)

    results = store.search(
        [0.1] * 384,
        top_k=3,
        query_text="đau tim",
        embedding_model="local-hash",
    )
    assert len(results) == 1
    document, score = results[0]
    assert document.id == "specialty:cardio"
    assert document.source_type == "specialty"
    assert document.source_id == "cardio"
    assert document.metadata == {
        "slug": "tim-mach",
        "projection_kind": "OPERATIONAL",
        "content_revision": "7",
        "eligibility_revision": "7",
    }
    assert score == pytest.approx(0.91)
    assert "::extensions.vector(384)" in search_cursor.executed[0][0]
    assert "::text" in search_cursor.executed[0][0]
    params = search_cursor.executed[0][1]
    assert params is not None
    assert params[-1] == "đau tim"


def test_search_bounds_limit_and_passes_similarity_threshold_to_rpc() -> None:
    profile_cursor = FakeCursor(many=[("local-hash", "local_provider")])
    search_cursor = FakeCursor(many=[])
    connection = FakeConnection(profile_cursor, search_cursor)
    store = SupabaseRagStore(_config(), connection_factory=lambda _dsn, _timeout: connection)

    assert store.search(
        [0.1] * 384,
        top_k=10_000,
        match_threshold=0.35,
        embedding_model="local-hash",
    ) == []

    _, params = search_cursor.executed[0]
    assert params is not None
    # RPC receives a bounded limit even when a caller supplies an untrusted
    # value; threshold remains parameterized and is not interpolated into SQL.
    assert params[1] == pytest.approx(0.35)
    assert params[2] == 20


def test_search_rejects_unbounded_query_text() -> None:
    store = SupabaseRagStore(
        _config(),
        connection_factory=lambda _dsn, _timeout: FakeConnection(FakeCursor()),
    )
    with pytest.raises(SupabaseRagContractError):
        store.search([0.1] * 384, query_text="x" * 10_001)


def test_supabase_config_rejects_legacy_unprotected_table() -> None:
    with pytest.raises(SupabaseRagContractError):
        SupabaseRagConfig(
            dsn="postgresql://service.test/healthcare",
            table="ai_documents",
            rpc="match_documents",
        )


def test_clinical_upsert_requires_database_owned_approval_metadata() -> None:
    store = SupabaseRagStore(
        _config(),
        connection_factory=lambda _dsn, _timeout: FakeConnection(FakeCursor(many=[])),
    )
    document = _document()
    document.metadata.update({"projection_kind": "CLINICAL"})
    with pytest.raises(SupabaseRagContractError):
        store.upsert(document)


def test_stale_upsert_rejected_by_durable_tombstone_cannot_resurrect_memory() -> None:
    tombstone = RagDocument(
        id="specialty:cardio",
        source_type="specialty",
        source_id="cardio",
        title="[tombstone]",
        content="[tombstone]",
        metadata={"projection_kind": "OPERATIONAL", "eligibility_revision": "9"},
        active=False,
        published=False,
    )

    class RejectingStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def upsert(self, *_: object, **__: object) -> bool:
            return False

        def get(self, *_: object, **__: object) -> RagDocument:
            return tombstone

    service = PersistentRagService(RejectingStore(), fallback_to_memory=False)  # type: ignore[arg-type]
    service.ingest(
        "specialty",
        "cardio",
        "Tim mach",
        "Kham tim mach.",
        embedding=[0.25] * 384,
        metadata={"_sync_revision": "7"},
        embedding_model="local-hash",
        embedding_provenance="local_provider",
    )
    assert service.index.get("specialty:cardio", projection="OPERATIONAL") is None


class FailingStore:
    def list_documents(self, *_: object, **__: object) -> list[RagDocument]:
        raise SupabaseRagUnavailable("offline")

    def upsert(self, *_: object, **__: object) -> bool:
        raise SupabaseRagUnavailable("offline")

    def tombstone(self, *_: object, **__: object) -> bool:
        raise SupabaseRagUnavailable("offline")


class FlakyStore:
    def list_documents(self, *_: object, **__: object) -> list[RagDocument]:
        return []

    def upsert(self, *_: object, **__: object) -> bool:
        raise SupabaseRagUnavailable("offline")

    def tombstone(self, *_: object, **__: object) -> bool:
        raise SupabaseRagUnavailable("offline")

    def list_sources(self, *_: object, **__: object) -> list[tuple[str, str]]:
        raise SupabaseRagUnavailable("offline")

    def search(self, *_: object, **__: object) -> list[tuple[RagDocument, float]]:
        raise SupabaseRagUnavailable("offline")


def test_persistent_service_falls_back_to_memory_only_when_enabled() -> None:
    service = PersistentRagService(
        FailingStore(),  # type: ignore[arg-type]
        max_documents=5,
        fallback_to_memory=True,
    )
    document = service.ingest(
        "specialty",
        "cardio",
        "Tim mach",
        "Kham tim mach.",
        embedding=[0.25] * 384,
        metadata={"_sync_revision": "1"},
    )
    assert document.id == "specialty:cardio"
    assert service.persistence_available is False
    assert service.index.size == 1


def test_persistent_service_fails_closed_without_fallback() -> None:
    service = PersistentRagService(
        FlakyStore(),  # type: ignore[arg-type]
        max_documents=5,
        fallback_to_memory=False,
    )
    with pytest.raises(SupabaseRagUnavailable):
        service.ingest(
            "specialty",
            "cardio",
            "Tim mach",
            "Kham tim mach.",
            embedding=[0.25] * 384,
            metadata={"_sync_revision": "1"},
        )
    assert service.persistence_available is False
    assert service.index.size == 0


def test_artifacts_declare_catalog_customer_and_vector_contract() -> None:
    root = Path(__file__).resolve().parents[3]
    migration = (root / "supabase" / "migrations" / "20260822101722_healthcare_data_platform.sql").read_text(
        encoding="utf-8"
    )
    seed = (root / "supabase" / "seed.sql").read_text(encoding="utf-8")

    assert "create extension if not exists vector with schema extensions" in migration
    assert "using hnsw (embedding extensions.vector_cosine_ops)" in migration
    assert "alter table healthcare.customers enable row level security" in migration
    assert "create or replace function healthcare.match_documents" in migration
    assert "ts_rank_cd" in migration
    assert "real, integer, text[], text)" in migration
    assert "generate_series(1, 10000)" in seed
    assert "substring(c.customer_code from 4)::integer <= 7500" in seed
    assert "healthcare.synthetic_embedding" in seed
