"""Environment-backed configuration for the AI service.

The service deliberately keeps provider credentials and limits in settings so
callers do not need to know which provider implementation is active.  The
hard limits in the request schemas remain the final safety boundary; the
configured limits may make those bounds stricter for a deployment.
"""

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.providers import DEFAULT_DEEPSEEK_CHAT_MODEL


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
    # Provider credentials do not authorize exporting patient chat. This
    # separate opt-in keeps sensitive conversations local by default.
    ai_patient_chat_remote_enabled: bool = False
    ai_chat_circuit_failure_threshold: int = Field(default=3, ge=1, le=10)
    ai_chat_circuit_reset_seconds: float = Field(default=30.0, gt=0, le=300)
    ai_max_input_chars: int = Field(default=10_000, ge=2, le=10_000)
    ai_max_retrieved_chunks: int = Field(default=5, ge=1, le=20)
    rag_max_document_chars: int = Field(default=20_000, ge=1, le=20_000)
    rag_max_documents: int = Field(default=5_000, ge=1, le=10_000)

    # Durable RAG is opt-in so local/test runtimes retain the current
    # dependency-free in-memory behavior. `SUPABASE_DB_URL` is a direct
    # PostgreSQL URI (or a Supavisor session/transaction URI), not the
    # backend's JDBC `DATABASE_URL`.
    rag_storage_backend: str = "memory"
    supabase_db_url: str = ""
    supabase_db_schema: str = "healthcare"
    supabase_rag_table: str = "ai_documents"
    supabase_rag_rpc: str = "match_documents"
    supabase_db_connect_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    supabase_rag_fallback_to_memory: bool = True
    rag_embedding_dimension: int = Field(default=384, ge=384, le=384)

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
    deepseek_model: str = DEFAULT_DEEPSEEK_CHAT_MODEL
    deepseek_embedding_model: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    @field_validator("rag_storage_backend")
    @classmethod
    def validate_rag_storage_backend(cls, value: str) -> str:
        normalized = value.strip().casefold()
        if normalized not in {"memory", "supabase"}:
            raise ValueError("RAG_STORAGE_BACKEND must be memory or supabase")
        return normalized

    @field_validator("supabase_db_schema", "supabase_rag_table", "supabase_rag_rpc")
    @classmethod
    def validate_sql_identifier(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized or not normalized.replace("_", "").isalnum() or not normalized[0].isalpha():
            raise ValueError("Supabase schema, table, and RPC names must be simple SQL identifiers")
        return normalized

    @property
    def supabase_rag_configured(self) -> bool:
        """Whether the durable backend has an explicit connection contract."""

        return self.rag_storage_backend == "supabase" and bool(self.supabase_db_url.strip())

    @model_validator(mode="after")
    def apply_legacy_provider_aliases(self) -> "Settings":
        """Use legacy values only when the provider-neutral value is empty."""

        if self.ai_provider.strip().casefold() != "deepseek":
            return self
        if not self.ai_api_key.strip():
            self.ai_api_key = self.deepseek_api_key
        if not self.ai_chat_model.strip():
            self.ai_chat_model = self.deepseek_model.strip() or DEFAULT_DEEPSEEK_CHAT_MODEL
        if not self.ai_embedding_model.strip():
            self.ai_embedding_model = self.deepseek_embedding_model or "text-embedding-3-small"
        if not self.ai_base_url.strip():
            self.ai_base_url = self.deepseek_base_url.strip() or "https://api.deepseek.com"
        return self
