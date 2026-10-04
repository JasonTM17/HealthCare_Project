"""Public-chat acceleration: greeting fast path and the deterministic cache lane.

Ordering contract under test: the safety regex, the clinical-education
short-circuit and the greeting fast path all run BEFORE any cache lookup, and
only grounded, cited, single-turn ANSWER responses are ever stored.
"""

import pytest
from fastapi.testclient import TestClient

from app import main
from app.public_chat_acceleration import (
    PublicChatResponseCache,
    is_cacheable_public_response,
    public_chat_cache_key,
    public_greeting_response,
)
from app.rag import RagService
from app.schemas import ChatMode, ChatResponse, ChatSafetyAction


def _service() -> RagService:
    # Title must carry the operational type label ("Gói khám: ...") — the
    # public relevance gate only grounds package rows with that identity.
    service = RagService()
    service.ingest(
        "package",
        "goi-tong-quat",
        "Gói khám: Khám tổng quát",
        "Gói khám: Khám tổng quát tại HealthCare có giá 1.000.000 đồng, "
        "bao gồm khám lâm sàng và xét nghiệm máu cơ bản.",
        [1.0] + [0.0] * 383,
        embedding_model="local-hash",
    )
    return service


class _CountingService:
    """Proxy that counts searches so a cache hit is directly observable."""

    def __init__(self, inner: RagService) -> None:
        self._inner = inner
        self.search_calls = 0

    def search(self, *args: object, **kwargs: object) -> object:
        self.search_calls += 1
        return self._inner.search(*args, **kwargs)  # type: ignore[arg-type]

    def __getattr__(self, name: str) -> object:
        return getattr(self._inner, name)


def _setup_public_lane(monkeypatch: pytest.MonkeyPatch) -> _CountingService:
    counting = _CountingService(_service())
    monkeypatch.setattr(main, "rag_service", counting)
    monkeypatch.setattr(main, "embed", lambda *_, **__: ([1.0] + [0.0] * 383, "local-hash"))
    monkeypatch.setattr(main.settings, "ai_service_token", "")
    monkeypatch.setattr(main.settings, "ai_service_runtime", "local")
    monkeypatch.setattr(main.settings, "ai_service_allow_unauthenticated_local", True)
    monkeypatch.setattr(main.settings, "ai_provider", "local")
    monkeypatch.setattr(main.settings, "embedding_provider", "local")
    monkeypatch.setattr(main.settings, "ai_chat_relevance_threshold", 0.0)
    main._public_chat_cache.clear()
    return counting


def _post_chat(client: TestClient, message: str, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "message": message,
        "recent_turns": [],
        "mode": "HOSPITAL_SUPPORT",
        "public_support_chat": True,
    }
    payload.update(overrides)
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    return response.json()


def test_greeting_fast_path_answers_without_retrieval() -> None:
    greeting = public_greeting_response("xin chào", ChatMode.HOSPITAL_SUPPORT)
    assert greeting is not None
    assert greeting.routing_reason == "public_greeting_shortcut"
    assert greeting.safety_action is ChatSafetyAction.ANSWER
    assert greeting.provenance == "local_provider"
    assert greeting.citations == []
    assert "Xin chào" in greeting.answer

    identity = public_greeting_response("bạn là ai", ChatMode.HOSPITAL_SUPPORT)
    assert identity is not None
    assert "trợ lý thông tin sức khỏe" in identity.answer

    assert public_greeting_response("chuyên khoa tim mạch ở đâu", ChatMode.HOSPITAL_SUPPORT) is None
    # Unlisted suffixes keep the question out of the shortcut.
    assert public_greeting_response("xin chào bác sĩ tim mạch được không", ChatMode.HOSPITAL_SUPPORT) is None


def test_emergency_phrase_beats_greeting_fast_path_with_cache_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    counting = _setup_public_lane(monkeypatch)
    monkeypatch.setattr(main.settings, "ai_public_chat_cache_enabled", True)

    client = TestClient(main.app)
    body = _post_chat(client, "cấp cứu tôi đang đau ngực dữ dội")
    assert body["safety_action"] == "EMERGENCY"
    assert counting.search_calls == 0
    assert len(main._public_chat_cache) == 0


