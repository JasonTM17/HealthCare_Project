from fastapi import FastAPI
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "healthcare-ai-service"
    ai_provider: str = "disabled"


settings = Settings()
app = FastAPI(title="HealthCare AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "ai_provider": settings.ai_provider,
    }
