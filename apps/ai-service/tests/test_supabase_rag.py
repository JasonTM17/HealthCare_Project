from __future__ import annotations

from pathlib import Path
from typing import Any, Collection

import pytest

from app.config import Settings
from app.rag import RagDocument, RagService
from app.schemas import ProviderProvenance
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


def test_tombstone_only_advances_database_watermark_and_is_idempotent() -> None:
    profile_cursor = FakeCursor(many=[])
    tombstone_cursor = FakeCursor(one=None)
    connection = FakeConnection(profile_cursor, tombstone_cursor)
    store = SupabaseRagStore(_config(), connection_factory=lambda _dsn, _timeout: connection)

    # A durable row with a newer database-owned revision must remain
    # authoritative.  PostgreSQL returns no row for this stale/equal delete;
    # the adapter treats that as a safe no-op rather than resurrecting or
    # mutating the active projection.
    assert store.tombstone("article", "stale", revision=5, projection="CLINICAL") is False
    sql, params = tombstone_cursor.executed[0]
    assert "excluded.eligibility_revision > \"healthcare\".\"ai_chat_documents\".eligibility_revision" in sql
    assert "excluded.eligibility_revision = \"healthcare\".\"ai_chat_documents\".eligibility_revision" in sql
    assert params is not None
    assert params[0:4] == ("CLINICAL", "article", "stale", 5)
    assert connection.commits == 1


def test_tombstone_many_rolls_back_both_projections_as_one_transaction() -> None:
    class FailOnSecondExecuteCursor(FakeCursor):
        def __init__(self) -> None:
            super().__init__(many=[])
            self.calls = 0

        def execute(self, sql: str, params: tuple[Any, ...] | None = None) -> None:
            self.calls += 1
            if self.calls == 2:
                raise RuntimeError("synthetic clinical tombstone failure")
            super().execute(sql, params)

    profile_cursor = FakeCursor(many=[])
    tombstone_cursor = FailOnSecondExecuteCursor()
    connection = FakeConnection(profile_cursor, tombstone_cursor)
    store = SupabaseRagStore(_config(), connection_factory=lambda _dsn, _timeout: connection)

    with pytest.raises(RuntimeError, match="synthetic clinical tombstone failure"):
        store.tombstone_many(
            "specialty",
            "cardio",
            revision=12,
            projections=["OPERATIONAL", "CLINICAL"],
        )

    assert tombstone_cursor.calls == 2
    assert connection.commits == 0
    assert connection.rollbacks == 1


def test_clinical_tombstone_requires_database_owned_revision() -> None:
    store = SupabaseRagStore(
        _config(),
        connection_factory=lambda _dsn, _timeout: FakeConnection(FakeCursor()),
    )

    with pytest.raises(
        SupabaseRagContractError,
        match="clinical tombstone requires a positive revision",
    ):
        store.tombstone_many(
            "article",
            "guide",
            revision=None,
            projections=["CLINICAL"],
        )


def test_projectionless_delete_persists_operational_and_clinical_tombstones() -> None:
    class RecordingStore:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, int | None, str]] = []

        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone(
            self,
            source_type: str,
            source_id: str,
            revision: int | None,
            *,
            projection: str,
        ) -> bool:
            self.calls.append((source_type, source_id, revision, projection))
            return True

    store = RecordingStore()
    service = PersistentRagService(store, fallback_to_memory=False)  # type: ignore[arg-type]

    service.remove("specialty", "cardio", revision=12)

    assert store.calls == [
        ("specialty", "cardio", 12, "OPERATIONAL"),
        ("specialty", "cardio", 12, "CLINICAL"),
    ]


def test_projectionless_delete_uses_atomic_store_batch_when_available() -> None:
    class AtomicStore:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, int | None, tuple[str, ...]]] = []

        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone_many(
            self,
            source_type: str,
            source_id: str,
            revision: int | None,
            *,
            projections: Collection[str],
        ) -> int:
            self.calls.append((source_type, source_id, revision, tuple(projections)))
            return len(tuple(projections))

        def tombstone(self, *_: object, **__: object) -> bool:
            raise AssertionError("legacy per-projection fallback must not be used")

    store = AtomicStore()
    service = PersistentRagService(store, fallback_to_memory=False)  # type: ignore[arg-type]

    service.remove("specialty", "cardio", revision=12)

    assert store.calls == [("specialty", "cardio", 12, ("OPERATIONAL", "CLINICAL"))]


