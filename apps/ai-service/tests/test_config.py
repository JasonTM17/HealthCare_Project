"""Provider-neutral and legacy environment alias tests."""

import logging

import pytest

from app.config import Settings
from app.providers import remote_base_url_allowed
from app.rag import RagService
from app.supabase_rag import PersistentRagService, SupabaseRagUnavailable, build_rag_service


def test_rag_memory_fallback_default_stays_permissive_for_local_runtimes() -> None:
    # Decision: the default stays True. Flipping it would turn the offline
    # local/demo loop into a hard startup failure, and it cannot harden a hosted
    # deployment because build_rag_service() already ANDs this flag with a local
    # runtime name. The permissive default is instead made visible at startup.
    assert Settings().supabase_rag_fallback_to_memory is True


@pytest.mark.parametrize("runtime", ["render", "render-beta", "non-local", "production"])
def test_rag_memory_fallback_cannot_arm_a_hosted_runtime(runtime: str) -> None:
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime=runtime,
        supabase_db_url="",
    )

    # No DSN plus a non-local runtime must refuse to start rather than silently
    # serve the in-memory index, regardless of the permissive default.
    with pytest.raises(SupabaseRagUnavailable, match="requires SUPABASE_DB_URL"):
        build_rag_service(settings)


def test_armed_local_rag_memory_fallback_warns_at_startup(
    caplog: pytest.LogCaptureFixture,
) -> None:
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="local",
        supabase_db_url="",
    )

    with caplog.at_level(logging.WARNING, logger="uvicorn.error.healthcare.ai.rag"):
        service = build_rag_service(settings)

    assert isinstance(service, RagService)
    assert not isinstance(service, PersistentRagService)
    assert service.fallback_active is True
    # The degraded default is loud: the warning names the state and the reason.
    messages = [record.getMessage() for record in caplog.records]
    assert any("rag_fallback" in message and "state=armed_no_durable_authority" in message for message in messages)
    assert any("reason=missing_supabase_db_url" in message for message in messages)


def test_armed_durable_rag_fallback_warns_at_startup(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.supabase_rag as supabase_rag_module

    class OfflineStore:
        def list_documents(self) -> list[object]:
            raise SupabaseRagUnavailable("offline")

    monkeypatch.setattr(supabase_rag_module, "SupabaseRagStore", lambda _: OfflineStore())
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="local",
        supabase_db_url="postgresql://service.test/healthcare",
    )

    with caplog.at_level(logging.WARNING, logger="uvicorn.error.healthcare.ai.rag"):
        service = build_rag_service(settings)

    assert isinstance(service, PersistentRagService)
    assert service.fallback_permitted is True
    messages = [record.getMessage() for record in caplog.records]
    assert any(
        "rag_fallback" in message
        and "state=armed" in message
        and "supabase_rag_fallback_to_memory=true" in message
        for message in messages
    )


def test_hosted_rag_startup_does_not_log_an_armed_fallback(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.supabase_rag as supabase_rag_module

    class OfflineStore:
        def list_documents(self) -> list[object]:
            raise SupabaseRagUnavailable("offline")

    monkeypatch.setattr(supabase_rag_module, "SupabaseRagStore", lambda _: OfflineStore())
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="render-beta",
        supabase_db_url="postgresql://service.test/healthcare",
    )

    # A strict deployment never claims an armed fallback, so operators reading
    # this line can tell a permissive config from a configured-memory backend.
    with pytest.raises(SupabaseRagUnavailable), caplog.at_level(
        logging.WARNING, logger="uvicorn.error.healthcare.ai.rag"
    ):
        build_rag_service(settings)

    assert "rag_fallback" not in caplog.text


def test_patient_chat_remote_provider_is_disabled_by_default() -> None:
    assert Settings().ai_patient_chat_remote_enabled is False


def test_public_hospital_support_remote_provider_is_disabled_by_default() -> None:
    assert Settings().ai_public_hospital_support_remote_enabled is False


def test_production_rejects_remote_patient_chat_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_SERVICE_RUNTIME", "production")
    monkeypatch.setenv("AI_PATIENT_CHAT_REMOTE_ENABLED", "true")
    monkeypatch.setenv("AI_CHAT_REMOTE_PROVIDER_ENABLED", "true")

    with pytest.raises(ValueError, match="Remote patient chat is disabled in production"):
        Settings()


