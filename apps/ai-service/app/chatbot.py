"""Fail-closed, two-step patient chatbot contract.

Spring owns authentication, catalog authority, conversation persistence, and
CTA resolution.  This module owns only bounded retrieval/generation against a
local projection.  The two endpoints deliberately keep retrieval and provider
generation separate so Spring can validate source revisions at both
linearization points before persisting an answer.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Sequence

from app.embeddings import EmbeddingResult, LocalEmbeddingClient, embed
from app.llm import (
    chat_safety_response,
    context_contains_unsafe_data,
    normalize_sensitive_text,
    patient_chat_remote_enabled,
    public_chat_mode_for_query,
    public_education_topic_tokens,
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
MAX_PATIENT_EXCERPT_CHARS = 720
_SPECIALTY_GUIDANCE_TERMS = (
    "chuyen khoa nao",
    "kham khoa nao",
    "nen kham khoa nao",
    "tim chuyen khoa",
    "phu hop voi trieu chung",
)

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
    re.compile(
        r"\b(?:bạn|ban|you)\s+(?:(?:có|co)\s+(?:thể|the|khả\s+năng|kha\s+nang)|"
        r"có\s+lẽ|co\s+le|may|might|could|likely)?\s*(?:bị|bi|mắc|mac|have|has)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(chẩn đoán là|diagnosed as|i diagnose)\b", re.IGNORECASE),
    re.compile(r"\b(kê đơn|prescribe|prescription|liều thuốc|dosage)\b", re.IGNORECASE),
    re.compile(r"\b(?:uống|take|dùng)\s+\d+(?:[.,]\d+)?\s*(?:mg|ml|viên)\b", re.IGNORECASE),
    re.compile(
        r"\b(?:(?:hãy|hay|bạn\s+nên|ban\s+nen)\s+(?:uống|uong|dùng|dung|sử\s+dụng|su\s+dung)|"
        r"you\s+should\s+(?:take|use))\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:uống|uong|dùng|dung|sử\s+dụng|su\s+dung|take|use)\s+(?:thuốc\s+|thuoc\s+)?"
        r"(?:aspirin|paracetamol|acetaminophen|ibuprofen|amoxicillin|antibiotic|"
        r"kháng\s+sinh|khang\s+sinh)\b",
        re.IGNORECASE,
    ),
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


def _public_operational_context(meta: _SourceMetadata) -> bool:
    """Allow only Spring-marked public branch contact/address fields."""

    marker = _metadata_value(meta.document, ("public_operational",))
    return (
        meta.projection_kind == "OPERATIONAL"
        and meta.document.source_type == "branch"
        and marker is not None
        and marker.casefold() == "true"
    )


def _context_is_safe(meta: _SourceMetadata) -> bool:
    return not context_contains_unsafe_data(
        [meta.document.title, meta.document.content],
        allow_public_operational=_public_operational_context(meta),
    )


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


# --- Lexical rescue pass for the local (hash-embedding) retriever ----------
# Local hash embeddings score most Vietnamese queries around 0.2, permanently
# under a 0.35 relevance threshold, so the grounded-answer path could never
# open without a remote embedding provider. When vector search yields nothing
# above the threshold, a diacritic-folded token-overlap score gives the
# already-ingested catalog documents a second chance. Symptom phrases are
# expanded to the vocabulary of the specialty pages so "mất ngủ" still finds
# the Thần kinh document ("rối loạn giấc ngủ").
_VI_LEXICAL_STOPWORDS = frozenset({
    "va", "hoac", "cua", "cho", "co", "khong", "nen", "can", "la", "cach",
    "nhung", "theo", "khi", "voi", "bi", "duoc", "gi", "nao", "o", "tai",
    "mot", "hai", "vao", "ra", "di", "den", "tu", "tren", "trong", "nhieu",
    "it", "minh", "toi", "ban", "nhu", "nhung", "qua", "da", "se",
})

_VI_SYMPTOM_EXPANSIONS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("mat ngu", ("giac", "ngu", "than", "kinh")),
    ("roi loan giac ngu", ("than", "kinh")),
    ("dau dau", ("than", "kinh")),
    ("chong mat", ("tai", "mui", "hong", "than")),
    # Keep the generic abdominal-pain route digestive.  Gynaecology is the
    # more specific route for lower-abdominal pain; matching both phrases for
    # "dau bung duoi" made the public answer depend on vector tie order.
    ("dau bung duoi", ("san", "phu")),
    ("dau bung", ("tieu", "hoa")),
    ("kho tieu", ("tieu", "hoa")),
    ("day hoi", ("tieu", "hoa")),
    ("tieu chay", ("tieu", "hoa")),
    ("viem gan", ("tieu", "hoa")),
    ("tieu duong", ("noi", "tong", "hop")),
    ("mo mau", ("noi", "tong", "hop")),
    ("duong huyet", ("noi", "tong", "hop")),
    ("met moi keo dai", ("noi", "tong", "hop")),
    ("dau khop", ("co", "xuong", "khop")),
    ("cung khop", ("co", "xuong", "khop")),
    ("dau lung", ("co", "xuong", "khop")),
    ("nghet mui", ("tai", "mui", "hong")),
    ("dau hong", ("tai", "mui", "hong")),
    ("viem hong", ("tai", "mui", "hong")),
    ("viem xoang", ("tai", "mui", "hong")),
    ("u tai", ("tai", "mui", "hong")),
    ("dau uc nguc", ("tim", "mach")),
    ("hoi hop", ("tim", "mach")),
    ("danh trong nguc", ("tim", "mach")),
    ("kho tho", ("tim", "mach", "ho", "hap")),
    ("ho keo dai", ("ho", "hap", "nhi")),
    ("so ho keo dai", ("ho", "hap", "nhi")),
    ("bieng an", ("nhi",)),
    ("tre em", ("nhi",)),
    ("so sinh", ("nhi",)),
    ("kinh nguyet", ("san", "phu")),
    ("ra huyet", ("san", "phu")),
    # Tim mach & Tuan hoan
    ("dau that nguc", ("tim", "mach")),
    ("thieu mau co tim", ("tim", "mach")),
    ("tang huyet ap", ("tim", "mach")),
    ("huyet ap cao", ("tim", "mach")),
    ("ha huyet ap", ("tim", "mach")),
    ("loan nhip", ("tim", "mach")),
    ("tim dap nhanh", ("tim", "mach")),
    ("suy tim", ("tim", "mach")),
    ("tuc nguc", ("tim", "mach")),
    # Tieu hoa & Gan mat
    ("trao nguoc", ("tieu", "hoa")),
    ("o chua", ("tieu", "hoa")),
    ("o nong", ("tieu", "hoa")),
    ("viem loet da day", ("tieu", "hoa")),
    ("dau da day", ("tieu", "hoa")),
    ("dau thuong vi", ("tieu", "hoa")),
    ("xuat huyet tieu hoa", ("tieu", "hoa")),
    ("di ngoai ra mau", ("tieu", "hoa")),
    ("tao bon", ("tieu", "hoa")),
    ("viem dai trang", ("tieu", "hoa")),
    ("men gan cao", ("tieu", "hoa")),
    # Ho hap
    ("hen phe quan", ("ho", "hap")),
    ("viem phoi", ("ho", "hap")),
    ("viem phe quan", ("ho", "hap")),
    ("copd", ("ho", "hap")),
    ("ho ra mau", ("ho", "hap")),
    ("tho kho khe", ("ho", "hap")),
    # Nhi khoa
    ("sot o tre", ("nhi",)),
    ("sot cao co giat", ("nhi", "cap", "cuu")),
    ("non tro", ("nhi",)),
    ("quay khoc", ("nhi",)),
    ("phat ban o tre", ("nhi", "da", "lieu")),
    ("suy dinh duong", ("nhi",)),
    # Than kinh
    ("dau nua dau", ("than", "kinh")),
    ("te bi tay chan", ("than", "kinh")),
    ("run tay", ("than", "kinh")),
    ("dong kinh", ("than", "kinh")),
    ("tai bien", ("than", "kinh", "tim", "mach")),
    ("dot quy", ("than", "kinh", "cap", "cuu")),
    ("suy giam tri nho", ("than", "kinh")),
    ("tien dinh", ("than", "kinh", "tai", "mui", "hong")),
    # Co xuong khop
    ("thoai hoa khop", ("co", "xuong", "khop")),
    ("thoat vi dia dem", ("co", "xuong", "khop")),
    ("viem khop dang thap", ("co", "xuong", "khop")),
    ("gout", ("co", "xuong", "khop")),
    ("gut", ("co", "xuong", "khop")),
    ("dau vai gay", ("co", "xuong", "khop")),
    ("dau dau goi", ("co", "xuong", "khop")),
    ("gay xuong", ("co", "xuong", "khop")),
    ("tran dich khop", ("co", "xuong", "khop")),
    # Tai Mui Hong
    ("viem amidan", ("tai", "mui", "hong")),
    ("chay mau cam", ("tai", "mui", "hong")),
    ("giam thinh luc", ("tai", "mui", "hong")),
    ("viem tai giua", ("tai", "mui", "hong")),
    ("khan tieng", ("tai", "mui", "hong")),
    # Da lieu
    ("di ung da", ("da", "lieu")),
    ("man ngua", ("da", "lieu")),
    ("vay nen", ("da", "lieu")),
    ("eczema", ("da", "lieu")),
    ("mun trung ca", ("da", "lieu")),
    ("nam da", ("da", "lieu")),
    ("zona", ("da", "lieu")),
    ("me day", ("da", "lieu")),
    ("viem da co dia", ("da", "lieu")),
    # Noi tiet & Tong hop
    ("dai thao duong", ("noi", "tong", "hop")),
    ("ha duong huyet", ("noi", "tong", "hop")),
    ("tuyen giap", ("noi", "tong", "hop")),
    ("bua co", ("noi", "tong", "hop")),
    ("sut can nhanh", ("noi", "tong", "hop")),
    # San phu khoa
    ("mang thai", ("san", "phu")),
    ("thai ky", ("san", "phu")),
    ("kham thai", ("san", "phu")),
    ("dong thai", ("san", "phu")),
    ("u xo tu cung", ("san", "phu")),
    ("viem am dao", ("san", "phu")),
    ("khi hu bat thuong", ("san", "phu")),
    # Mat
    ("dau mat", ("mat",)),
    ("dau mat do", ("mat",)),
    ("mo mat", ("mat",)),
    ("can thi", ("mat",)),
    ("duc thuy tinh the", ("mat",)),
    # Rang Ham Mat
    ("dau rang", ("rang", "ham", "mat")),
    ("sau rang", ("rang", "ham", "mat")),
    ("viem loi", ("rang", "ham", "mat")),
    ("viem nuou", ("rang", "ham", "mat")),
    # Than - Tiet nieu
    ("soi than", ("tiet", "nieu")),
    ("tieu buot", ("tiet", "nieu")),
    ("tieu rat", ("tiet", "nieu")),
    ("tieu ra mau", ("tiet", "nieu")),
    ("suy than", ("tiet", "nieu", "noi")),
)


def _lexical_tokens(normalized: str, *, expand: bool = False) -> frozenset[str]:
    tokens = frozenset(re.findall(r"[a-z0-9]{2,}", normalized)) - _VI_LEXICAL_STOPWORDS
    if not expand:
        return tokens
    expanded = set(tokens)
    matched_phrases = [
        phrase for phrase, _ in _VI_SYMPTOM_EXPANSIONS if phrase in normalized
    ]
    for phrase, extra in _VI_SYMPTOM_EXPANSIONS:
        if phrase in matched_phrases and not any(
            phrase != longer_phrase
            and phrase in longer_phrase
            and longer_phrase in matched_phrases
            for longer_phrase in matched_phrases
        ):
            expanded.update(extra)
    return frozenset(expanded)


def _lexical_overlap(query_tokens: frozenset[str], document_text: str) -> float:
    if not query_tokens:
        return 0.0
    document_tokens = _lexical_tokens(normalize_sensitive_text(document_text))
    shared = len(query_tokens & document_tokens)
    # A single shared token proves nothing (Kongming review: one-token
    # queries trivially reach 1.0 and open the grounded path on tangential
    # documents); require at least two distinct shared tokens.
    if shared < 2:
        return 0.0
    return shared / len(query_tokens)


def _specialty_guidance_hint_tokens(message: str) -> frozenset[str]:
    """Return symptom-to-specialty expansion terms for a guidance question.

    The regular query tokens contain generic words such as ``khoa`` and
    ``kham`` that occur in almost every specialty projection.  The expansion
    vocabulary is the discriminating part of the existing lexical rescue
    contract (for example, ``dau dau`` -> ``than``/``kinh``), so reuse it for
    answer shaping instead of maintaining a second symptom map in the public
    endpoint.
    """

    normalized = normalize_sensitive_text(message)
    if not any(term in normalized for term in _SPECIALTY_GUIDANCE_TERMS):
        return frozenset()
    if "bac si" in normalized or "dat lich" in normalized:
        return frozenset()
    base_tokens = _lexical_tokens(normalized)
    expanded_tokens = _lexical_tokens(normalized, expand=True)
    return expanded_tokens - base_tokens


def focus_public_retrieval_hits(
    message: str,
    hits: Sequence[tuple[RagDocument, float]],
) -> list[tuple[RagDocument, float]]:
    """Focus public retrieval on the best topic-aligned rows.

    Public ``/chat`` performs retrieval directly so it can preserve the
    server-owned source allowlist.  Before this focus pass, a local hash
    embedder could return several unrelated specialty rows and the generator
    would concatenate all of them into one answer.  Keep the best specialty
    or education match (ties are retained for genuinely multi-topic queries)
    while preserving the original retrieval order and score.
    """

    if not hits:
        return []
    if public_chat_mode_for_query(message) is ChatMode.HEALTH_EDUCATION:
        topic_tokens = public_education_topic_tokens(message)
        if len(topic_tokens) < 2:
            return []
        topic_set = set(topic_tokens)
        topic_phrase = " ".join(topic_tokens)
        ranked_education: list[tuple[RagDocument, float, int]] = []
        for document, score in hits:
            if getattr(document, "source_type", "") not in {"article", "faq"}:
                continue
            title = normalize_sensitive_text(getattr(document, "title", ""))
            content = normalize_sensitive_text(getattr(document, "content", ""))
            full_text = f"{title}: {content}"
            full_tokens = set(re.findall(r"\b[a-z0-9]{2,}\b", full_text))
            if topic_phrase not in full_text and not topic_set.issubset(full_tokens):
                continue
            education_title_tokens = set(re.findall(r"\b[a-z0-9]{2,}\b", title))
            match_score = len(topic_set.intersection(education_title_tokens)) * 10
            if topic_phrase in title:
                match_score += 100
            elif topic_phrase in content:
                match_score += 30
            match_score += len(topic_set.intersection(full_tokens))
            ranked_education.append((document, score, match_score))
        if not ranked_education:
            return []
        best_score = max(match_score for _, _, match_score in ranked_education)
        focused_ids = {
            (getattr(document, "source_type", ""), getattr(document, "source_id", ""))
            for document, _, match_score in ranked_education
            if match_score == best_score
        }
        return [
            (document, score)
            for document, score in hits
            if (
                getattr(document, "source_type", ""),
                getattr(document, "source_id", ""),
            ) in focused_ids
        ]

    hint_tokens = _specialty_guidance_hint_tokens(message)
    if not hint_tokens or not hits:
        return list(hits)

    specialty_hits = [
        (document, score)
        for document, score in hits
        if getattr(document, "source_type", "") == "specialty"
    ]
    if not specialty_hits:
        return list(hits)

    ranked: list[tuple[RagDocument, float, int]] = []
    for document, score in specialty_hits:
        title_tokens = _lexical_tokens(
            normalize_sensitive_text(getattr(document, "title", ""))
        )
        content_tokens = _lexical_tokens(
            normalize_sensitive_text(getattr(document, "content", ""))
        )
        match_score = (
            len(hint_tokens.intersection(title_tokens)) * 3
            + len(hint_tokens.intersection(content_tokens))
        )
        if match_score > 0:
            ranked.append((document, score, match_score))

    if not ranked:
        return specialty_hits

    best_score = max(match_score for _, _, match_score in ranked)
    focused_ids = {
        (getattr(document, "source_type", ""), getattr(document, "source_id", ""))
        for document, _, match_score in ranked
        if match_score == best_score
    }
    return [
        (document, score)
        for document, score in specialty_hits
        if (
            getattr(document, "source_type", ""),
            getattr(document, "source_id", ""),
        ) in focused_ids
    ]


def _focus_candidates_for_question(
    message: str,
    mode: ChatMode,
    candidates: list[ChatCandidate],
) -> list[ChatCandidate]:
    """Keep clinical candidates focused on the user's explicit topic."""

    if not candidates:
        return candidates
    if mode is ChatMode.HEALTH_EDUCATION:
        topic_tokens = public_education_topic_tokens(message)
        if len(topic_tokens) < 2:
            return []
        topic_set = set(topic_tokens)
        topic_phrase = " ".join(topic_tokens)
        ranked_education: list[tuple[ChatCandidate, int]] = []
        for candidate in candidates:
            if candidate.source_type not in {"article", "faq"}:
                continue
            title = normalize_sensitive_text(candidate.title)
            education_title_tokens = set(re.findall(r"\b[a-z0-9]{2,}\b", title))
            if topic_phrase not in title and not topic_set.issubset(education_title_tokens):
                continue
            match_score = len(topic_set.intersection(education_title_tokens))
            if topic_phrase in title:
                match_score += 100
            ranked_education.append((candidate, match_score))
        if not ranked_education:
            return []
        best_score = max(match_score for _, match_score in ranked_education)
        focused_ids = {
            (candidate.source_type, candidate.source_id)
            for candidate, match_score in ranked_education
            if match_score == best_score
        }
        return [
            candidate
            for candidate in candidates
            if (candidate.source_type, candidate.source_id) in focused_ids
        ]

    if mode is not ChatMode.HOSPITAL_SUPPORT:
        return candidates
    normalized = normalize_sensitive_text(message)
    if not any(term in normalized for term in _SPECIALTY_GUIDANCE_TERMS):
        return candidates
    # An explicit doctor/booking request still needs operational candidates.
    if "bac si" in normalized or "dat lich" in normalized:
        return candidates
    specialties = [candidate for candidate in candidates if candidate.source_type == "specialty"]
    if not specialties:
        return candidates

    hint_tokens = _specialty_guidance_hint_tokens(message)
    if not hint_tokens:
        return specialties

    ranked: list[tuple[ChatCandidate, int]] = []
    for candidate in specialties:
        title_tokens = _lexical_tokens(normalize_sensitive_text(candidate.title))
        match_score = len(hint_tokens.intersection(title_tokens))
        if match_score > 0:
            ranked.append((candidate, match_score))
    if not ranked:
        return specialties
    best_score = max(match_score for _, match_score in ranked)
    return [candidate for candidate, match_score in ranked if match_score == best_score]


