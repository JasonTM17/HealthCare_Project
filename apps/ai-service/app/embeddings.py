"""Embedding provider with a deterministic fallback.

When a DeepSeek/OpenAI key is configured, embeddings come from the remote
provider. Otherwise a deterministic local hash-based embedding is used so the
RAG pipeline works offline for development and tests.
"""

from __future__ import annotations

import hashlib
import math
from typing import Any, List

DIMENSION = 384


def _local_embedding(text: str) -> List[float]:
    """Deterministic, dependency-free embedding for offline/dev use.

    Not semantically meaningful, but stable for a given input so the RAG
    search behaves predictably without a provider.
    """
    vec = [0.0] * DIMENSION
    for i, word in enumerate(text.lower().split()):
        h = hashlib.sha256(f"{i}:{word}".encode("utf-8")).digest()
        for j in range(min(4, DIMENSION)):
            idx = (i * 4 + j) % DIMENSION
            vec[idx] += (h[j] - 128) / 128.0
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def embed(text: str, settings: Any) -> tuple[List[float], str]:
    if settings.deepseek_api_key and getattr(settings, "embedding_provider", "local") != "local":
        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=settings.deepseek_api_key,
                base_url=settings.deepseek_base_url,
            )
            # DeepSeek does not ship an embedding model in the base API by default;
            # fall back to local if the call fails.
            resp = client.embeddings.create(model="text-embedding-3-small", input=text)
            return resp.data[0].embedding, "text-embedding-3-small"
        except Exception:
            pass
    return _local_embedding(text), "local-hash"
