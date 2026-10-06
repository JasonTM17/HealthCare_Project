"""Provider-neutral and legacy environment alias tests."""

import asyncio
import contextlib
import logging
from collections.abc import Sequence

import pytest

from app import llm as llm_module
from app.config import Settings
from app.llm import patient_chat_remote_enabled, resolve_chat
from app.providers import remote_base_url_allowed
from app.rag import RagService
from app.supabase_rag import PersistentRagService, SupabaseRagUnavailable, build_rag_service


def test_rag_memory_fallback_default_stays_permissive_for_local_runtimes() -> None:
    # Decision: the default stays True. Flipping it would turn the offline
    # local/demo loop into a hard startup failure, and it cannot harden a hosted
    # deployment because build_rag_service() already ANDs this flag with a local
    # runtime name. The permissive default is instead made visible at startup.
    assert Settings().supabase_rag_fallback_to_memory is True


@pytest.mark.parametrize("runtime", ["render", "render-beta", "non-local", "production"])
def test_rag_memory_fallback_cannot_arm_a_hosted_runtime(runtime: str) -> None:
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime=runtime,
        supabase_db_url="",
    )

    # No DSN plus a non-local runtime must refuse to start rather than silently
    # serve the in-memory index, regardless of the permissive default.
    with pytest.raises(SupabaseRagUnavailable, match="requires SUPABASE_DB_URL"):
        build_rag_service(settings)


def test_armed_local_rag_memory_fallback_warns_at_startup(
    caplog: pytest.LogCaptureFixture,
) -> None:
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="local",
        supabase_db_url="",
    )

    with caplog.at_level(logging.WARNING, logger="uvicorn.error.healthcare.ai.rag"):
        service = build_rag_service(settings)

    assert isinstance(service, RagService)
    assert not isinstance(service, PersistentRagService)
    assert service.fallback_active is True
    # The degraded default is loud: the warning names the state and the reason.
    messages = [record.getMessage() for record in caplog.records]
    assert any("rag_fallback" in message and "state=armed_no_durable_authority" in message for message in messages)
    assert any("reason=missing_supabase_db_url" in message for message in messages)


def test_armed_durable_rag_fallback_warns_at_startup(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.supabase_rag as supabase_rag_module

    class OfflineStore:
        def list_documents(self) -> list[object]:
            raise SupabaseRagUnavailable("offline")

    monkeypatch.setattr(supabase_rag_module, "SupabaseRagStore", lambda _: OfflineStore())
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="local",
        supabase_db_url="postgresql://service.test/healthcare",
    )

    with caplog.at_level(logging.WARNING, logger="uvicorn.error.healthcare.ai.rag"):
        service = build_rag_service(settings)

    assert isinstance(service, PersistentRagService)
    assert service.fallback_permitted is True
    messages = [record.getMessage() for record in caplog.records]
    assert any(
        "rag_fallback" in message
        and "state=armed" in message
        and "supabase_rag_fallback_to_memory=true" in message
        for message in messages
    )


