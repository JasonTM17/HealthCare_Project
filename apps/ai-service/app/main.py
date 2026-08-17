from fastapi import FastAPI
from pydantic_settings import BaseSettings
from app.schemas import HealthResponse, TriageRequest, TriageResponse
from app.llm import resolve_triage


class Settings(BaseSettings):
    service_name: str = "healthcare-ai-service"
    ai_provider: str = "rule_based_triage"
    # DeepSeek LLM credentials — when ai_provider="deepseek" and a key is set,
    # triage is answered by the LLM instead of the rule-based baseline.
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"


settings = Settings()
app = FastAPI(title="HealthCare AI Service", version="0.1.0")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        ai_provider=settings.ai_provider,
        deepseek_configured=bool(settings.deepseek_api_key),
        deepseek_model=settings.deepseek_model if settings.deepseek_api_key else None,
    )


@app.post("/triage", response_model=TriageResponse)
def symptom_triage(request: TriageRequest) -> TriageResponse:
    return resolve_triage(request.symptoms, settings)
