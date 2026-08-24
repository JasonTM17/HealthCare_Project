"""Fail-closed, two-step patient chatbot contract.

Spring owns authentication, catalog authority, conversation persistence, and
CTA resolution.  This module owns only bounded retrieval/generation against a
local projection.  The two endpoints deliberately keep retrieval and provider
generation separate so Spring can validate source revisions at both
linearization points before persisting an answer.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Sequence

from app.embeddings import EmbeddingResult, LocalEmbeddingClient, embed
from app.llm import (
    chat_safety_response,
    contains_prompt_injection,
    context_contains_sensitive_data,
    patient_chat_remote_enabled,
    resolve_chat,
    rule_based_triage,
)
from app.providers import (
    LOCAL_CHAT_PROVIDERS,
    LOCAL_EMBEDDING_PROVIDERS,
    ProviderProvenance,
    ProviderUnavailable,
    remote_provider_requested,
)
from app.rag import (
    EmbeddingContractError,
    RagDocument,
    RagServiceContract,
    normalize_content,
    normalize_projection_kind,
)
from app.schemas import (
    AuthorizedSource,
    ChatCandidate,
    ChatGenerateRequest,
    ChatMode,
    ChatResponse,
    ChatRetrieveRequest,
    ChatRetrieveResponse,
    ChatSafetyAction,
    Citation,
    TriageSummary,
    TriageUrgency,
    UsedSource,
)


DEFAULT_RELEVANCE_THRESHOLD = 0.35
MAX_CONTEXT_CHARS = 2_000

MODE_SOURCE_TYPES: dict[ChatMode, frozenset[str]] = {
    ChatMode.HOSPITAL_SUPPORT: frozenset(
        {"branch", "specialty", "doctor", "service", "package"}
    ),
    ChatMode.SYMPTOM_TRIAGE: frozenset({"specialty"}),
    ChatMode.HEALTH_EDUCATION: frozenset({"article", "faq"}),
}

_REVISION_KEYS = (
    "content_revision",
    "_content_revision",
    "revision",
    "_revision",
    "_sync_revision",
)
_ELIGIBILITY_KEYS = ("eligibility_revision", "_eligibility_revision")
_HASH_KEYS = ("content_hash", "_content_hash")
_APPROVAL_KEYS = ("approval_id", "approval_round_id", "_approval_id")
_PROJECTION_KEYS = ("projection_kind", "_projection_kind")
_EXPIRY_KEYS = ("approval_expires_at", "expires_at", "_expires_at")
_APPROVAL_STATE_KEYS = ("approval_state", "review_state", "_approval_state")

# Keep this intentionally narrower than the general refusal detector.  An
# approved article may discuss diagnosis in an educational disclaimer; direct
# claims or medication instructions are never repeated as an AI assertion.
_UNSAFE_CLAIM_PATTERNS = (
    re.compile(r"\b(bạn|you)\s+(bị|mắc|have|has)\b", re.IGNORECASE),
    re.compile(r"\b(chẩn đoán là|diagnosed as|i diagnose)\b", re.IGNORECASE),
    re.compile(r"\b(kê đơn|prescribe|prescription|liều thuốc|dosage)\b", re.IGNORECASE),
    re.compile(r"\b(?:uống|take|dùng)\s+\d+(?:[.,]\d+)?\s*(?:mg|ml|viên)\b", re.IGNORECASE),
    re.compile(r"\b(ngừng thuốc|stop medication|change your medication)\b", re.IGNORECASE),
)


class ChatContractError(ValueError):
    """A safe, non-sensitive contract failure returned to Spring."""

    def __init__(self, code: str, *, status_code: int = 422) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class _SourceMetadata:
    document: RagDocument
    projection_kind: str
    content_revision: int | None
    eligibility_revision: int | None
    content_hash: str
    visible_content_hash: str
    approval_id: str | None
    expires_at: datetime | None


def mode_source_types(mode: ChatMode) -> frozenset[str]:
    """Return the closed source-type allowlist for one chat mode."""

    return MODE_SOURCE_TYPES[mode]


def _metadata_value(document: RagDocument, keys: Sequence[str]) -> str | None:
    for key in keys:
        value = document.metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _metadata_int(document: RagDocument, keys: Sequence[str]) -> int | None:
    raw = _metadata_value(document, keys)
    if raw is None:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value if value >= 0 else None


def _parse_expiry(document: RagDocument) -> datetime | None:
    raw = _metadata_value(document, _EXPIRY_KEYS)
    if raw is None:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        # An invalid expiry is not a valid clinical approval.  A sentinel in
        # the past makes the source fail closed without exposing metadata.
        return datetime.min.replace(tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _source_metadata(document: RagDocument) -> _SourceMetadata:
    projection = (_metadata_value(document, _PROJECTION_KEYS) or "OPERATIONAL").upper()
    if projection not in {"OPERATIONAL", "CLINICAL"}:
        projection = "OPERATIONAL"
    # `content_hash` is the Spring/PostgreSQL canonical revision hash.  The
    # visible text has a separate integrity hash because its rendering is not
    # byte-for-byte identical to the canonical JSON snapshot.
    content_hash = _metadata_value(document, _HASH_KEYS) or ""
    visible_content_hash = _actual_content_hash(document)
    return _SourceMetadata(
        document=document,
        projection_kind=projection,
        content_revision=(
            _metadata_int(document, _REVISION_KEYS)
            if projection == "CLINICAL" else None
        ),
        eligibility_revision=(
            _metadata_int(document, _ELIGIBILITY_KEYS)
            if projection == "CLINICAL" else None
        ),
        content_hash=content_hash,
        visible_content_hash=visible_content_hash,
        approval_id=_metadata_value(document, _APPROVAL_KEYS),
        expires_at=_parse_expiry(document),
    )


def _actual_content_hash(document: RagDocument) -> str:
    return hashlib.sha256(normalize_content(document.content).encode("utf-8")).hexdigest()


def _metadata_hash_is_consistent(meta: _SourceMetadata) -> bool:
    metadata_hash = _metadata_value(meta.document, _HASH_KEYS)
    actual = _actual_content_hash(meta.document)
    visible_metadata = _metadata_value(meta.document, ("visible_content_hash",))
    if visible_metadata is not None and visible_metadata != actual:
        return False
    # RagDocument.content_hash is always recomputed from visible content by
    # RagService.  Persistent adapters must satisfy the same invariant.
    stored = meta.document.content_hash.strip() if isinstance(meta.document.content_hash, str) else ""
    if stored and stored != actual:
        return False
    if meta.projection_kind == "CLINICAL":
        # Governed rows require an explicit canonical hash and an explicit
        # visible-text integrity hash; neither may be silently synthesized.
        return (
            metadata_hash is not None
            and bool(re.fullmatch(r"[0-9a-f]{64}", metadata_hash, flags=re.IGNORECASE))
            and visible_metadata is not None
            and visible_metadata == actual
        )
    return True


def _clinical_source_is_eligible(meta: _SourceMetadata) -> bool:
    """Require the metadata needed for a governed clinical projection."""

    if not meta.document.searchable:
        return False
    if meta.projection_kind != "CLINICAL":
        return False
    if meta.content_revision is None or meta.eligibility_revision is None:
        return False
    metadata_hash = _metadata_value(meta.document, _HASH_KEYS)
    # Clinical projections must carry the database-owned canonical hash as
    # explicit metadata.  A locally recomputed fallback is useful for legacy
    # operational documents, but it is not proof of an approved revision.
    if not meta.approval_id or not meta.content_hash or not metadata_hash:
        return False
    if not _metadata_hash_is_consistent(meta):
        return False
    # A governed source must carry an explicit database-owned expiry.  Missing
    # expiry is not equivalent to an evergreen approval.
    if meta.expires_at is None or meta.expires_at <= datetime.now(timezone.utc):
        return False
    state = _metadata_value(meta.document, _APPROVAL_STATE_KEYS)
    if state is None or state.upper() != "APPROVED":
        return False
    # If the ingestion metadata itself disagrees with the normalized content,
    # refuse it rather than letting a stale projection pass a hash check.
    return True


def _mode_allows(meta: _SourceMetadata, mode: ChatMode) -> bool:
    source_type = meta.document.source_type
    if source_type not in mode_source_types(mode):
        return False
    if mode is ChatMode.SYMPTOM_TRIAGE or mode is ChatMode.HEALTH_EDUCATION:
        return _clinical_source_is_eligible(meta)
    # Hospital support uses operational catalog projections only.  A clinical
    # specialty is deliberately not allowed to leak into an operational answer.
    return meta.projection_kind == "OPERATIONAL"


def _expired(meta: _SourceMetadata) -> bool:
    return meta.expires_at is not None and meta.expires_at <= datetime.now(timezone.utc)


def _candidate(meta: _SourceMetadata, score: float) -> ChatCandidate:
    return ChatCandidate(
        source_type=meta.document.source_type,
        source_id=meta.document.source_id,
        title=meta.document.title,
        score=round(max(0.0, min(1.0, score)), 4),
        projection_kind=meta.projection_kind,  # type: ignore[arg-type]
        content_revision=meta.content_revision,
        eligibility_revision=meta.eligibility_revision,
        # Operational projections intentionally omit clinical provenance
        # metadata from the Spring contract.  Clinical rows carry the
        # recomputed canonical hash below.
        content_hash=meta.content_hash if meta.projection_kind == "CLINICAL" else None,
        approval_id=meta.approval_id,
    )


def _used_source(meta: _SourceMetadata) -> UsedSource:
    return UsedSource(
        source_type=meta.document.source_type,
        source_id=meta.document.source_id,
        projection_kind=meta.projection_kind,  # type: ignore[arg-type]
        content_revision=meta.content_revision,
        eligibility_revision=meta.eligibility_revision,
        content_hash=meta.content_hash if meta.projection_kind == "CLINICAL" else None,
        approval_id=meta.approval_id,
    )


def _source_signature(source: AuthorizedSource | UsedSource) -> tuple[Any, ...]:
    return (
        source.source_type,
        source.source_id,
        source.projection_kind,
        source.content_revision,
        source.eligibility_revision,
        source.content_hash,
        source.approval_id,
    )


def validate_exhaustive_used_sources(
    expected: Sequence[AuthorizedSource | UsedSource],
    actual: Sequence[AuthorizedSource | UsedSource],
) -> None:
    """Fail closed on missing, extra, duplicate, or drifted used sources."""

    expected_keys = [(item.source_type, item.source_id) for item in expected]
    actual_keys = [(item.source_type, item.source_id) for item in actual]
    if len(set(actual_keys)) != len(actual_keys):
        raise ChatContractError("CHAT_USED_SOURCES_DUPLICATE")
    if len(expected_keys) != len(actual_keys) or set(expected_keys) != set(actual_keys):
        raise ChatContractError("CHAT_USED_SOURCES_MISMATCH")
    expected_by_key = {(item.source_type, item.source_id): item for item in expected}
    for item in actual:
        expected_item = expected_by_key[(item.source_type, item.source_id)]
        if _source_signature(expected_item) != _source_signature(item):
            raise ChatContractError("CHAT_USED_SOURCES_METADATA_MISMATCH")


def _embedding_parts(value: object) -> tuple[list[float], str, ProviderProvenance]:
    if isinstance(value, EmbeddingResult):
        return value.vector, value.model, value.provenance
    if isinstance(value, tuple) and len(value) == 2:
        vector = list(value[0])  # type: ignore[arg-type]
        model = str(value[1])
        provenance: ProviderProvenance = (
            "local_provider" if model in {"local", "local-hash"} else "remote_provider"
        )
        return vector, model, provenance
    raise TypeError("invalid embedding result")


def _threshold(settings: Any) -> float:
    value = getattr(settings, "ai_chat_relevance_threshold", DEFAULT_RELEVANCE_THRESHOLD)
    try:
        value = float(value)
    except (TypeError, ValueError):
        value = DEFAULT_RELEVANCE_THRESHOLD
    return max(0.0, min(1.0, value))


def _unsafe_claim(answer: str) -> bool:
    return any(pattern.search(answer) for pattern in _UNSAFE_CLAIM_PATTERNS)


def _insufficient_response(mode: ChatMode, *, reason: str = "") -> ChatResponse:
    suffix = f" {reason}" if reason else ""
    return ChatResponse(
        answer=(
            "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời để tránh suy đoán. "
            "Bạn có thể chọn một mode khác hoặc trao đổi trực tiếp với nhân viên y tế."
            f"{suffix}"
        ),
        mode=mode,
        safety_action=ChatSafetyAction.INSUFFICIENT_EVIDENCE,
        provenance="local_provider",
    )


def _local_grounded_response(
    message: str,
    mode: ChatMode,
    metas: Sequence[_SourceMetadata],
) -> ChatResponse:
    if not metas:
        return _insufficient_response(mode)
    if any(
        contains_prompt_injection(meta.document.content)
        or context_contains_sensitive_data([meta.document.content])
        for meta in metas
    ):
        return _insufficient_response(mode)

    citations = [
        Citation(
            source_type=meta.document.source_type,
            source_id=meta.document.source_id,
            title=meta.document.title,
        )
        for meta in metas
    ]
    used_sources = [_used_source(meta) for meta in metas]
    if mode is ChatMode.SYMPTOM_TRIAGE:
        triage = rule_based_triage(message)
        excerpts = " ".join(
            f"{meta.document.title}: {meta.document.content[:MAX_CONTEXT_CHARS]}" for meta in metas[:3]
        )
        answer = (
            f"{triage.clinical_advice} Theo nguồn tham khảo đã được duyệt: {excerpts} "
            "Hãy trao đổi với bác sĩ để được đánh giá trực tiếp."
        )
        urgency = TriageUrgency(triage.urgency_level)
        action = ChatSafetyAction.EMERGENCY if urgency is TriageUrgency.EMERGENCY else ChatSafetyAction.ANSWER
        summary = TriageSummary(
            urgency_level=urgency,
            recommended_specialty=triage.recommended_specialty,
        )
    else:
        excerpts = " ".join(
            f"{meta.document.title}: {meta.document.content[:MAX_CONTEXT_CHARS]}" for meta in metas[:3]
        )
        answer = (
            f"Dựa trên nguồn thông tin đã được kiểm duyệt, {excerpts} "
            "Nếu cần quyết định phù hợp với tình trạng riêng, hãy trao đổi trực tiếp với nhân viên y tế."
        )
        action = ChatSafetyAction.ANSWER
        summary = None

    if _unsafe_claim(answer):
        return _insufficient_response(mode)
    return ChatResponse(
        answer=answer[:4_000],
        citations=citations,
        provenance="local_provider",
        mode=mode,
        safety_action=action,
        used_sources=used_sources,
        triage=summary,
    )


def _validate_projection_source(
    source: AuthorizedSource,
    mode: ChatMode,
    rag_service: RagServiceContract,
) -> _SourceMetadata:
    # The in-memory index keeps operational and clinical projections separate
    # when the same specialty identity appears in both.  Legacy fixtures that
    # predate the discriminator still resolve through RagIndex's compatibility
    # fallback, but a clinical source can never select an operational row.
    document = rag_service.index.get(
        f"{source.source_type}:{source.source_id}",
        projection=normalize_projection_kind(value=source.projection_kind),
    )
    if document is None:
        raise ChatContractError("CHAT_SOURCE_NOT_FOUND")
    meta = _source_metadata(document)
    if not meta.document.searchable:
        raise ChatContractError("CHAT_SOURCE_STALE", status_code=409)
    if not _metadata_hash_is_consistent(meta):
        raise ChatContractError("CHAT_SOURCE_HASH_MISMATCH", status_code=409)
    if meta.document.source_type not in mode_source_types(mode):
        raise ChatContractError("CHAT_SOURCE_MODE_MISMATCH")
    if mode is ChatMode.HOSPITAL_SUPPORT:
        if meta.projection_kind != "OPERATIONAL":
            raise ChatContractError("CHAT_SOURCE_MODE_MISMATCH")
    else:
        if meta.projection_kind != "CLINICAL":
            raise ChatContractError("CHAT_SOURCE_MODE_MISMATCH")
        if not _clinical_source_is_eligible(meta):
            raise ChatContractError("CHAT_SOURCE_STALE", status_code=409)
    if _expired(meta):
        raise ChatContractError("CHAT_SOURCE_STALE", status_code=409)
    if source.projection_kind != meta.projection_kind:
        raise ChatContractError("CHAT_SOURCE_METADATA_MISMATCH")
    if source.content_revision is not None and source.content_revision != meta.content_revision:
        raise ChatContractError("CHAT_SOURCE_STALE", status_code=409)
    if source.eligibility_revision is not None and source.eligibility_revision != meta.eligibility_revision:
        raise ChatContractError("CHAT_SOURCE_STALE", status_code=409)
    # Missing canonical metadata is handled by the clinical eligibility gate
    # below (CHAT_SOURCE_STALE).  Do not misclassify a legacy fixture as a
    # hash mismatch before that fail-closed decision is reached.
    if (
        source.content_hash is not None
        and meta.content_hash
        and source.content_hash != meta.content_hash
    ):
        raise ChatContractError("CHAT_SOURCE_HASH_MISMATCH", status_code=409)
    if source.approval_id is not None and source.approval_id != meta.approval_id:
        raise ChatContractError("CHAT_SOURCE_STALE", status_code=409)
    if mode is not ChatMode.HOSPITAL_SUPPORT:
        # Clinical callers must carry every authority field, not merely an ID.
        if (
            source.content_revision is None
            or source.eligibility_revision is None
            or source.content_hash is None
            or source.approval_id is None
        ):
            raise ChatContractError("CHAT_SOURCE_METADATA_REQUIRED")
    return meta


def retrieve_chat_candidates(
    request: ChatRetrieveRequest,
    settings: Any,
    rag_service: RagServiceContract,
    *,
    embedder: Callable[[str, Any], object] = embed,
) -> ChatRetrieveResponse:
    """Retrieve only eligible, mode-allowed candidates above the threshold."""

    safety = chat_safety_response(
        request.message,
        [(turn.role, turn.content) for turn in request.recent_turns],
    )
    if safety is not None:
        return ChatRetrieveResponse(
            mode=request.mode,
            candidates=[],
            relevance_threshold=_threshold(settings),
            safety_action=safety.safety_action,
            provenance="local_fallback",
        )

    if (
        getattr(settings, "remote_ai_synthetic_only", False)
        and request.synthetic_beta is not True
        and str(getattr(settings, "ai_service_runtime", "")).casefold() in {"synthetic-beta", "synthetic_beta"}
        and remote_provider_requested(settings, "embedding_provider", LOCAL_EMBEDDING_PROVIDERS)
    ):
        return ChatRetrieveResponse(
            mode=request.mode,
            candidates=[],
            relevance_threshold=_threshold(settings),
            safety_action=ChatSafetyAction.INSUFFICIENT_EVIDENCE,
            provenance="local_provider",
        )

    provenance: ProviderProvenance = "local_provider"
    try:
        embedding_provider = str(getattr(settings, "embedding_provider", "local")).strip().casefold()
        if (
            embedding_provider not in LOCAL_EMBEDDING_PROVIDERS
            and not patient_chat_remote_enabled(settings)
        ):
            # Patient-chat remote opt-in gates embeddings as well as text
            # generation. Never send the patient message to a configured
            # remote embedding provider when the chat gate is off.
            vector, model, provenance = _embedding_parts(
                LocalEmbeddingClient().embed(request.message)
            )
        else:
            vector, model, provenance = _embedding_parts(embedder(request.message, settings))
        search_provenance: ProviderProvenance = (
            "local_provider" if provenance == "local_fallback" else provenance
        )
        hits = rag_service.search(
            vector,
            top_k=min(request.top_k, getattr(settings, "ai_max_retrieved_chunks", 20)),
            query_text=request.message,
            source_types=mode_source_types(request.mode),
            embedding_model=model,
            embedding_provenance=search_provenance,
        )
    except (EmbeddingContractError, ProviderUnavailable):
        return ChatRetrieveResponse(
            mode=request.mode,
            candidates=[],
            relevance_threshold=_threshold(settings),
            safety_action=ChatSafetyAction.INSUFFICIENT_EVIDENCE,
            provenance="local_fallback" if provenance == "local_fallback" else "local_provider",
        )

    threshold = _threshold(settings)
    candidates: list[ChatCandidate] = []
    for document, score in hits:
        if score < threshold:
            continue
        meta = _source_metadata(document)
        if not _mode_allows(meta, request.mode) or _expired(meta):
            continue
        if contains_prompt_injection(document.content) or context_contains_sensitive_data([document.content]):
            # Quarantine untrusted content instead of returning it as an
            # authorized candidate.
            continue
        candidates.append(_candidate(meta, score))
        if len(candidates) >= min(request.top_k, 20):
            break
    return ChatRetrieveResponse(
        mode=request.mode,
        candidates=candidates,
        relevance_threshold=threshold,
        provenance=provenance,
    )


def generate_chat_response(
    request: ChatGenerateRequest,
    settings: Any,
    rag_service: RagServiceContract,
    *,
    client: Any | None = None,
) -> ChatResponse:
    """Validate Spring's exact allowlist, then answer from that projection."""

    turns = [(turn.role, turn.content) for turn in request.recent_turns]
    safety = chat_safety_response(request.message, turns)
    if safety is not None:
        return safety.model_copy(update={"mode": request.mode, "used_sources": []})

    if (
        getattr(settings, "ai_patient_chat_remote_enabled", False) is True
        and str(getattr(settings, "ai_service_runtime", "")).casefold() in {"prod", "production"}
    ):
        raise ChatContractError("CHAT_REMOTE_DISABLED_IN_PRODUCTION", status_code=503)

    sources = request.authorized_sources
    keys = [(source.source_type, source.source_id) for source in sources]
    if len(set(keys)) != len(keys):
        raise ChatContractError("CHAT_AUTHORIZED_SOURCES_DUPLICATE")
    metas = [_validate_projection_source(source, request.mode, rag_service) for source in sources]
    expected_used = [_used_source(meta) for meta in metas]
    if not metas:
        return _insufficient_response(request.mode)

    if any(
        contains_prompt_injection(meta.document.content)
        or context_contains_sensitive_data([meta.document.content])
        for meta in metas
    ):
        return _insufficient_response(request.mode)

    remote_requested = remote_provider_requested(settings, "ai_provider", LOCAL_CHAT_PROVIDERS)
    if (
        remote_requested
        and getattr(settings, "remote_ai_synthetic_only", False)
        and str(getattr(settings, "ai_service_runtime", "")).casefold() in {"synthetic-beta", "synthetic_beta"}
        and request.synthetic_beta is not True
    ):
        raise ChatContractError("CHAT_REMOTE_SYNTHETIC_REQUIRED", status_code=403)
    if not remote_requested or not patient_chat_remote_enabled(settings):
        response = _local_grounded_response(request.message, request.mode, metas)
    else:
        context = [
            f"{meta.document.title}: {meta.document.content[:MAX_CONTEXT_CHARS]}" for meta in metas
        ]
        citations = [
            Citation(
                source_type=meta.document.source_type,
                source_id=meta.document.source_id,
                title=meta.document.title,
            )
            for meta in metas
        ]
        response = resolve_chat(
            request.message,
            settings,
            recent_turns=turns,
            context=context,
            citations=citations,
            used_sources=expected_used,
            client=client,
        )
        if response.provenance == "remote_provider" and _unsafe_claim(response.answer):
            return _insufficient_response(request.mode)

    # The provider context is exactly `metas`; therefore the output must be
    # exhaustive.  Keep this explicit validation in the path so a future
    # provider adapter cannot accidentally drop, add, or mutate a source.
    actual_used = response.used_sources
    if not actual_used:
        raise ChatContractError("CHAT_USED_SOURCES_MISSING")
    validate_exhaustive_used_sources(expected_used, actual_used)
    return response.model_copy(
        update={
            "mode": request.mode,
            "used_sources": list(actual_used),
            "citations": [
                Citation(
                    source_type=meta.document.source_type,
                    source_id=meta.document.source_id,
                    title=meta.document.title,
                )
                for meta in metas
            ],
            "safety_action": (
                response.safety_action
                if response.safety_action is not ChatSafetyAction.ANSWER
                else ChatSafetyAction.ANSWER
            ),
        }
    )
