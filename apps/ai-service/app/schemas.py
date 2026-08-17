"""Validated request and response contracts for the AI service."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


MAX_INPUT_CHARS = 10_000
MAX_DOCUMENT_CHARS = 20_000
MAX_RETRIEVED_CHUNKS = 20

SOURCE_TYPES = Literal["specialty", "doctor", "service", "package", "article", "faq"]

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


class TriageRequest(BaseModel):
    symptoms: str = Field(
        ...,
        min_length=2,
        max_length=MAX_INPUT_CHARS,
        description="Patient reported symptoms",
    )
    age: int | None = Field(None, ge=0, le=120, description="Patient age in years")
    gender: str | None = Field(None, max_length=50, description="Optional gender")

    _trim_symptoms = field_validator("symptoms", mode="before")(_trim_text)
    _trim_gender = field_validator("gender", mode="before")(_trim_text)


class Citation(BaseModel):
    """A citation points only to an ingested source identity.

    The AI service intentionally does not manufacture URLs, doctor IDs, or
    availability details.  The backend can resolve this identity against its
    own verified catalog when a richer follow-up is needed.
    """

    source_type: SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(..., min_length=1, max_length=300)


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
    text: str = Field(..., min_length=1, max_length=MAX_INPUT_CHARS)

    _trim_text = field_validator("text", mode="before")(_trim_text)


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    model: str


class RAGSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=MAX_INPUT_CHARS)
    top_k: int = Field(default=5, ge=1, le=MAX_RETRIEVED_CHUNKS)

    _trim_query = field_validator("query", mode="before")(_trim_text)


class RAGIndexRequest(BaseModel):
    source_type: SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1, max_length=MAX_DOCUMENT_CHARS)
    active: bool = True
    published: bool = True
    metadata: dict[str, str] = Field(default_factory=dict)

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


class RAGSearchResult(BaseModel):
    source_type: SOURCE_TYPES
    source_id: str
    title: str
    content: str
    score: float
    citation: Citation


class RAGSearchResponse(BaseModel):
    results: list[RAGSearchResult] = Field(max_length=MAX_RETRIEVED_CHUNKS)


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


class SpecialtyRecommendationRequest(BaseModel):
    symptoms: str = Field(..., min_length=2, max_length=MAX_INPUT_CHARS)

    _trim_symptoms = field_validator("symptoms", mode="before")(_trim_text)