def test_remote_patient_chat_is_hold_outside_production_too(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("AI_PATIENT_CHAT_REMOTE_ENABLED", "true")
    monkeypatch.setenv("AI_CHAT_REMOTE_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("AI_SERVICE_RUNTIME", "staging")
    monkeypatch.setenv("REMOTE_AI_KILL_SWITCH", "false")

    with pytest.raises(ValueError, match="HOLD"):
        Settings()


def test_public_hospital_support_remote_configuration_is_allowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("AI_SERVICE_RUNTIME", "staging")

    settings = Settings()

    assert settings.ai_public_hospital_support_remote_enabled is True
    assert settings.ai_provider == "deepseek"


def test_remote_patient_chat_flags_cannot_bypass_release_hold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("AI_PATIENT_CHAT_REMOTE_ENABLED", "true")
    monkeypatch.setenv("AI_CHAT_REMOTE_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("REMOTE_AI_SYNTHETIC_ONLY", "false")
    monkeypatch.setenv("AI_SERVICE_RUNTIME", "synthetic-beta")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("REMOTE_AI_KILL_SWITCH", "false")

    with pytest.raises(ValueError, match="HOLD"):
        Settings()


def test_synthetic_beta_remote_contract_remains_hold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("AI_PATIENT_CHAT_REMOTE_ENABLED", "true")
    monkeypatch.setenv("AI_CHAT_REMOTE_PROVIDER_ENABLED", "true")
    monkeypatch.setenv("AI_SERVICE_RUNTIME", "synthetic-beta")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("RAG_STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://synthetic")
    monkeypatch.setenv("SUPABASE_RAG_FALLBACK_TO_MEMORY", "false")
    monkeypatch.setenv("REMOTE_AI_KILL_SWITCH", "false")

    with pytest.raises(ValueError, match="HOLD"):
        Settings()


def test_remote_patient_chat_kill_switch_is_on_by_default() -> None:
    assert Settings().remote_ai_kill_switch is True


@pytest.mark.parametrize(
    "url",
    [
        "https://user:pass@api.deepseek.com",
        "https://api.deepseek.com?redirect=evil",
        "https://api.deepseek.com#fragment",
        "https://api.deepseek.com:444",
        "https://api.deepseek.com/private",
        "http://api.deepseek.com/v1",
        "https://api.deepseek.com./v1",
    ],
)
def test_remote_base_url_rejects_ambiguous_or_unsafe_forms(url: str) -> None:
    assert remote_base_url_allowed(url, {"api.deepseek.com"}) is False


def test_remote_base_url_accepts_documented_deepseek_base_paths() -> None:
    assert remote_base_url_allowed("https://api.deepseek.com", {"api.deepseek.com"})
    assert remote_base_url_allowed("https://api.deepseek.com/v1", {"api.deepseek.com"})


def test_deepseek_defaults_to_v4_flash_when_no_model_is_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in (
        "AI_PROVIDER",
        "AI_API_KEY",
        "AI_CHAT_MODEL",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("AI_PROVIDER", "deepseek")

    settings = Settings()

    assert settings.ai_chat_model == "deepseek-v4-flash"


def test_legacy_deepseek_values_fill_empty_provider_neutral_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("AI_API_KEY", "")
    monkeypatch.setenv("AI_CHAT_MODEL", "")
    monkeypatch.setenv("AI_EMBEDDING_MODEL", "")
    monkeypatch.setenv("AI_BASE_URL", "")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "legacy-test-key")
    monkeypatch.setenv("DEEPSEEK_MODEL", "legacy-chat")
    monkeypatch.setenv("DEEPSEEK_EMBEDDING_MODEL", "legacy-embedding")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://legacy-provider.test")

    settings = Settings()

    assert settings.ai_api_key == "legacy-test-key"
    assert settings.ai_chat_model == "legacy-chat"
    assert settings.ai_embedding_model == "legacy-embedding"
    assert settings.ai_base_url == "https://legacy-provider.test"


def test_provider_neutral_values_override_legacy_aliases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("AI_API_KEY", "neutral-test-key")
    monkeypatch.setenv("AI_CHAT_MODEL", "neutral-chat")
    monkeypatch.setenv("AI_EMBEDDING_MODEL", "neutral-embedding")
    monkeypatch.setenv("AI_BASE_URL", "https://neutral-provider.test")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "legacy-test-key")
    monkeypatch.setenv("DEEPSEEK_MODEL", "legacy-chat")
    monkeypatch.setenv("DEEPSEEK_EMBEDDING_MODEL", "legacy-embedding")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://legacy-provider.test")

    settings = Settings()

    assert settings.ai_api_key == "neutral-test-key"
    assert settings.ai_chat_model == "neutral-chat"
    assert settings.ai_embedding_model == "neutral-embedding"
    assert settings.ai_base_url == "https://neutral-provider.test"


def test_deepseek_aliases_do_not_populate_openai_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("AI_API_KEY", "")
    monkeypatch.setenv("AI_CHAT_MODEL", "")
    monkeypatch.setenv("AI_EMBEDDING_MODEL", "")
    monkeypatch.setenv("AI_BASE_URL", "")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "legacy-test-key")
    monkeypatch.setenv("DEEPSEEK_MODEL", "legacy-chat")
    monkeypatch.setenv("DEEPSEEK_EMBEDDING_MODEL", "legacy-embedding")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://legacy-provider.test")

    settings = Settings()

    assert settings.ai_api_key == ""
    assert settings.ai_chat_model == ""
    assert settings.ai_embedding_model == ""
    assert settings.ai_base_url == ""