def test_hosted_rag_startup_does_not_log_an_armed_fallback(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.supabase_rag as supabase_rag_module

    class OfflineStore:
        def list_documents(self) -> list[object]:
            raise SupabaseRagUnavailable("offline")

    monkeypatch.setattr(supabase_rag_module, "SupabaseRagStore", lambda _: OfflineStore())
    settings = Settings(
        rag_storage_backend="supabase",
        ai_service_runtime="render-beta",
        supabase_db_url="postgresql://service.test/healthcare",
    )

    # A strict deployment never claims an armed fallback, so operators reading
    # this line can tell a permissive config from a configured-memory backend.
    with pytest.raises(SupabaseRagUnavailable), caplog.at_level(
        logging.WARNING, logger="uvicorn.error.healthcare.ai.rag"
    ):
        build_rag_service(settings)

    assert "rag_fallback" not in caplog.text


def test_patient_chat_remote_provider_is_disabled_by_default() -> None:
    assert Settings().ai_patient_chat_remote_enabled is False


# ---------------------------------------------------------------------------
# Statement timeout — connect_timeout only bounds the handshake; SQL execution
# on the Supavisor pooler needs its own per-connection guard.
# ---------------------------------------------------------------------------


def test_supabase_db_statement_timeout_defaults_to_five_seconds() -> None:
    assert Settings().supabase_db_statement_timeout_ms == 5_000


def test_supabase_db_statement_timeout_reads_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPABASE_DB_STATEMENT_TIMEOUT_MS", "8000")
    assert Settings().supabase_db_statement_timeout_ms == 8_000


@pytest.mark.parametrize("value", ["499", "30001"])
def test_supabase_db_statement_timeout_rejects_out_of_bounds(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("SUPABASE_DB_STATEMENT_TIMEOUT_MS", value)
    with pytest.raises(ValueError):
        Settings()


# ---------------------------------------------------------------------------
# LLM_MAX_CONCURRENCY — env-tunable fail-fast capacity cap, clamped 1..64.
# The 503 LLM_CAPACITY_EXHAUSTED semantics themselves are pinned elsewhere.
# ---------------------------------------------------------------------------


def test_llm_max_concurrency_defaults_to_eight() -> None:
    assert Settings().llm_max_concurrency == 8


def test_llm_max_concurrency_reads_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MAX_CONCURRENCY", "24")
    assert Settings().llm_max_concurrency == 24


@pytest.mark.parametrize(
    ("raw", "clamped"),
    [("0", 1), ("-3", 1), ("1", 1), ("64", 64), ("1000", 64)],
)
def test_llm_max_concurrency_clamps_to_sane_bounds(
    monkeypatch: pytest.MonkeyPatch, raw: str, clamped: int
) -> None:
    monkeypatch.setenv("LLM_MAX_CONCURRENCY", raw)
    assert Settings().llm_max_concurrency == clamped


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


def test_deepseek_defaults_to_v4_1_flash_when_no_model_is_configured(
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

    assert settings.ai_chat_model == "deepseek-flash"


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


# ---------------------------------------------------------------------------
# L2 lock — patient-chat remote gate matrix (blueprint four-key flip).
#
# The reported production symptom was INSUFFICIENT_EVIDENCE on the authed
# patient path while public /chat answered from the remote provider. The code
# truth (app/llm.py:975-985, :2623-2631; app/config.py:155-177) is that the
# patient path opens only through an ATOMIC set of blueprint keys; flipping
# AI_CHAT_REMOTE_PROVIDER_ENABLED alone was the misdiagnosis — it changes the
# Spring-layer symptom, not the ai-service gate. These tests pin the semantics
# the render.yaml fix relies on, in both directions: the CURRENT blueprint env
# (closed → remote_disabled_fallback, the red side) and the NEW four-key env
# (open → real provider provenance, the green side). No live provider call:
# resolve_chat receives a stub client.
# ---------------------------------------------------------------------------

_BLUEPRINT_BASE_ENV = {
    # Values copied from the render.yaml healthcare-beta-ai envVars block.
    # Deliberately NO API key entry: Settings defaults ai_api_key to "", the
    # validators here never require it (provider boot is checked elsewhere),
    # and every assertion below stubs the provider client — no socket is
    # opened, so a literal key would only be scanner noise.
    "AI_PROVIDER": "deepseek",
    "AI_CHAT_MODEL": "deepseek-flash",
    "AI_BASE_URL": "https://api.deepseek.com",
    "EMBEDDING_PROVIDER": "local",
    "AI_SERVICE_RUNTIME": "render-beta",
    "AI_SERVICE_ALLOW_UNAUTHENTICATED_LOCAL": "false",
    "AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED": "true",
    "REMOTE_AI_KILL_SWITCH": "true",
}


def _blueprint_env(
    monkeypatch: pytest.MonkeyPatch,
    *,
    patient: bool,
    provider: bool,
    synthetic_only: bool,
    release_hold: bool | None,
) -> None:
    for key, value in _BLUEPRINT_BASE_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("AI_PATIENT_CHAT_REMOTE_ENABLED", str(patient).lower())
    monkeypatch.setenv("AI_CHAT_REMOTE_PROVIDER_ENABLED", str(provider).lower())
    monkeypatch.setenv("REMOTE_AI_SYNTHETIC_ONLY", str(synthetic_only).lower())
    if release_hold is None:
        # The old blueprint never sets the hold key (config.py:61 default False).
        monkeypatch.delenv("REMOTE_AI_RELEASE_HOLD", raising=False)
    else:
        monkeypatch.setenv("REMOTE_AI_RELEASE_HOLD", str(release_hold).lower())


class _StubProviderClient:
    """LLMClient double: records calls, returns a safe sentence, never opens a socket."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        context: Sequence[str] = (),
        max_tokens: int | None = None,
    ) -> dict[str, str]:
        del system_prompt, context, max_tokens
        self.calls.append(user_prompt)
        return {"answer": "Mình khuyên bạn nghỉ ngơi và uống đủ nước."}


def test_current_blueprint_env_keeps_patient_chat_on_local_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Red side: the OLD blueprint (patient=false, provider=false,
    # synthetic-only=true, no release hold) must keep answering locally —
    # this is what production ran on when the ticket was filed.
    _blueprint_env(
        monkeypatch,
        patient=False,
        provider=False,
        synthetic_only=True,
        release_hold=None,
    )
    settings = Settings()

    assert patient_chat_remote_enabled(settings) is False

    stub = _StubProviderClient()
    result = resolve_chat(
        "Uống nước chanh mỗi sáng có tốt không?",
        settings,
        client=stub,
    )
    assert result.routing_reason == "remote_disabled_fallback"
    assert result.provenance == "local_fallback"
    assert result.cost_tier == "local_free"
    assert stub.calls == []


def test_new_blueprint_env_opens_patient_remote_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Green side: the fixed blueprint flips exactly the four keys (render.yaml
    # item 3). Settings must boot (config.py:173-176 validator) and the patient
    # path must reach the provider with real remote provenance.
    _blueprint_env(
        monkeypatch,
        patient=True,
        provider=True,
        synthetic_only=False,
        release_hold=True,
    )
    settings = Settings()

    assert settings.ai_patient_chat_remote_enabled is True
    assert settings.remote_ai_release_hold is True
    assert settings.remote_ai_synthetic_only is False
    assert settings.ai_chat_remote_provider_enabled is True
    assert patient_chat_remote_enabled(settings) is True

    # Deterministic circuit state: the module-level breaker is process-global.
    llm_module._record_provider_success()
    stub = _StubProviderClient()
    result = resolve_chat(
        "Uống nước chanh mỗi sáng có tốt không?",
        settings,
        client=stub,
    )
    assert result.routing_reason != "remote_disabled_fallback"
    assert result.provenance == "remote_provider"
    assert result.routing_reason == "remote_llm_escalation"
    assert result.cost_tier == "remote_llm"
    assert len(stub.calls) == 1


def test_partial_flip_without_synthetic_only_keeps_patient_path_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Atomicity guard: with hold+patient opened but REMOTE_AI_SYNTHETIC_ONLY
    # left true (the reported "flip only layer 3" mistake), the synthetic
    # blocker at llm.py:2623 must STILL answer remote_disabled_fallback and
    # the provider must not be reached.
    _blueprint_env(
        monkeypatch,
        patient=True,
        provider=True,
        synthetic_only=True,
        release_hold=True,
    )
    settings = Settings()

    assert patient_chat_remote_enabled(settings) is True

    stub = _StubProviderClient()
    result = resolve_chat(
        "Uống nước chanh mỗi sáng có tốt không?",
        settings,
        client=stub,
    )
    assert result.routing_reason == "remote_disabled_fallback"
    assert stub.calls == []


# ---------------------------------------------------------------------------
# L1 lock — cross-instance keep-warm (ai-service -> backend).
#
# The warmer hook lives in app/main.py:97-148 and self-disables without
# BACKEND_WARM_URL. These tests pin the two properties the cold-start fix
# claims: warm traffic is exactly ONE GET to the configured health URL and
# never a /chat POST (so keep-warm cannot consume provider quota), and an
# empty URL starts no loop at all. httpx is mocked — no network.
# ---------------------------------------------------------------------------


def _install_fake_httpx(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    calls: list[tuple[str, str]] = []

    class _Response:
        def __init__(self, status_code: int) -> None:
            self.status_code = status_code

    class _FakeAsyncClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            del args, kwargs

        async def __aenter__(self) -> "_FakeAsyncClient":
            return self

        async def __aexit__(self, *exc_info: object) -> bool:
            return False

        async def get(self, url: str, **kwargs: object) -> _Response:
            del kwargs
            calls.append(("GET", str(url)))
            return _Response(200)

        async def post(self, url: str, **kwargs: object) -> _Response:
            calls.append(("POST", str(url)))
            raise AssertionError("backend keep-warm must never POST")

    monkeypatch.setattr("httpx.AsyncClient", _FakeAsyncClient)
    return calls


def _clear_warm_task_state(main_module: object) -> None:
    # Starlette State raises KeyError (not AttributeError) for missing keys.
    with contextlib.suppress(AttributeError, KeyError):
        del main_module.app.state.backend_warm_task  # type: ignore[attr-defined]


def test_backend_cross_warmer_pings_warm_url_once_and_never_chat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.main as main_module

    calls = _install_fake_httpx(monkeypatch)
    _clear_warm_task_state(main_module)
    monkeypatch.setattr(
        main_module,
        "settings",
        Settings(backend_warm_url="https://warm.test/actuator/health"),
    )

    async def _drive() -> None:
        await main_module.start_backend_cross_warmer()
        task = getattr(main_module.app.state, "backend_warm_task", None)
        assert task is not None, "warmer must start when backend_warm_url is configured"
        try:
            for _ in range(200):
                await asyncio.sleep(0.01)
                if calls:
                    break
            # Space for a hypothetical second ping or a provider POST to show.
            await asyncio.sleep(0.1)
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    asyncio.run(_drive())

    # Exactly one GET to the configured URL — and nothing else. /chat (the
    # quota-bearing provider surface) is provably absent from warm traffic.
    assert calls == [("GET", "https://warm.test/actuator/health")]
    assert not any("/chat" in url for _, url in calls)
    assert main_module.app.state.backend_warm_last_error is None
    _clear_warm_task_state(main_module)


def test_backend_cross_warmer_stays_disabled_without_backend_warm_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.main as main_module

    calls = _install_fake_httpx(monkeypatch)
    _clear_warm_task_state(main_module)
    monkeypatch.setattr(main_module, "settings", Settings(backend_warm_url=""))

    async def _drive() -> None:
        await main_module.start_backend_cross_warmer()
        await asyncio.sleep(0.1)

    asyncio.run(_drive())

    assert calls == []
    assert getattr(main_module.app.state, "backend_warm_task", None) is None
