"""Environment-backed configuration for the AI service.

The service deliberately keeps provider credentials and limits in settings so
callers do not need to know which provider implementation is active.  The
hard limits in the request schemas remain the final safety boundary; the
configured limits may make those bounds stricter for a deployment.
"""

from urllib.parse import urlparse

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
    # This is deliberately independent from the provider credential.  A
    # deployment must opt into the patient-chat egress path twice: once in the
    # AI service and once in Spring's provenance gate.
    ai_chat_remote_provider_enabled: bool = False
    # Remote patient chat is a synthetic-beta capability only.  The default is
    # fail-closed; local/test callers can still exercise provider adapters with
    # an in-memory test double without constructing a synthetic runtime.
    remote_ai_synthetic_only: bool = True
    remote_ai_kill_switch: bool = False
    remote_ai_provider_allowlist: str = "deepseek"
    remote_ai_https_host_allowlist: str = "api.deepseek.com"
    ai_chat_circuit_failure_threshold: int = Field(default=3, ge=1, le=10)
    ai_chat_circuit_reset_seconds: float = Field(default=30.0, gt=0, le=300)
    ai_max_input_chars: int = Field(default=10_000, ge=2, le=10_000)
    ai_max_retrieved_chunks: int = Field(default=5, ge=1, le=20)
    # Patient two-step retrieval is fail-closed below this hybrid score.
    ai_chat_relevance_threshold: float = Field(default=0.35, ge=0, le=1)
    rag_max_document_chars: int = Field(default=20_000, ge=1, le=20_000)
    # A source listing is paginated; this is a memory safety ceiling, not a
    # reconciliation completeness limit.
    rag_max_documents: int = Field(default=10_000, ge=1, le=100_000)

    # Durable RAG is opt-in so local/test runtimes retain the current
    # dependency-free in-memory behavior. `SUPABASE_DB_URL` is a direct
    # PostgreSQL URI (or a Supavisor session/transaction URI), not the
    # backend's JDBC `DATABASE_URL`.
    rag_storage_backend: str = "memory"
    supabase_db_url: str = ""
    supabase_db_schema: str = "healthcare"
    # Patient-chat retrieval uses the protected projection, never the legacy
    # healthcare.ai_documents table used by the old catalog search.
    supabase_rag_table: str = "ai_chat_documents"
    supabase_rag_rpc: str = "match_chat_documents"
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

        runtime = self.ai_service_runtime.strip().casefold()
        remote_requested = self.ai_patient_chat_remote_enabled or self.ai_chat_remote_provider_enabled
        if remote_requested and runtime in {"prod", "production"}:
            raise ValueError("Remote patient chat is disabled in production")
        if self.ai_provider.strip().casefold() == "deepseek":
            if not self.ai_api_key.strip():
                self.ai_api_key = self.deepseek_api_key
            if not self.ai_chat_model.strip():
                self.ai_chat_model = self.deepseek_model.strip() or DEFAULT_DEEPSEEK_CHAT_MODEL
            if not self.ai_embedding_model.strip():
                self.ai_embedding_model = self.deepseek_embedding_model or "text-embedding-3-small"
            if not self.ai_base_url.strip():
                self.ai_base_url = self.deepseek_base_url.strip() or "https://api.deepseek.com"

        if self.ai_patient_chat_remote_enabled:
            if not self.ai_chat_remote_provider_enabled:
                raise ValueError("Remote patient chat requires the Spring provenance gate")
            if self.remote_ai_kill_switch:
                raise ValueError("Remote patient chat kill switch is enabled")
            if self.remote_ai_synthetic_only and runtime not in {"synthetic-beta", "synthetic_beta"}:
                raise ValueError("Remote patient chat requires synthetic-beta runtime")
            if self.remote_ai_synthetic_only:
                if self.rag_storage_backend != "supabase":
                    raise ValueError("Synthetic remote patient chat requires Supabase RAG")
                if self.supabase_rag_fallback_to_memory:
                    raise ValueError("Synthetic remote patient chat cannot fall back to memory RAG")
            provider = self.ai_provider.strip().casefold()
            allowed_providers = {
                item.strip().casefold()
                for item in self.remote_ai_provider_allowlist.split(",")
                if item.strip()
            }
            if provider not in allowed_providers:
                raise ValueError("AI_PROVIDER is not in the remote provider allowlist")
            parsed = urlparse(self.ai_base_url.strip())
            allowed_hosts = {
                item.strip().casefold()
                for item in self.remote_ai_https_host_allowlist.split(",")
                if item.strip()
            }
            if parsed.scheme.casefold() != "https" or not parsed.hostname or parsed.hostname.casefold() not in allowed_hosts:
                raise ValueError("Remote AI base URL must use an allowlisted HTTPS host")
            if not self.ai_api_key.strip():
                raise ValueError("Remote patient chat requires an AI provider secret")
        return self
