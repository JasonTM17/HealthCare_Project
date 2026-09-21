from fastapi.testclient import TestClient
import pytest
from unittest.mock import patch
from uuid import UUID

from app.main import app, rag_service, settings
from app.rag import RagDocument
from app.supabase_rag import PersistentRagService, SupabaseRagUnavailable

client = TestClient(app)

# Every key the pre-change /health contract published. The Spring consumer
# reads this payload as a generic Map, so removing or renaming one of these is
# a breaking change; adding one is not.
BASELINE_HEALTH_KEYS = frozenset(
    {
        "status",
        "service",
        "ai_provider",
        "deepseek_configured",
        "deepseek_model",
        "service_auth_configured",
        "local_auth_escape_hatch",
        "ready",
        "provider_configured",
        "fallback_allowed",
        "remote_probe_required",
        "rag_ready",
        "rag_backend",
        "rag_fallback_active",
    }
)


def _operational_document() -> RagDocument:
    return RagDocument(
        id="branch:hcm",
        source_type="branch",
        source_id="hcm",
        title="Chi nhanh",
        content="Kham tai co so.",
        embedding=[0.25] * 384,
        embedding_model="provided",
        embedding_provenance="local_provider",
        metadata={"projection_kind": "OPERATIONAL", "eligibility_revision": "1"},
    )


def _never_answering_service(*, fallback_to_memory: bool) -> PersistentRagService:
    """A durable-backed service that never saw Supabase answer."""

    class OfflineStore:
        def list_documents(self) -> list[RagDocument]:
            raise SupabaseRagUnavailable("offline")

    return PersistentRagService(
        OfflineStore(),  # type: ignore[arg-type]
        fallback_to_memory=fallback_to_memory,
    )


def _failed_over_service(*, fallback_to_memory: bool) -> PersistentRagService:
    """A durable-backed service whose authority answered, then went away."""

    class OutageStore:
        def list_documents(self) -> list[RagDocument]:
            return [_operational_document()]

        def active_profile(self) -> tuple[str, str] | None:
            return ("provided", "local_provider")

        def search(self, *_: object, **__: object) -> list[tuple[RagDocument, float]]:
            raise SupabaseRagUnavailable("offline")

    service = PersistentRagService(
        OutageStore(),  # type: ignore[arg-type]
        fallback_to_memory=fallback_to_memory,
    )
    with pytest.raises(SupabaseRagUnavailable):
        service.search([0.25] * 384)
    return service


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "service" in response.json()
    assert "ai_provider" in response.json()
    assert response.json()["rag_ready"] is True


def test_request_trace_echoes_a_canonical_uuid() -> None:
    expected = "123e4567-e89b-42d3-a456-426614174000"

    response = client.get("/health", headers={"X-Request-ID": expected.upper()})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == expected


def test_request_trace_replaces_an_untrusted_value() -> None:
    response = client.get("/health", headers={"X-Request-ID": "not-a-safe-trace"})

    assert response.status_code == 200
    request_id = response.headers["X-Request-ID"]
    assert UUID(request_id).version == 4
    assert request_id != "not-a-safe-trace"


def test_readyz_fails_closed_when_rag_probe_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "local")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", True)
    monkeypatch.setattr(rag_service, "health_probe", lambda: False)

    response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["ready"] is False
    assert response.json()["rag_ready"] is False


def test_health_misconfiguration_is_not_http_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", False)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["detail"] == "AI service authentication is not configured"


def test_health_rejects_missing_or_mismatched_configured_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "expected-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")

    missing = client.get("/health")
    mismatched = client.get(
        "/health",
        headers={"X-AI-Service-Token": "wrong-token"},
    )

    assert missing.status_code == 401
    assert mismatched.status_code == 401