def test_education_short_circuit_precedes_cache_and_is_not_stored(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    counting = _setup_public_lane(monkeypatch)
    monkeypatch.setattr(main.settings, "ai_public_chat_cache_enabled", True)

    client = TestClient(main.app)
    body = _post_chat(client, "bài viết về 20-20-20 nói gì")
    assert body["routing_reason"] == "public_education_requires_two_step_contract"
    assert len(main._public_chat_cache) == 0
    # The short-circuit runs before embedding/retrieval.
    assert counting.search_calls == 0


def test_cache_hit_skips_search_until_index_revision_changes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    counting = _setup_public_lane(monkeypatch)
    monkeypatch.setattr(main.settings, "ai_public_chat_cache_enabled", True)

    client = TestClient(main.app)
    first = _post_chat(client, "gói khám tổng quát giá bao nhiêu")
    assert counting.search_calls == 1

    second = _post_chat(client, "gói khám tổng quát giá bao nhiêu")
    assert counting.search_calls == 1, "identical repeat must be served from the cache"
    assert second == first

    # Any index mutation invalidates the lane.
    main._bump_rag_index_revision()
    third = _post_chat(client, "gói khám tổng quát giá bao nhiêu")
    assert counting.search_calls == 2
    assert third == first


def test_multi_turn_and_refusals_never_enter_the_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    counting = _setup_public_lane(monkeypatch)
    monkeypatch.setattr(main.settings, "ai_public_chat_cache_enabled", True)

    client = TestClient(main.app)
    _post_chat(
        client,
        "gói khám tổng quát giá bao nhiêu",
        recent_turns=[{"role": "user", "content": "gói khám tổng quát giá bao nhiêu"}, {"role": "assistant", "content": "7 giờ"}],
    )
    assert len(main._public_chat_cache) == 0, "multi-turn questions never enter the cache lane"

    _post_chat(client, "cấp cứu đau ngực dữ dội")
    assert len(main._public_chat_cache) == 0, "safety refusals are never stored"

    # Flag off behaves exactly like before: nothing is cached. Multi-turn (1
    # search) + flag-off repeat (1 search); the emergency call never reaches
    # retrieval.
    monkeypatch.setattr(main.settings, "ai_public_chat_cache_enabled", False)
    _post_chat(client, "gói khám tổng quát giá bao nhiêu")
    assert counting.search_calls == 2
    assert len(main._public_chat_cache) == 0


def test_cache_key_folds_top_k_into_the_digest() -> None:
    """Same message, different top_k must never share a cached response."""

    base = public_chat_cache_key("gói khám tổng quát giá bao nhiêu", ChatMode.HOSPITAL_SUPPORT, 7, 3)
    assert base == public_chat_cache_key("gói khám tổng quát giá bao nhiêu", ChatMode.HOSPITAL_SUPPORT, 7, 3)
    assert public_chat_cache_key("gói khám tổng quát giá bao nhiêu", ChatMode.HOSPITAL_SUPPORT, 7, 1) != base
    assert public_chat_cache_key("gói khám tổng quát giá bao nhiêu", ChatMode.HOSPITAL_SUPPORT, 8, 3) != base
    assert (
        public_chat_cache_key("GÓI KHÁM TỔNG QUÁT GIÁ BAO NHIÊU", ChatMode.HOSPITAL_SUPPORT, 7, 3) == base
    ), "case/whitespace normalization of the message itself is preserved"


def test_different_top_k_misses_cache_and_reslices_citations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    counting = _setup_public_lane(monkeypatch)
    monkeypatch.setattr(main.settings, "ai_public_chat_cache_enabled", True)

    client = TestClient(main.app)
    broad = _post_chat(client, "gói khám tổng quát giá bao nhiêu", top_k=3)
    assert counting.search_calls == 1

    narrow = _post_chat(client, "gói khám tổng quát giá bao nhiêu", top_k=1)
    assert counting.search_calls == 2, "a different top_k must not reuse the cached answer shape"
    assert len(narrow["citations"]) <= 1


def test_is_cacheable_public_response_contract() -> None:
    def _response(**overrides: object) -> ChatResponse:
        values: dict[str, object] = {
            "answer": "Gói khám tổng quát có giá 1.000.000 đồng.",
            "citations": [{"source_type": "service", "source_id": "hours", "title": "Giờ mở cửa"}],
            "provenance": "local_provider",
            "safety_action": ChatSafetyAction.ANSWER,
        }
        values.update(overrides)
        return ChatResponse(**values)  # type: ignore[arg-type]

    assert is_cacheable_public_response(_response())
    assert not is_cacheable_public_response(_response(safety_action=ChatSafetyAction.INSUFFICIENT_EVIDENCE))
    assert not is_cacheable_public_response(_response(safety_action=ChatSafetyAction.EMERGENCY))
    assert not is_cacheable_public_response(_response(provenance="local_fallback"))
    assert not is_cacheable_public_response(_response(citations=[]))


def test_cache_is_bounded_and_ttls_out_entries() -> None:
    cache = PublicChatResponseCache(ttl_seconds=0.0, max_entries=2)
    for index in range(4):
        key = public_chat_cache_key(f"câu {index}", ChatMode.HOSPITAL_SUPPORT, 1, 3)
        cache.put(
            key,
            ChatResponse(answer="Gói khám tổng quát có giá 1.000.000 đồng."),
        )
    assert len(cache) <= 2, "LRU bound must evict oldest entries"

    fresh = PublicChatResponseCache(ttl_seconds=60.0, max_entries=8)
    key = public_chat_cache_key("gói khám tổng quát giá bao nhiêu", ChatMode.HOSPITAL_SUPPORT, 3, 3)
    fresh.put(key, ChatResponse(answer="Gói khám tổng quát có giá 1.000.000 đồng."))
    assert fresh.get(key) is not None
    assert fresh.get(public_chat_cache_key("gói khám tổng quát giá bao nhiêu", ChatMode.HOSPITAL_SUPPORT, 4, 3)) is None, (
        "a different index revision must miss"
    )
