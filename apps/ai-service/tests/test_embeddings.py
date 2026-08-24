"""Embedding provider contract and bounded fallback tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest

from app.embeddings import DIMENSION, OpenAIEmbeddingClient, embed
from app.providers import ProviderUnavailable


def test_openai_embedding_client_passes_bounded_timeout() -> None:
    response = MagicMock()
    response.data = [SimpleNamespace(embedding=[0.1] * DIMENSION)]
    with patch("openai.OpenAI") as openai_client:
        openai_client.return_value.embeddings.create.return_value = response
        client = OpenAIEmbeddingClient(
            api_key="test-key",
            base_url="https://provider.test",
            model="test-embedding",
            timeout_seconds=3.5,
        )

        vector, model = client.embed("đau đầu")

    assert vector == [0.1] * DIMENSION
    assert model == "test-embedding"
    openai_client.assert_called_once_with(
        api_key="test-key",
        base_url="https://provider.test",
        timeout=3.5,
        max_retries=0,
    )
    openai_client.return_value.embeddings.create.assert_called_once_with(
        model="test-embedding",
        input="đau đầu",
        dimensions=384,
    )


def test_openai_embedding_rejects_wrong_dimension() -> None:
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

        with pytest.raises(ValueError, match="384-dimension"):
            client.embed("đau đầu")


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


def test_remote_embedding_never_calls_provider_without_remote_egress_gate() -> None:
    settings = SimpleNamespace(
        embedding_provider="deepseek",
        ai_provider="deepseek",
        ai_api_key="test-key",
        ai_embedding_model="test-embedding",
        ai_base_url="https://api.deepseek.com",
        ai_timeout_seconds=3.5,
        ai_service_runtime="staging",
        ai_patient_chat_remote_enabled=True,
        ai_chat_remote_provider_enabled=True,
        remote_ai_synthetic_only=False,
    )
    with patch("openai.OpenAI") as remote_client:
        with pytest.raises(ProviderUnavailable):
            embed("đau đầu", settings)

    remote_client.assert_not_called()


def test_embedding_request_marker_is_required_for_synthetic_remote_provider() -> None:
    settings = SimpleNamespace(
        embedding_provider="deepseek",
        ai_provider="deepseek",
        ai_api_key="test-key",
        ai_embedding_model="test-embedding",
        ai_base_url="https://api.deepseek.com",
        ai_timeout_seconds=3.5,
        ai_service_runtime="synthetic-beta",
        ai_patient_chat_remote_enabled=True,
        ai_chat_remote_provider_enabled=True,
        remote_ai_synthetic_only=True,
        rag_storage_backend="supabase",
        supabase_rag_fallback_to_memory=False,
        remote_ai_provider_allowlist="deepseek",
        remote_ai_https_host_allowlist="api.deepseek.com",
    )
    with patch("openai.OpenAI") as remote_client:
        with pytest.raises(ProviderUnavailable):
            embed("đau đầu", settings)

    remote_client.assert_not_called()


def test_openai_embedding_does_not_use_deepseek_alias_credentials() -> None:
    settings = SimpleNamespace(
        ai_provider="openai",
        embedding_provider="openai",
        ai_api_key="",
        deepseek_api_key="legacy-key",
        ai_embedding_model="",
        deepseek_embedding_model="legacy-embedding",
        ai_base_url="",
        deepseek_base_url="https://api.deepseek.com",
        ai_service_runtime="production",
    )

    with pytest.raises(ProviderUnavailable):
        embed("đau đầu", settings)
