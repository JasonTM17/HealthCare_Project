"""Provider-neutral and legacy environment alias tests."""

import pytest

from app.config import Settings
from app.providers import remote_base_url_allowed


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
