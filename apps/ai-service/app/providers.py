"""Shared provider policy, provenance, and safe failure contracts."""

from __future__ import annotations

from typing import Any

from app.schemas import ProviderProvenance


class ProviderUnavailable(RuntimeError):
    """Raised when a selected remote provider cannot produce a safe result."""


LOCAL_FALLBACK_RUNTIMES = frozenset({"local", "demo", "test"})
LOCAL_CHAT_PROVIDERS = frozenset({"", "local", "rule_based_triage"})
REMOTE_CHAT_PROVIDERS = frozenset({"deepseek", "openai"})
LOCAL_EMBEDDING_PROVIDERS = frozenset({"", "local", "hash"})


def string_setting(settings: Any, name: str, default: str = "") -> str:
    value = getattr(settings, name, None)
    return value.strip() if isinstance(value, str) else default


def float_setting(settings: Any, name: str, default: float) -> float:
    value = getattr(settings, name, default)
    return value if isinstance(value, (int, float)) and value > 0 else default


def secret_setting(settings: Any, *names: str) -> str:
    for name in names:
        value = string_setting(settings, name)
        if value.strip():
            return value
    return ""


def provider_secret(settings: Any, provider: str) -> str:
    """Resolve credentials without crossing the DeepSeek provider boundary."""

    normalized_provider = provider.strip().casefold()
    if normalized_provider == "deepseek":
        if string_setting(settings, "ai_provider").casefold() != "deepseek":
            return ""
        return secret_setting(settings, "ai_api_key", "deepseek_api_key")
    return secret_setting(settings, "ai_api_key")


def runtime_allows_local_fallback(settings: Any) -> bool:
    runtime = string_setting(settings, "ai_service_runtime", "non-local").casefold()
    return runtime in LOCAL_FALLBACK_RUNTIMES


def remote_provider_requested(settings: Any, name: str, local_values: frozenset[str]) -> bool:
    provider = string_setting(settings, name).casefold()
    return provider not in local_values


def provider_configured(
    settings: Any,
    name: str,
    local_values: frozenset[str],
) -> bool:
    provider = string_setting(settings, name).casefold()
    if provider in local_values:
        return True
    if not provider_secret(settings, provider):
        return False
    if name == "ai_provider":
        model = string_setting(settings, "ai_chat_model")
        if provider == "deepseek":
            model = model or string_setting(settings, "deepseek_model")
        return bool(model)
    return True


def merge_provenance(*values: ProviderProvenance) -> ProviderProvenance:
    """Make any local fallback visible in a combined AI response."""

    if "local_fallback" in values:
        return "local_fallback"
    if "remote_provider" in values:
        return "remote_provider"
    return "local_provider"