_COMPLEX_SYMPTOM_INDICATORS: tuple[str, ...] = (
    "kem theo", "di kem", "kem", "ket hop", "cung voi", "dong thoi", "song song",
    "vua bi", "vua dau", "vua sot", "vua kho tho", "vua",
    "lan toa", "lan ra", "lan xuong", "lan len",
    "nghi ngo", "tien su", "bien chung", "man tinh",
    "nhieu ngay", "keo dai", "uong thuoc khong do", "khong giam", "tai phat",
    "dau quan", "du doi", "kho tho du doi", "hon me", "yeu liet",
)

_ORGAN_SYSTEM_CLUSTERS: list[set[str]] = [
    # Tim mach
    {"dau nguc", "tuc nguc", "thieu mau co tim", "hoi hop", "dap nhanh", "tim dap nhanh", "suy tim", "mach vanh", "tang huyet ap"},
    # Ho hap
    {"kho tho", "ho ra mau", "tho khe", "hen phe quan", "viem phoi", "copd", "sot cao", "ho nhieu dom"},
    # Tieu hoa
    {"dau bung", "thuong vi", "xuat huyet", "di ngoai ra mau", "non mua", "non oi", "non tro", "buon non", "tieu chay", "vang da", "men gan"},
    # Than kinh
    {"te bi", "dong kinh", "yeu nua nguoi", "liet", "mat y thuc", "hon me", "dau dau du doi", "dau dau", "chong mat", "choang vang", "mo mat", "hoa mat", "dot quy"},
    # Co xuong khop
    {"sung khop", "tran dich", "thoat vi", "gout", "bien dang khop"},
    # Tiet nieu
    {"tieu buot", "tieu ra mau", "vo nieu", "soi than", "phu toan than"},
    # Noi tiet / Chuyen hoa
    {"tieu duong", "sut can nhanh", "ha duong huyet", "tuyen giap"},
    # Da lieu / Di ung
    {"phat ban", "noi man", "me day", "ngua toan than", "lo loet"},
    # Toan than / Canh bao
    {"va mo hoi", "sot cao", "ret run", "suy nhuoc"},
]


