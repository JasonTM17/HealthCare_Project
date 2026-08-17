from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class HealthResponse(BaseModel):
    status: str
    service: str
    ai_provider: str
    deepseek_configured: bool
    deepseek_model: Optional[str] = None


class TriageRequest(BaseModel):
    symptoms: str = Field(..., min_length=2, max_length=10_000, description="Patient reported symptoms")
    age: Optional[int] = Field(None, ge=0, le=120, description="Patient age in years")
    gender: Optional[str] = Field(None, description="Gender (male, female, other)")


class TriageResponse(BaseModel):
    recommended_specialty: str
    urgency_level: str  # EMERGENCY, HIGH, NORMAL
    clinical_advice: str
    suggested_questions: List[str]
    disclaimer: str = "Kết quả phân tích triệu chứng từ AI mang tính tham khảo sơ bộ, không thay thế chẩn đoán của bác sĩ chuyên khoa."


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    model: str


class RAGSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10_000)
    top_k: int = Field(default=5, ge=1, le=20)


class RAGIndexRequest(BaseModel):
    source_type: Literal["specialty", "doctor", "service", "package", "article", "faq"]
    source_id: str = Field(..., min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1, max_length=20_000)


class RAGIndexResponse(BaseModel):
    id: str
    index_size: int


class RAGSearchResult(BaseModel):
    source_type: str
    source_id: str
    title: str
    content: str
    score: float


class RAGSearchResponse(BaseModel):
    results: List[RAGSearchResult]


class SemanticSearchResult(BaseModel):
    source_type: str
    source_id: str
    title: str
    content: str
    score: float


class SemanticSearchResponse(BaseModel):
    results: List[SemanticSearchResult]
    query: str = ""
    specialty: str = ""


class SpecialtyRecommendationRequest(BaseModel):
    symptoms: str = Field(..., min_length=2, max_length=10_000)