def test_health_accepts_configured_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "expected-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")

    response = client.get(
        "/health",
        headers={"X-AI-Service-Token": "expected-token"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_remote_provider_without_credentials_is_unready_outside_local_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "deepseek_api_key", "")

    response = client.get("/health", headers={"X-AI-Service-Token": "service-token"})

    assert response.status_code == 503
    assert response.json()["provider_configured"] is False


def test_configured_remote_provider_is_fail_closed_without_a_liveness_probe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")

    with patch("openai.OpenAI") as remote_client:
        response = client.get(
            "/health",
            headers={"X-AI-Service-Token": "service-token"},
        )

    assert response.status_code == 503
    assert response.json()["provider_configured"] is True
    assert response.json()["remote_probe_required"] is True
    assert response.json()["ready"] is False
    remote_client.assert_not_called()


def test_public_hospital_support_remote_configuration_is_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_public_hospital_support_remote_enabled", True)

    response = client.get(
        "/health",
        headers={"X-AI-Service-Token": "service-token"},
    )

    assert response.status_code == 200
    assert response.json()["provider_configured"] is True
    assert response.json()["remote_probe_required"] is False
    assert response.json()["ready"] is True


def test_unknown_chat_provider_is_unready_even_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "service-token")
    monkeypatch.setattr(settings, "ai_service_runtime", "staging")
    monkeypatch.setattr(settings, "ai_provider", "unsupported-provider")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")

    response = client.get("/health", headers={"X-AI-Service-Token": "service-token"})

    assert response.status_code == 503
    assert response.json()["provider_configured"] is False


def test_local_runtime_reports_degraded_remote_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_service_token", "")
    monkeypatch.setattr(settings, "ai_service_runtime", "local")
    monkeypatch.setattr(settings, "ai_service_allow_unauthenticated_local", True)
    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "deepseek_api_key", "")

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["fallback_allowed"] is True


def test_health_payload_remains_backward_compatible() -> None:
    payload = client.get("/health").json()

    # Additive-only change guard for the Spring Map consumer.
    assert BASELINE_HEALTH_KEYS <= set(payload)


def test_health_reports_no_rag_degradation_for_a_memory_deployment() -> None:
    # The test runtime configures RAG_STORAGE_BACKEND=memory, which is the
    # chosen backend rather than a degradation of a configured one.
    payload = client.get("/health").json()

    assert payload["ready"] is True
    assert payload["rag_backend"] == "memory"
    assert payload["rag_fallback_active"] is False
    assert payload["rag_fallback_permitted"] is False
    assert payload["rag_fail_closed"] is False


def test_health_marks_rag_fallback_active_only_while_memory_is_serving(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.main.rag_service",
        _never_answering_service(fallback_to_memory=True),
    )

    response = client.get("/health")
    payload = response.json()

    assert response.status_code == 200
    assert payload["rag_backend"] == "supabase"
    assert payload["rag_fallback_permitted"] is True
    # Nothing durable ever answered, so this really is fallback traffic.
    assert payload["rag_fallback_active"] is True
    assert payload["rag_fail_closed"] is False


def test_health_marks_rag_fail_closed_without_claiming_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.main.rag_service",
        _failed_over_service(fallback_to_memory=True),
    )

    response = client.get("/health")
    payload = response.json()

    # Durable authority was observed and then lost, so retrieval fails closed.
    # The old predicate reported this as fallback traffic and the Java caller
    # logged "serving from the in-memory fallback" while nothing was.
    assert response.status_code == 503
    assert payload["rag_backend"] == "supabase"
    assert payload["rag_ready"] is False
    assert payload["rag_fallback_active"] is False
    assert payload["rag_fail_closed"] is True
    assert payload["rag_fallback_permitted"] is True


def test_health_reports_fail_closed_for_a_strict_deployment_outage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.main.rag_service",
        _failed_over_service(fallback_to_memory=False),
    )

    payload = client.get("/health").json()

    assert payload["rag_fallback_permitted"] is False
    assert payload["rag_fallback_active"] is False
    assert payload["rag_fail_closed"] is True