def is_complex_multisymptom_query(message: str) -> bool:
    """Detect queries that involve complex multi-symptom clinical presentations."""
    normalized = normalize_sensitive_text(message)
    indicators_hit = sum(1 for term in _COMPLEX_SYMPTOM_INDICATORS if term in normalized)
    clusters_hit = sum(1 for cluster in _ORGAN_SYSTEM_CLUSTERS if any(term in normalized for term in cluster))
    return clusters_hit >= 2 or indicators_hit >= 2 or (clusters_hit >= 1 and indicators_hit >= 1)


def _unsafe_claim(answer: str) -> bool:
    return any(pattern.search(answer) for pattern in _UNSAFE_CLAIM_PATTERNS)


def _insufficient_response(mode: ChatMode, *, reason: str = "") -> ChatResponse:
    suffix = f" {reason}" if reason else ""
    return ChatResponse(
        answer=(
            "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời để tránh suy đoán. "
            "Bạn có thể chọn một chế độ khác hoặc trao đổi trực tiếp với nhân viên y tế."
            f"{suffix}"
        ),
        mode=mode,
        safety_action=ChatSafetyAction.INSUFFICIENT_EVIDENCE,
        provenance="local_provider",
        cost_tier="local_free",
        routing_reason="insufficient_evidence",
    )


