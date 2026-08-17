"""Environment-backed configuration for the AI service.

The service deliberately keeps provider credentials and limits in settings so
callers do not need to know which provider implementation is active.  The
hard limits in the request schemas remain the final safety boundary; the
configured limits may make those bounds stricter for a deployment.
"""

from pydantic import Field, model_validator
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
    ai_chat_model: str = ""
    ai_embedding_model: str = ""
    ai_base_url: str = ""
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
    deepseek_embedding_model: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    @model_validator(mode="after")
    def apply_legacy_provider_aliases(self) -> "Settings":
        """Use legacy values only when the provider-neutral value is empty."""

        if not self.ai_api_key.strip():
            self.ai_api_key = self.deepseek_api_key
        if not self.ai_chat_model.strip():
            self.ai_chat_model = self.deepseek_model
        if not self.ai_embedding_model.strip():
            self.ai_embedding_model = self.deepseek_embedding_model or "text-embedding-3-small"
        if not self.ai_base_url.strip():
            self.ai_base_url = self.deepseek_base_url
        return self
