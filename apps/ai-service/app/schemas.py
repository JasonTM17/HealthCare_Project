"""Validated request and response contracts for the AI service."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MAX_INPUT_CHARS = 10_000
MAX_DOCUMENT_CHARS = 20_000
MAX_RETRIEVED_CHUNKS = 20
# The patient-chat projection is backed by pgvector(384).  Keep this separate
# from MAX_EMBEDDING_DIMENSION, which remains the generic RAG safety ceiling
# for legacy/in-memory fixtures.
EMBEDDING_DIMENSION = 384
MAX_EMBEDDING_DIMENSION = 4_096

SOURCE_TYPES = Literal["branch", "specialty", "doctor", "service", "package", "article", "faq"]
ProviderProvenance = Literal["local_provider", "remote_provider", "local_fallback"]


class ChatMode(str, Enum):
    """The immutable patient-chat intent selected when a conversation starts."""

    HOSPITAL_SUPPORT = "HOSPITAL_SUPPORT"
    SYMPTOM_TRIAGE = "SYMPTOM_TRIAGE"
    HEALTH_EDUCATION = "HEALTH_EDUCATION"


class ChatSafetyAction(str, Enum):
    """Deterministic safety outcome; this value is never delegated to an LLM."""

    ANSWER = "ANSWER"
    REFUSE = "REFUSE"
    EMERGENCY = "EMERGENCY"
    HUMAN_HANDOFF = "HUMAN_HANDOFF"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class TriageUrgency(str, Enum):
    EMERGENCY = "EMERGENCY"
    HIGH = "HIGH"
    NORMAL = "NORMAL"


ProjectionKind = Literal["OPERATIONAL", "CLINICAL"]

ALLOWED_SPECIALTIES = (
    "Tim Mạch & Can Thiệp Mạch Máu",
    "Thần Kinh & Đột Quỵ",
    "Tiêu Hóa - Gan Mật - Tụy",
    "Cơ Xương Khớp & Phục Hồi Chức Năng",
    "Sản Phụ Khoa",
    "Nhi Khoa",
    "Da Liễu",
    "Nội Tổng Quát",
    "Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
)

ALLOWED_URGENCY = ("EMERGENCY", "HIGH", "NORMAL")


def _trim_text(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


class HealthResponse(BaseModel):
    status: str
    service: str
    ai_provider: str
    deepseek_configured: bool
    deepseek_model: str | None = None
    service_auth_configured: bool
    local_auth_escape_hatch: bool
    ready: bool = True
    provider_configured: bool = True
    fallback_allowed: bool = False
    remote_probe_required: bool = False
    rag_ready: bool = True


class TriageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symptoms: str = Field(
        ...,
        min_length=2,
        max_length=MAX_INPUT_CHARS,
        description="Patient reported symptoms",
    )
    age: int | None = Field(None, ge=0, le=120, description="Patient age in years")
    gender: str | None = Field(None, max_length=50, description="Optional gender")
    # Remote triage requires an explicit synthetic-beta assertion from Spring.
    synthetic_beta: bool = False

    _trim_symptoms = field_validator("symptoms", mode="before")(_trim_text)
    _trim_gender = field_validator("gender", mode="before")(_trim_text)


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2_000)

    _trim_content = field_validator("content", mode="before")(_trim_text)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=2, max_length=MAX_INPUT_CHARS)
    recent_turns: list[ChatTurn] = Field(default_factory=list, max_length=6)
    top_k: int = Field(default=5, ge=1, le=MAX_RETRIEVED_CHUNKS)
    # Additive field: legacy callers that only send `message` retain the old
    # /chat behavior while the two-step patient contract can select a mode.
    mode: ChatMode = ChatMode.HOSPITAL_SUPPORT
    # Internal Spring assertion; browser callers cannot enable remote egress.
    synthetic_beta: bool = False

    _trim_message = field_validator("message", mode="before")(_trim_text)


class Citation(BaseModel):
    """A citation points only to an ingested source identity.

    The AI service intentionally does not manufacture URLs, doctor IDs, or
    availability details.  The backend can resolve this identity against its
    own verified catalog when a richer follow-up is needed.
    """

    model_config = ConfigDict(extra="forbid")

    source_type: SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(..., min_length=1, max_length=300)


class TriageSummary(BaseModel):
    """A bounded, non-diagnostic triage summary attached to patient chat."""

    model_config = ConfigDict(extra="forbid")

    urgency_level: TriageUrgency
    recommended_specialty: str | None = Field(default=None, max_length=100)


class AuthorizedSource(BaseModel):
    """Exact source identity authorized by Spring for one generation call.

    The AI service resolves the identity against its current projection.  It
    never accepts source content, URLs, or model-created identifiers from a
    caller.  Revision/hash fields are optional for legacy operational rows but
    are required by the clinical-mode validator.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    source_type: SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    projection_kind: ProjectionKind = "OPERATIONAL"
    content_revision: int | None = Field(default=None, ge=0)
    eligibility_revision: int | None = Field(default=None, ge=0)
    content_hash: str | None = Field(default=None, min_length=1, max_length=128)
    approval_id: str | None = Field(default=None, min_length=1, max_length=200)