def _extract_serialized_sections(content: str) -> tuple[str, str]:
    """Split a legacy article projection from a trailing JSON sections array.

    Older SQL projections append ``sections::text`` to the searchable content.
    That is useful for retrieval but must never appear as implementation-shaped
    JSON in a patient-facing answer.  Only a valid, trailing list of section
    objects is transformed; unrelated bracketed text remains untouched.
    """

    decoder = json.JSONDecoder()
    for index, character in enumerate(content):
        if character != "[":
            continue
        try:
            payload, consumed = decoder.raw_decode(content[index:])
        except json.JSONDecodeError:
            continue
        trailing = content[index + consumed :].strip(" \t\r\n.,;:")
        if trailing or not isinstance(payload, list) or not payload:
            continue

        rendered: list[str] = []
        valid = True
        for section in payload:
            if not isinstance(section, dict):
                valid = False
                break
            heading = section.get("heading") or section.get("title")
            body = section.get("body") or section.get("content")
            heading_text = heading.strip() if isinstance(heading, str) else ""
            body_text = body.strip() if isinstance(body, str) else ""
            if not heading_text and not body_text:
                valid = False
                break
            rendered.append(
                f"{heading_text}: {body_text}".strip(": ")
                if heading_text and body_text
                else heading_text or body_text
            )
        if valid:
            return content[:index].rstrip(" \t\r\n:;,-"), "\n".join(rendered)
    return content, ""


