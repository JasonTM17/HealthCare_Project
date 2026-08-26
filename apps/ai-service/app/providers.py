"""Shared provider policy, provenance, and safe failure contracts."""

from __future__ import annotations

import math
from typing import Any
from urllib.parse import urlparse

from app.schemas import ProviderProvenance


class ProviderUnavailable(RuntimeError):
    """Raised when a selected remote provider cannot produce a safe result."""


LOCAL_FALLBACK_RUNTIMES = frozenset({"local", "demo", "test"})
LOCAL_CHAT_PROVIDERS = frozenset({"", "local", "rule_based_triage"})
REMOTE_CHAT_PROVIDERS = frozenset({"deepseek", "openai"})
LOCAL_EMBEDDING_PROVIDERS = frozenset({"", "local", "hash"})
DEFAULT_DEEPSEEK_CHAT_MODEL = "deepseek-v4-flash"
DEFAULT_PROVIDER_TIMEOUT_SECONDS = 10.0
MAX_PROVIDER_TIMEOUT_SECONDS = 60.0


def remote_base_url_allowed(raw_url: str, allowed_hosts: set[str] | frozenset[str]) -> bool:
    """Validate a provider base URL before any network client is created."""

    if not isinstance(raw_url, str) or not raw_url.strip():
        return False
    value = raw_url.strip()
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in value):
        return False
    if "\\" in value:
        return False
    try:
        parsed = urlparse(value)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return False
    hosts = {host.strip().casefold() for host in allowed_hosts if host.strip()}
    if parsed.scheme.casefold() != "https" or not hostname:
        return False
    if hostname.casefold() not in hosts:
        return False
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        return False
    if port not in (None, 443):
        return False
    if parsed.path not in {"", "/", "/v1", "/v1/"}:
        return False
    return True


def string_setting(settings: Any, name: str, default: str = "") -> str:
    value = getattr(settings, name, None)
    return value.strip() if isinstance(value, str) else default


def float_setting(settings: Any, name: str, default: float) -> float:
    value = getattr(settings, name, default)
    return value if isinstance(value, (int, float)) and value > 0 else default


def bounded_timeout_setting(
    settings: Any,
    name: str = "ai_timeout_seconds",
    default: float = DEFAULT_PROVIDER_TIMEOUT_SECONDS,
) -> float:
    """Read a provider timeout while enforcing a finite network-time bound."""

    value = getattr(settings, name, default)
    if isinstance(value, bool):
        return default
    try:
        timeout = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(timeout) or timeout <= 0:
        return default
    return min(timeout, MAX_PROVIDER_TIMEOUT_SECONDS)


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
            model = model or string_setting(settings, "deepseek_model") or DEFAULT_DEEPSEEK_CHAT_MODEL
        return bool(model)
    return True


def merge_provenance(*values: ProviderProvenance) -> ProviderProvenance:
    """Make any local fallback visible in a combined AI response."""

    if "local_fallback" in values:
        return "local_fallback"
    if "remote_provider" in values:
        return "remote_provider"
    return "local_provider"