def test_projectionless_operational_delete_only_writes_operational_tombstone() -> None:
    class RecordingStore:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, int | None, str]] = []

        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone(
            self,
            source_type: str,
            source_id: str,
            revision: int | None,
            *,
            projection: str,
        ) -> bool:
            self.calls.append((source_type, source_id, revision, projection))
            return True

    store = RecordingStore()
    service = PersistentRagService(store, fallback_to_memory=False)  # type: ignore[arg-type]

    service.remove("branch", "hcm")

    assert store.calls == [("branch", "hcm", None, "OPERATIONAL")]


def test_projectionless_clinical_delete_without_revision_keeps_memory_authoritative() -> None:
    class RecordingStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone_many(self, *_: object, **__: object) -> int:
            raise AssertionError("durable delete must not start without a clinical revision")

    service = PersistentRagService(RecordingStore(), fallback_to_memory=False)  # type: ignore[arg-type]
    document = RagDocument(
        id="article:guide",
        source_type="article",
        source_id="guide",
        title="Guide",
        content="Clinical guide",
        embedding=[0.1] * 384,
        embedding_model="local-hash",
        embedding_provenance="local_provider",
        metadata={"projection_kind": "CLINICAL", "eligibility_revision": "7"},
    )
    service.index.add(document)

    with pytest.raises(
        SupabaseRagContractError,
        match="clinical delete requires a positive revision",
    ):
        service.remove("article", "guide")

    assert service.index.get("article:guide", projection="CLINICAL") is document


def test_projection_scoped_delete_does_not_write_the_other_tombstone() -> None:
    class RecordingStore:
        def __init__(self) -> None:
            self.calls: list[str] = []

        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone(self, *_: object, projection: str) -> bool:
            self.calls.append(projection)
            return True

    store = RecordingStore()
    service = PersistentRagService(store, fallback_to_memory=False)  # type: ignore[arg-type]

    service.remove("article", "guide", revision=3, projection="CLINICAL")

    assert store.calls == ["CLINICAL"]


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


def test_embedder_failure_restores_revision_state_for_deterministic_retry() -> None:
    class DurableStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def upsert(self, document: RagDocument) -> bool:
            assert document.source_id == "cardio"
            return True

    attempts = 0

    def flaky_embedder(
        _: str,
    ) -> list[float] | tuple[list[float], str, ProviderProvenance]:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ValueError("transient embedding failure")
        return ([0.25] * 384, "local-hash", "local_provider")

    service = PersistentRagService(
        DurableStore(),  # type: ignore[arg-type]
        fallback_to_memory=False,
    )
    with pytest.raises(ValueError, match="transient embedding failure"):
        service.ingest(
            "specialty",
            "cardio",
            "Tim mach",
            "Kham tim mach.",
            metadata={"_sync_revision": "11"},
            embedder=flaky_embedder,
        )

    # ``RagService.ingest`` had already advanced these before the callback;
    # the durable wrapper must roll them back so the same event can retry.
    assert service.index.size == 0
    assert service._latest_revisions == {}
    assert service._latest_projection_states == {}
    assert service._latest_operations == {}
    assert service._operation_sequence == 0

    retried = service.ingest(
        "specialty",
        "cardio",
        "Tim mach",
        "Kham tim mach.",
        metadata={"_sync_revision": "11"},
        embedder=flaky_embedder,
    )
    assert retried.id == "specialty:cardio"
    assert service.index.get("specialty:cardio", projection="OPERATIONAL") is retried


def test_contract_error_from_durable_upsert_never_falls_back_to_memory() -> None:
    class ContractStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def upsert(self, *_: object, **__: object) -> bool:
            raise SupabaseRagContractError("invalid durable projection")

    service = PersistentRagService(
        ContractStore(),  # type: ignore[arg-type]
        fallback_to_memory=True,
    )

    with pytest.raises(SupabaseRagContractError, match="invalid durable projection"):
        service.ingest(
            "branch",
            "hcm",
            "Chi nhánh",
            "Khám tại cơ sở.",
            embedding=[0.25] * 384,
        )

    assert service.persistence_available is False
    assert service.index.size == 0


