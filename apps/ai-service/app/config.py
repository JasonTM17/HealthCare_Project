"""Environment-backed configuration for the AI service.

The service deliberately keeps provider credentials and limits in settings so
callers do not need to know which provider implementation is active.  The
hard limits in the request schemas remain the final safety boundary; the
configured limits may make those bounds stricter for a deployment.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables only."""

    model_config = SettingsConfigDict(
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    service_name: str = "healthcare-ai-service"

    # Provider-neutral names are the public configuration contract.
    ai_provider: str = "rule_based_triage"
    embedding_provider: str = "local"
    ai_api_key: str = ""
    ai_chat_model: str = "deepseek-chat"
    ai_embedding_model: str = "text-embedding-3-small"
    ai_base_url: str = "https://api.deepseek.com"
    ai_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    ai_max_input_chars: int = Field(default=10_000, ge=2, le=10_000)
    ai_max_retrieved_chunks: int = Field(default=5, ge=1, le=20)
    rag_max_document_chars: int = Field(default=20_000, ge=1, le=20_000)

    # RAG ingestion is a separate, explicitly protected capability.
    rag_ingest_enabled: bool = False
    rag_ingest_token: str = ""

    # Internal service-to-service authentication.
    ai_service_token: str = ""
    ai_service_runtime: str = "non-local"
    ai_service_allow_unauthenticated_local: bool = False

    # Backward-compatible DeepSeek names.  They remain accepted for existing
    # local setups while new deployments should use the provider-neutral names.
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"
