"""Embedding provider contract and bounded fallback tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest

from app.embeddings import OpenAIEmbeddingClient, embed
from app.providers import ProviderUnavailable


def test_openai_embedding_client_passes_bounded_timeout() -> None:
    response = MagicMock()
    response.data = [SimpleNamespace(embedding=[0.1, 0.2])]
    with patch("openai.OpenAI") as openai_client:
        openai_client.return_value.embeddings.create.return_value = response
        client = OpenAIEmbeddingClient(
            api_key="test-key",
            base_url="https://provider.test",
            model="test-embedding",
            timeout_seconds=3.5,
        )

        vector, model = client.embed("đau đầu")

    assert vector == [0.1, 0.2]
    assert model == "test-embedding"
    openai_client.assert_called_once_with(
        api_key="test-key",
        base_url="https://provider.test",
        timeout=3.5,
        max_retries=0,
    )


def test_provider_error_falls_back_to_local_embedding() -> None:
    settings = SimpleNamespace(
        embedding_provider="remote",
        ai_api_key="test-key",
        ai_embedding_model="test-embedding",
        ai_base_url="https://provider.test",
        ai_timeout_seconds=3.5,
        ai_service_runtime="local",
    )
    with patch("openai.OpenAI", side_effect=RuntimeError("provider down")):
        vector, model = embed("đau đầu", settings)

    assert len(vector) == 384
    assert model == "local-hash"


def test_remote_embedding_failure_fails_closed_outside_local_runtime() -> None:
    settings = SimpleNamespace(
        embedding_provider="remote",
        ai_api_key="test-key",
        ai_embedding_model="test-embedding",
        ai_base_url="https://provider.test",
        ai_timeout_seconds=3.5,
        ai_service_runtime="production",
    )
    with patch("openai.OpenAI", side_effect=RuntimeError("provider down")):
        with pytest.raises(ProviderUnavailable):
            embed("đau đầu", settings)