def _clean_patient_source_content(content: str) -> str:
    """Render indexed source text without leaking storage serialization."""

    prefix, sections = _extract_serialized_sections(str(content))
    parts = [part for part in (prefix, sections) if part.strip()]
    return normalize_content("\n".join(parts))


def _grounded_excerpt(meta: _SourceMetadata) -> str:
    """Render concise, source-owned text for the patient-facing answer."""

    title = str(getattr(meta.document, "title", "")).strip()
    if meta.document.source_type == "doctor":
        # Doctor bios may contain synthetic schedules and fixture disclaimers;
        # the source-authorized, branch-aware title is the useful answer fact.
        return f"{title}." if title and not title.endswith(".") else title

    content = _clean_patient_source_content(str(getattr(meta.document, "content", ""))).strip()
    if content.casefold().startswith(title.casefold()):
        content = content[len(title):].lstrip(" :\n-\t")
    if meta.document.source_type == "branch":
        # Branch projections may contain navigation URLs and serialized
        # amenities for the catalog UI. They are not useful in a compact chat
        # answer and make the source look like raw debug output.
        content = re.sub(r"https?://\S+", "", content, flags=re.IGNORECASE)
        content = re.sub(r"\[[^\]]*\]", "", content)
        content = re.sub(r"\s{2,}", " ", content).strip(" ,;.-")
    if len(content) > MAX_PATIENT_EXCERPT_CHARS:
        content = content[:MAX_PATIENT_EXCERPT_CHARS].rsplit(" ", 1)[0].rstrip(" ,;:-") + "…"
    content = content.strip()
    excerpt = f"{title}: {content}" if content else title
    return f"{excerpt}." if excerpt and excerpt[-1].isalnum() else excerpt