def test_search_fails_closed_for_clinical_memory_after_durable_outage() -> None:
    class OutageStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def search(self, *_: object, **__: object) -> list[tuple[RagDocument, float]]:
            raise SupabaseRagUnavailable("offline")

    service = PersistentRagService(
        OutageStore(),  # type: ignore[arg-type]
        fallback_to_memory=True,
    )
    clinical = RagDocument(
        id="article:guide",
        source_type="article",
        source_id="guide",
        title="Clinical guide",
        content="Nội dung đã duyệt.",
        embedding=[0.25] * 384,
        embedding_model="provided",
        embedding_provenance="local_provider",
        metadata={"projection_kind": "CLINICAL", "eligibility_revision": "4"},
    )
    service.index.add(clinical)

    with pytest.raises(SupabaseRagUnavailable, match="Supabase RAG operation failed"):
        service.search(
            [0.25] * 384,
            source_types=["article"],
        )

    assert service.persistence_available is False


def test_search_fails_closed_after_hydrating_durable_content() -> None:
    durable = RagDocument(
        id="branch:hcm",
        source_type="branch",
        source_id="hcm",
        title="Chi nhánh",
        content="Khám tại cơ sở.",
        embedding=[0.25] * 384,
        embedding_model="provided",
        embedding_provenance="local_provider",
        metadata={"projection_kind": "OPERATIONAL", "eligibility_revision": "1"},
    )

    class OutageStore:
        def list_documents(self) -> list[RagDocument]:
            return [durable]

        def active_profile(self) -> tuple[str, str] | None:
            return ("provided", "local_provider")

        def search(self, *_: object, **__: object) -> list[tuple[RagDocument, float]]:
            raise SupabaseRagUnavailable("offline")

    service = PersistentRagService(
        OutageStore(),  # type: ignore[arg-type]
        fallback_to_memory=True,
    )
    with pytest.raises(SupabaseRagUnavailable, match="Supabase RAG operation failed"):
        service.search([0.25] * 384)

    assert service.persistence_available is False


def test_search_contract_mismatch_never_uses_memory_fallback() -> None:
    class ContractStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def active_profile(self) -> tuple[str, str] | None:
            return ("durable-model", "local_provider")

        def search(self, *_: object, **__: object) -> list[tuple[RagDocument, float]]:
            raise AssertionError("search should not be called after profile mismatch")

    service = PersistentRagService(
        ContractStore(),  # type: ignore[arg-type]
        fallback_to_memory=True,
    )
    service.index.add(
        RagDocument(
            id="branch:hcm",
            source_type="branch",
            source_id="hcm",
            title="Chi nhánh",
            content="Khám tại cơ sở.",
            embedding=[0.25] * 384,
            embedding_model="provided",
            embedding_provenance="local_provider",
        )
    )

    with pytest.raises(SupabaseRagContractError, match="query embedding profile"):
        service.search([0.25] * 384)

    assert service.persistence_available is False


def test_remove_durable_failure_restores_memory_and_never_reports_success() -> None:
    class FailingDeleteStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone(self, *_: object, **__: object) -> bool:
            raise SupabaseRagUnavailable("offline")

    service = PersistentRagService(
        FailingDeleteStore(),  # type: ignore[arg-type]
        max_documents=5,
        fallback_to_memory=True,
    )
    document = service.ingest(
        "branch",
        "hcm",
        "Chi nhánh",
        "Khám tại cơ sở.",
        embedding=[0.25] * 384,
        metadata={"_sync_revision": "1"},
    )
    assert service.persistence_available is False

    with pytest.raises(SupabaseRagUnavailable, match="Supabase RAG mutation failed"):
        service.remove("branch", "hcm")

    assert service.index.get("branch:hcm") is document
    assert service.persistence_available is False


def test_stale_durable_tombstone_restores_memory_and_never_reports_success() -> None:
    class StaleDeleteStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def upsert(self, *_: object, **__: object) -> bool:
            return True

        def tombstone(self, *_: object, **__: object) -> bool:
            # Simulates PostgreSQL ON CONFLICT rejecting an older revision.
            return False

    service = PersistentRagService(
        StaleDeleteStore(),  # type: ignore[arg-type]
        max_documents=5,
        fallback_to_memory=False,
    )
    document = service.ingest(
        "branch",
        "hcm",
        "Chi nhánh",
        "Khám tại cơ sở.",
        embedding=[0.25] * 384,
        metadata={"_sync_revision": "1"},
    )

    with pytest.raises(SupabaseRagUnavailable, match="Supabase RAG mutation failed"):
        service.remove("branch", "hcm", revision=2)

    assert service.index.get("branch:hcm") is document
    assert service.persistence_available is False


