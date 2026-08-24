"""Provider-neutral embeddings with explicit provenance and safe fallback."""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from typing import Any, Iterator, List, Protocol

from app.providers import (
    LOCAL_EMBEDDING_PROVIDERS,
    ProviderUnavailable,
    bounded_timeout_setting,
    provider_secret,
    remote_provider_requested,
    runtime_allows_local_fallback,
    string_setting,
)
from app.llm import patient_chat_remote_enabled
from app.schemas import EMBEDDING_DIMENSION, ProviderProvenance

DIMENSION = EMBEDDING_DIMENSION


@dataclass(frozen=True)
class EmbeddingResult:
    """Vector result that keeps the legacy two-value unpacking contract."""

    vector: List[float]
    model: str
    provenance: ProviderProvenance

    def __iter__(self) -> Iterator[Any]:
        # Existing callers unpack ``embed(...)`` into vector/model.  The
        # additive provenance field is available without breaking that API.
        yield self.vector
        yield self.model


class EmbeddingClient(Protocol):
    """Provider-neutral text embedding contract."""

    def embed(self, text: str) -> EmbeddingResult:
        """Return an embedding vector, model identifier, and provenance."""


def _local_embedding(text: str) -> List[float]:
    """Deterministic, dependency-free embedding for offline/dev use."""

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

    def embed(self, text: str) -> EmbeddingResult:
        return EmbeddingResult(_local_embedding(text), self.model, "local_provider")


@dataclass(frozen=True)
class OpenAIEmbeddingClient:
    """OpenAI-compatible embedding provider with bounded network time."""

    api_key: str
    base_url: str
    model: str
    timeout_seconds: float

    def embed(self, text: str) -> EmbeddingResult:
        from openai import OpenAI

        client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout_seconds,
            max_retries=0,
        )
        # The Supabase projection is pgvector(384).  Explicitly request that
        # width where the OpenAI-compatible provider supports it; accepting a
        # different width would make the vector unusable by the durable index.
        response = client.embeddings.create(
            model=self.model,
            input=text,
            dimensions=EMBEDDING_DIMENSION,
        )
        if not response.data or not response.data[0].embedding:
            raise ValueError("embedding provider returned no vector")
        vector = [float(value) for value in response.data[0].embedding]
        if len(vector) != EMBEDDING_DIMENSION or any(
            not math.isfinite(value) for value in vector
        ):
            raise ValueError("embedding provider returned a vector outside the 384-dimension contract")
        return EmbeddingResult(
            vector,
            self.model,
            "remote_provider",
        )


def build_embedding_client(settings: Any) -> EmbeddingClient:
    """Resolve the configured provider without exposing credentials."""

    provider = string_setting(settings, "embedding_provider", "local").lower()
    api_key = provider_secret(settings, provider)
    if provider not in LOCAL_EMBEDDING_PROVIDERS and api_key:
        model = string_setting(settings, "ai_embedding_model") or "text-embedding-3-small"
        base_url = string_setting(settings, "ai_base_url")
        if provider == "deepseek":
            base_url = base_url or string_setting(
                settings, "deepseek_base_url", "https://api.deepseek.com"
            )
        else:
            base_url = base_url or "https://api.openai.com/v1"
        return OpenAIEmbeddingClient(
            api_key=api_key,
            base_url=base_url,
            model=model,
            timeout_seconds=bounded_timeout_setting(settings),
        )
    return LocalEmbeddingClient()


def embed(text: str, settings: Any, *, synthetic_beta: bool = False) -> EmbeddingResult:
    """Return a result with explicit local/remote provenance.

    A selected remote provider may fall back only in local/demo/test runtime.
    Non-local runtimes fail closed so a local vector is never mislabeled as a
    successful remote result.
    """

    remote_requested = remote_provider_requested(
        settings,
        "embedding_provider",
        LOCAL_EMBEDDING_PROVIDERS,
    )
    allow_fallback = runtime_allows_local_fallback(settings)
    provider = string_setting(settings, "embedding_provider", "local").lower()
    api_key = provider_secret(settings, provider)
    if remote_requested and not api_key:
        if allow_fallback:
            local = LocalEmbeddingClient().embed(text)
            return EmbeddingResult(local.vector, local.model, "local_fallback")
        raise ProviderUnavailable()

    # Embeddings are also provider egress.  The public /embeddings and /rag
    # endpoints must not bypass the synthetic-beta/consent gate used by chat.
    if remote_requested and (not synthetic_beta or not patient_chat_remote_enabled(settings)):
        if allow_fallback:
            local = LocalEmbeddingClient().embed(text)
            return EmbeddingResult(local.vector, local.model, "local_fallback")
        raise ProviderUnavailable()

    client = build_embedding_client(settings)
    try:
        return client.embed(text)
    except Exception:
        if allow_fallback:
            local = LocalEmbeddingClient().embed(text)
            return EmbeddingResult(local.vector, local.model, "local_fallback")
        raise ProviderUnavailable()