def grounded_source_excerpt(document: RagDocument) -> str:
    """Expose the same compact source renderer to the legacy chat path."""

    return _grounded_excerpt(_source_metadata(document))


def _local_grounded_response(
    message: str,
    mode: ChatMode,
    metas: Sequence[_SourceMetadata],
) -> ChatResponse:
    if not metas:
        return _insufficient_response(mode)
    if any(not _context_is_safe(meta) for meta in metas):
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
    specialty_guidance = (
        mode is ChatMode.HOSPITAL_SUPPORT
        and bool(_specialty_guidance_hint_tokens(message))
        and all(meta.document.source_type == "specialty" for meta in metas)
    )
    if mode is ChatMode.SYMPTOM_TRIAGE:
        triage = rule_based_triage(message)
        excerpts = " ".join(_grounded_excerpt(meta) for meta in metas[:3])
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
    elif specialty_guidance:
        titles = [meta.document.title for meta in metas[:3]]
        if len(titles) == 1:
            lead = f"Với mô tả ngắn này, bạn có thể bắt đầu tham khảo chuyên khoa {titles[0]}."
        else:
            lead = "Với mô tả ngắn này, các chuyên khoa có thể liên quan gồm: " + ", ".join(titles) + "."
        excerpts = " ".join(_grounded_excerpt(meta) for meta in metas[:3])
        answer = (
            f"{lead} Theo nguồn thông tin đã được kiểm duyệt: {excerpts} "
            "Trợ lý AI không chẩn đoán thay cho bác sĩ; hãy đặt lịch hoặc trao đổi trực tiếp "
            "với nhân viên y tế nếu triệu chứng kéo dài, nặng lên hoặc khiến bạn lo lắng."
        )
        action = ChatSafetyAction.ANSWER
        summary = None
    else:
        excerpts = " ".join(_grounded_excerpt(meta) for meta in metas[:3])
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
        cost_tier="local_free",
        routing_reason="high_similarity_internal_kb",
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
    embedder: Callable[..., object] = embed,
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
            if embedder is embed:
                embedded = embedder(
                    request.message,
                    settings,
                    synthetic_beta=request.synthetic_beta,
                )
            else:
                # Preserve the small two-argument test/double contract while
                # the production embed function receives the marker above.
                embedded = embedder(request.message, settings)
            vector, model, provenance = _embedding_parts(embedded)
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

    if not hits:
        # The durable backend's hybrid RPC can return zero rows when
        # source-type filters ride along with a Vietnamese FTS query. Retry
        # unfiltered and let the Python-side mode/expiry/safety gates filter —
        # they run either way below.
        try:
            hits = rag_service.search(
                vector,
                top_k=min(max(request.top_k, 20), 60),
                query_text=request.message,
                embedding_model=model,
                embedding_provenance=search_provenance,
            )
        except (EmbeddingContractError, ProviderUnavailable):
            hits = []

    threshold = _threshold(settings)
    candidates: list[ChatCandidate] = []
    for document, score in hits:
        if score < threshold:
            continue
        meta = _source_metadata(document)
        if not _mode_allows(meta, request.mode) or _expired(meta):
            continue
        if not _context_is_safe(meta):
            # Quarantine untrusted content instead of returning it as an
            # authorized candidate.
            continue
        candidates.append(_candidate(meta, score))
        if len(candidates) >= min(request.top_k, 20):
            break

    # Lexical rescue: vector hits below the relevance threshold are the norm
    # with local hash embeddings. When nothing qualified, rescore the same
    # hits by diacritic-folded token overlap (with Vietnamese symptom→specialty
    # expansions) so approved catalog content can still be cited. Documents
    # that fail the mode/expiry/safety gates above are skipped here too.
    if not candidates and hits:
        query_tokens = _lexical_tokens(normalize_sensitive_text(request.message), expand=True)
        for document, score in hits:
            meta = _source_metadata(document)
            if not _mode_allows(meta, request.mode) or _expired(meta):
                continue
            if not _context_is_safe(meta):
                continue
            overlap = _lexical_overlap(
                query_tokens,
                f"{getattr(document, 'title', '')}\n{getattr(document, 'content', '')}",
            )
            if overlap < threshold:
                continue
            candidates.append(_candidate(meta, max(score, overlap)))
            if len(candidates) >= min(request.top_k, 20):
                break

    candidates = _focus_candidates_for_question(request.message, request.mode, candidates)

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
        return safety.model_copy(update={
            "mode": request.mode,
            "used_sources": [],
            "cost_tier": "local_free",
            "routing_reason": "safety_guardrail_shortcircuit",
        })

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

    if any(not _context_is_safe(meta) for meta in metas):
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
        is_complex = is_complex_multisymptom_query(request.message)
        is_operational = request.mode is ChatMode.HOSPITAL_SUPPORT or all(meta.projection_kind == "OPERATIONAL" for meta in metas)
        if client is None and not is_complex and is_operational:
            response = _local_grounded_response(request.message, request.mode, metas)
            response = response.model_copy(update={
                "cost_tier": "local_free",
                "routing_reason": "high_similarity_internal_kb",
            })
        else:
            allow_public_operational = (
                request.mode is ChatMode.HOSPITAL_SUPPORT
                and all(_public_operational_context(meta) for meta in metas)
            )
            context = [
                f"{meta.document.title}: "
                f"{_clean_patient_source_content(meta.document.content)[:MAX_CONTEXT_CHARS]}"
                for meta in metas
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
                synthetic_beta=request.synthetic_beta,
                allow_public_operational=allow_public_operational,
            )
            if response.safety_action is ChatSafetyAction.INSUFFICIENT_EVIDENCE:
                return _insufficient_response(request.mode)
            if response.provenance == "remote_provider":
                routing_reason = "complex_multisymptom_clinical_reasoning" if is_complex else "remote_llm_escalation"
                response = response.model_copy(update={
                    "cost_tier": "remote_llm",
                    "routing_reason": routing_reason,
                })
    if response.provenance == "remote_provider" and _unsafe_claim(response.answer):
        return _insufficient_response(request.mode)

    if response.safety_action is not ChatSafetyAction.ANSWER and not response.used_sources:
        return response.model_copy(
            update={
                "mode": request.mode,
                "used_sources": [],
                "citations": [],
                "cost_tier": response.cost_tier,
                "routing_reason": response.routing_reason,
            }
        )

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
            "cost_tier": response.cost_tier,
            "routing_reason": response.routing_reason,
        }
    )