def test_inactive_clinical_ingest_tombstones_the_clinical_projection() -> None:
    class RecordingStore:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, int | None, str]] = []

        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone(
            self,
            source_type: str,
            source_id: str,
            revision: int | None,
            *,
            projection: str,
        ) -> bool:
            self.calls.append((source_type, source_id, revision, projection))
            return True

    store = RecordingStore()
    service = PersistentRagService(store, fallback_to_memory=False)  # type: ignore[arg-type]

    service.ingest(
        "article",
        "guide",
        "Hướng dẫn",
        "Nội dung đã duyệt.",
        embedding=[0.25] * 384,
        active=False,
        metadata={
            "projection_kind": "CLINICAL",
            "content_revision": "4",
            "eligibility_revision": "7",
        },
    )

    assert store.calls == [("article", "guide", 7, "CLINICAL")]


def test_inactive_durable_tombstone_rejection_restores_memory_and_fails_closed() -> None:
    class RejectingStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def tombstone(self, *_: object, **__: object) -> bool:
            return False

    service = PersistentRagService(
        RejectingStore(),  # type: ignore[arg-type]
        max_documents=5,
        fallback_to_memory=True,
    )

    with pytest.raises(SupabaseRagUnavailable, match="Supabase RAG mutation failed"):
        service.ingest(
            "branch",
            "hcm",
            "Chi nhánh",
            "Không còn hoạt động.",
            embedding=[0.25] * 384,
            active=False,
        )

    assert service.index.size == 0
    assert service.persistence_available is False


def test_revisionless_durable_upsert_rejection_restores_memory_and_fails_closed() -> None:
    class RejectingStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def upsert(self, *_: object, **__: object) -> bool:
            # Simulates a newer durable tombstone winning the conflict.
            return False

        def get(self, *_: object, **__: object) -> RagDocument | None:
            return None

    service = PersistentRagService(
        RejectingStore(),  # type: ignore[arg-type]
        max_documents=5,
        fallback_to_memory=True,
    )

    with pytest.raises(SupabaseRagUnavailable, match="Supabase RAG mutation failed"):
        service.ingest(
            "branch",
            "hcm",
            "Chi nhánh",
            "Bản ghi cũ.",
            embedding=[0.25] * 384,
        )

    assert service.index.size == 0
    assert service.persistence_available is False


def test_failed_upsert_preserves_other_projection_state() -> None:
    class FailingStore:
        def list_documents(self) -> list[RagDocument]:
            return []

        def upsert(self, *_: object, **__: object) -> bool:
            raise SupabaseRagUnavailable("offline")

    service = PersistentRagService(FailingStore(), fallback_to_memory=False)  # type: ignore[arg-type]
    vector = [0.25] * 384
    operational = RagDocument(
        id="article:guide",
        source_type="article",
        source_id="guide",
        title="Operational",
        content="Operational content",
        embedding=vector.copy(),
        embedding_model="local-hash",
        embedding_provenance="local_provider",
        metadata={"projection_kind": "OPERATIONAL", "_sync_revision": "1"},
    )
    clinical = RagDocument(
        id="article:guide",
        source_type="article",
        source_id="guide",
        title="Clinical",
        content="Clinical content",
        embedding=vector.copy(),
        embedding_model="local-hash",
        embedding_provenance="local_provider",
        metadata={
            "projection_kind": "CLINICAL",
            "content_revision": "1",
            "eligibility_revision": "1",
        },
    )
    service.index.add(operational)
    service.index.add(clinical)

    with pytest.raises(SupabaseRagUnavailable):
        service.ingest(
            "article",
            "guide",
            "Updated",
            "Updated content",
            embedding=vector,
            embedding_model="local-hash",
            metadata={"projection_kind": "OPERATIONAL", "_sync_revision": "2"},
        )

    assert service.index.get("article:guide", projection="OPERATIONAL") is operational
    assert service.index.get("article:guide", projection="CLINICAL") is clinical


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