class UsedSource(AuthorizedSource):
    """Source metadata actually included in provider context.

    Generation constructs this list from the validated projection, so it is
    exhaustive and cannot contain a source not present in `authorized_sources`.
    """


class ChatRetrieveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=2, max_length=MAX_INPUT_CHARS)
    mode: ChatMode = ChatMode.HOSPITAL_SUPPORT
    recent_turns: list[ChatTurn] = Field(default_factory=list, max_length=6)
    top_k: int = Field(default=5, ge=1, le=MAX_RETRIEVED_CHUNKS)
    # Internal Spring assertion. It is never accepted from the browser and is
    # required when a synthetic-beta runtime is allowed to call a remote model.
    synthetic_beta: bool = False

    _trim_message = field_validator("message", mode="before")(_trim_text)


class ChatCandidate(AuthorizedSource):
    """A retrieval candidate; content stays inside the AI service boundary."""

    title: str = Field(..., min_length=1, max_length=300)
    score: float = Field(..., ge=0, le=1)


class ChatRetrieveResponse(BaseModel):
    mode: ChatMode
    candidates: list[ChatCandidate] = Field(default_factory=list, max_length=MAX_RETRIEVED_CHUNKS)
    relevance_threshold: float = Field(..., ge=0, le=1)
    safety_action: ChatSafetyAction = ChatSafetyAction.ANSWER
    provenance: ProviderProvenance = "local_provider"


class ChatGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=2, max_length=MAX_INPUT_CHARS)
    mode: ChatMode = ChatMode.HOSPITAL_SUPPORT
    recent_turns: list[ChatTurn] = Field(default_factory=list, max_length=6)
    authorized_sources: list[AuthorizedSource] = Field(default_factory=list, max_length=MAX_RETRIEVED_CHUNKS)
    synthetic_beta: bool = False

    _trim_message = field_validator("message", mode="before")(_trim_text)


class ChatResponse(BaseModel):
    answer: str = Field(..., min_length=1, max_length=4_000)
    disclaimer: str = (
        "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế "
        "tư vấn, chẩn đoán hoặc điều trị của bác sĩ."
    )
    citations: list[Citation] = Field(default_factory=list, max_length=MAX_RETRIEVED_CHUNKS)
    provenance: ProviderProvenance = "local_provider"
    # Additive fields used by the patient two-step contract.  Defaults keep
    # existing /chat and direct `resolve_chat` callers source-compatible.
    mode: ChatMode = ChatMode.HOSPITAL_SUPPORT
    safety_action: ChatSafetyAction = ChatSafetyAction.ANSWER
    used_sources: list[UsedSource] = Field(default_factory=list, max_length=MAX_RETRIEVED_CHUNKS)
    triage: TriageSummary | None = None


class TriageResponse(BaseModel):
    recommended_specialty: str
    urgency_level: str
    clinical_advice: str
    suggested_questions: list[str] = Field(default_factory=list, max_length=3)
    disclaimer: str = (
        "Kết quả phân tích triệu chứng từ AI mang tính tham khảo sơ bộ, "
        "không thay thế chẩn đoán của bác sĩ chuyên khoa."
    )
    citations: list[Citation] = Field(default_factory=list, max_length=MAX_RETRIEVED_CHUNKS)
    provenance: ProviderProvenance = "local_provider"


class SpecialtyRecommendationResponse(TriageResponse):
    """Stable, structured specialty recommendation response."""


class LLMRecommendation(BaseModel):
    """Strict allow-listed shape accepted from a remote language model."""

    model_config = ConfigDict(extra="forbid")

    recommended_specialty: str = Field(..., min_length=1, max_length=100)
    urgency_level: str = Field(..., min_length=1, max_length=20)
    clinical_advice: str = Field(..., min_length=1, max_length=2_000)
    suggested_questions: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("recommended_specialty")
    @classmethod
    def validate_specialty(cls, value: str) -> str:
        if value not in ALLOWED_SPECIALTIES:
            raise ValueError("unsupported specialty")
        return value

    @field_validator("urgency_level")
    @classmethod
    def validate_urgency(cls, value: str) -> str:
        if value not in ALLOWED_URGENCY:
            raise ValueError("unsupported urgency")
        return value

    @field_validator("suggested_questions")
    @classmethod
    def validate_questions(cls, value: list[str]) -> list[str]:
        return [question.strip() for question in value if question.strip()]


class EmbeddingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, max_length=MAX_INPUT_CHARS)
    # Remote embeddings are internal-only and require the synthetic assertion.
    synthetic_beta: bool = False

    _trim_text = field_validator("text", mode="before")(_trim_text)


class EmbeddingResponse(BaseModel):
    embedding: list[float] = Field(
        ...,
        min_length=EMBEDDING_DIMENSION,
        max_length=EMBEDDING_DIMENSION,
    )
    model: str
    provenance: ProviderProvenance = "local_provider"


class RAGSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1, max_length=MAX_INPUT_CHARS)
    top_k: int = Field(default=5, ge=1, le=MAX_RETRIEVED_CHUNKS)
    synthetic_beta: bool = False

    _trim_query = field_validator("query", mode="before")(_trim_text)


class RAGIndexRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_type: SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1, max_length=MAX_DOCUMENT_CHARS)
    active: bool = True
    published: bool = True
    metadata: dict[str, str] = Field(default_factory=dict)
    synthetic_beta: bool = False

    _trim_title = field_validator("title", mode="before")(_trim_text)
    _trim_content = field_validator("content", mode="before")(_trim_text)

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 20:
            raise ValueError("metadata has too many entries")
        for key, item in value.items():
            if len(key) > 100 or len(item) > 500:
                raise ValueError("metadata entry is too large")
        return value


class RAGIndexResponse(BaseModel):
    id: str
    index_size: int
    indexed: bool = True


class RAGSource(BaseModel):
    source_type: SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    # Optional provenance fields let the trusted Spring reconciler distinguish
    # operational and governed clinical rows without exposing document text.
    projection_kind: ProjectionKind | None = None
    content_revision: int | None = Field(default=None, ge=0)
    eligibility_revision: int | None = Field(default=None, ge=0)
    content_hash: str | None = Field(default=None, min_length=64, max_length=64)
    approval_state: str | None = Field(default=None, max_length=32)
    approval_id: str | None = Field(default=None, max_length=128)
    approval_expires_at: str | None = Field(default=None, max_length=80)


class RAGSourcesResponse(BaseModel):
    sources: list[RAGSource]
    # Optional so legacy callers keep the original JSON shape.  A complete
    # reconciliation request receives all three fields.
    next_cursor: str | None = None
    complete: bool | None = None
    total: int | None = Field(default=None, ge=0)


class RAGDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_type: SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    revision: int | None = Field(default=None, ge=0)
    projection_kind: ProjectionKind | None = None

    @model_validator(mode="after")
    def require_clinical_revision(self) -> "RAGDeleteRequest":
        # A projection-less delete of governed source types is an
        # all-projection operation, so it must carry the current database-owned
        # eligibility revision. Explicit operational deletes remain usable by
        # legacy writers without a clinical watermark.
        clinical_source = self.source_type in {"specialty", "article", "faq"}
        if (
            self.projection_kind == "CLINICAL"
            or (self.projection_kind is None and clinical_source)
        ) and (self.revision is None or self.revision <= 0):
            raise ValueError("clinical delete requires a positive revision")
        return self


class RAGDeleteResponse(BaseModel):
    removed: bool
    index_size: int


class RAGSearchResult(BaseModel):
    source_type: SOURCE_TYPES
    source_id: str
    title: str
    content: str
    score: float
    citation: Citation


class RAGSearchResponse(BaseModel):
    results: list[RAGSearchResult] = Field(max_length=MAX_RETRIEVED_CHUNKS)
    provenance: ProviderProvenance = "local_provider"


class SemanticSearchResult(BaseModel):
    source_type: SOURCE_TYPES
    source_id: str
    title: str
    content: str
    score: float
    citation: Citation


class SemanticSearchResponse(BaseModel):
    results: list[SemanticSearchResult] = Field(max_length=MAX_RETRIEVED_CHUNKS)
    query: str = ""
    specialty: str = ""
    provenance: ProviderProvenance = "local_provider"


class SemanticSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(default="", max_length=MAX_INPUT_CHARS)
    specialty: str = Field(default="", max_length=200)
    top_k: int = Field(default=10, ge=1, le=MAX_RETRIEVED_CHUNKS)
    synthetic_beta: bool = False

    _trim_query = field_validator("query", mode="before")(_trim_text)
    _trim_specialty = field_validator("specialty", mode="before")(_trim_text)


class SpecialtyRecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symptoms: str = Field(..., min_length=2, max_length=MAX_INPUT_CHARS)
    synthetic_beta: bool = False

    _trim_symptoms = field_validator("symptoms", mode="before")(_trim_text)
