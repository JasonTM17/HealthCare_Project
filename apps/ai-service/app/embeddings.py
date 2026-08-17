"""Provider-neutral embeddings with a deterministic local implementation."""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from typing import Any, List, Protocol

DIMENSION = 384


class EmbeddingClient(Protocol):
    """Provider-neutral text embedding contract."""

    def embed(self, text: str) -> tuple[List[float], str]:
        """Return an embedding vector and its model identifier."""


def _string_setting(settings: Any, name: str, default: str = "") -> str:
    value = getattr(settings, name, None)
    return value if isinstance(value, str) else default


def _float_setting(settings: Any, name: str, default: float) -> float:
    value = getattr(settings, name, default)
    return value if isinstance(value, (int, float)) and value > 0 else default


def _local_embedding(text: str) -> List[float]:
    """Deterministic, dependency-free embedding for offline/dev use.

    It is intentionally documented as a fallback, not a production semantic
    model.  Stable vectors make local RAG tests and demos reproducible.
    """

    vec = [0.0] * DIMENSION
    for i, word in enumerate(text.casefold().split()):
        hashed = hashlib.sha256(f"{i}:{word}".encode("utf-8")).digest()
        for j in range(min(4, DIMENSION)):
            index = (i * 4 + j) % DIMENSION
            vec[index] += (hashed[j] - 128) / 128.0
    norm = math.sqrt(sum(value * value for value in vec)) or 1.0
    return [value / norm for value in vec]


@dataclass(frozen=True)
class LocalEmbeddingClient:
    model: str = "local-hash"

    def embed(self, text: str) -> tuple[List[float], str]:
        return _local_embedding(text), self.model


@dataclass(frozen=True)
class OpenAIEmbeddingClient:
    """OpenAI-compatible embedding provider with bounded network time."""

    api_key: str
    base_url: str
    model: str
    timeout_seconds: float

    def embed(self, text: str) -> tuple[List[float], str]:
        from openai import OpenAI

        client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout_seconds,
            max_retries=0,
        )
        response = client.embeddings.create(model=self.model, input=text)
        if not response.data or not response.data[0].embedding:
            raise ValueError("embedding provider returned no vector")
        return [float(value) for value in response.data[0].embedding], self.model


def build_embedding_client(settings: Any) -> EmbeddingClient:
    """Resolve the configured provider, defaulting to the local fallback."""

    provider = _string_setting(settings, "embedding_provider", "local").lower()
    api_key = _string_setting(settings, "ai_api_key") or _string_setting(
        settings, "deepseek_api_key"
    )
    if provider not in {"local", "hash"} and api_key:
        model = _string_setting(settings, "ai_embedding_model", "text-embedding-3-small")
        base_url = _string_setting(settings, "ai_base_url") or _string_setting(
            settings, "deepseek_base_url", "https://api.deepseek.com"
        )
        return OpenAIEmbeddingClient(
            api_key=api_key,
            base_url=base_url,
            model=model,
            timeout_seconds=_float_setting(settings, "ai_timeout_seconds", 10.0),
        )
    return LocalEmbeddingClient()


def embed(text: str, settings: Any) -> tuple[List[float], str]:
    """Return a provider vector, falling back without exposing input text."""

    client = build_embedding_client(settings)
    try:
        return client.embed(text)
    except Exception:
        # Provider outages must not break local indexing or reveal patient text
        # through logs.  The local vector is deterministic and bounded.
        return LocalEmbeddingClient().embed(text)
