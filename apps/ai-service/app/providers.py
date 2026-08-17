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
    *secret_names: str,
) -> bool:
    if not remote_provider_requested(settings, name, local_values):
        return True
    return bool(secret_setting(settings, *secret_names))


def merge_provenance(*values: ProviderProvenance) -> ProviderProvenance:
    """Make any local fallback visible in a combined AI response."""

    if "local_fallback" in values:
        return "local_fallback"
    if "remote_provider" in values:
        return "remote_provider"
    return "local_provider"
