from pydantic import BaseModel, Field
from typing import List, Optional


class HealthResponse(BaseModel):
    status: str
    service: str
    ai_provider: str
    deepseek_configured: bool
    deepseek_model: Optional[str] = None


class TriageRequest(BaseModel):
    symptoms: str = Field(..., min_length=2, description="Patient reported symptoms")
    age: Optional[int] = Field(None, ge=0, le=120, description="Patient age in years")
    gender: Optional[str] = Field(None, description="Gender (male, female, other)")


class TriageResponse(BaseModel):
    recommended_specialty: str
    urgency_level: str  # EMERGENCY, HIGH, NORMAL
    clinical_advice: str
    suggested_questions: List[str]
    disclaimer: str = "Kết quả phân tích triệu chứng từ AI mang tính tham khảo sơ bộ, không thay thế chẩn đoán của bác sĩ chuyên khoa."
