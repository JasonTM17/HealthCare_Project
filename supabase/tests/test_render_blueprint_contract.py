"""Static safety contract for the canonical synthetic Render Free blueprint.

This deliberately does not claim that Render accepted or deployed the file;
the live Dashboard/CLI validation remains an external gate.
"""

from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]


def _service(blueprint: dict, name: str) -> dict:
    return next(item for item in blueprint["services"] if item["name"] == name)


def test_render_free_blueprint_keeps_private_runtime_boundaries() -> None:
    blueprint = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    named_copy = yaml.safe_load(
        (ROOT / "render-free-beta.yaml").read_text(encoding="utf-8")
    )
    assert named_copy == blueprint

    database = blueprint["databases"][0]
    assert database["postgresMajorVersion"] == "16"
    assert database["region"] == "singapore"
    assert database["user"] == "healthcare_beta_app_20260830r1"
    assert database["ipAllowList"] == []

    redis = _service(blueprint, "healthcare-beta-redis")
    assert redis["type"] == "keyvalue"
    assert redis["plan"] == "free"
    assert redis["ipAllowList"] == []

    backend = _service(blueprint, "healthcare-beta-backend")
    assert backend["plan"] == "free"
    assert backend["runtime"] == "image"
    env_vars = {item["key"]: item for item in backend["envVars"]}
    assert env_vars["REDIS_URL"]["fromService"]["property"] == "connectionString"
    assert env_vars["REDIS_URL"]["fromService"]["type"] == "keyvalue"
    assert "REDIS_HOST" not in env_vars
    assert "REDIS_PORT" not in env_vars
    assert env_vars["STORAGE_UPLOAD_ENABLED"]["value"] == "false"
    assert env_vars["STORAGE_REQUIRE_PRIVATE_ENDPOINT"]["value"] == "false"
    assert env_vars["STORAGE_AV_REQUIRED"]["value"] == "false"
    assert env_vars["MANAGEMENT_HEALTH_MAIL_ENABLED"]["value"] == "false"
    assert env_vars["RAG_STORAGE_BACKEND"]["value"] == "memory"
    assert env_vars["AI_RAG_INGEST_ENABLED"]["value"] == "true"
    assert env_vars["AI_SERVICE_URL"]["value"] == "https://healthcare-beta-ai.onrender.com"
    assert env_vars["AI_SERVICE_TOKEN"]["fromService"] == {
        "type": "web", "name": "healthcare-beta-ai", "envVarKey": "AI_SERVICE_TOKEN"
    }
    assert env_vars["AI_RAG_INGEST_TOKEN"]["fromService"] == {
        "type": "web", "name": "healthcare-beta-ai", "envVarKey": "RAG_INGEST_TOKEN"
    }
    ai = _service(blueprint, "healthcare-beta-ai")
    ai_env = {item["key"]: item for item in ai["envVars"]}
    assert ai["runtime"] == "python"
    assert ai["plan"] == "free"
    assert ai["healthCheckPath"] == "/livez"
    # ADR-004 (docs/adr/ADR-004-synthetic-ai-egress.md, decision D-05): the
    # synthetic-beta blueprint MAY select the DeepSeek remote provider for
    # non-sensitive synthetic/guest content only; "local" is the deterministic
    # fail-closed alternative. Any other provider value is out of policy.
    assert ai_env["AI_PROVIDER"]["value"] in {"deepseek", "local"}
    # Documented fail-closed posture (ADR-004): embeddings stay local, the
    # remote kill switch stays armed, patient-chat and patient-LLM egress stay
    # disabled, and the synthetic-only gate stays on. The whole-blueprint
    # equality asserted above keeps render-free-beta.yaml in agreement.
    assert ai_env["EMBEDDING_PROVIDER"]["value"] == "local"
    assert ai_env["REMOTE_AI_KILL_SWITCH"]["value"] == "true"
    assert ai_env["AI_PATIENT_CHAT_REMOTE_ENABLED"]["value"] == "false"
    assert ai_env["AI_CHAT_REMOTE_PROVIDER_ENABLED"]["value"] == "false"
    assert ai_env["REMOTE_AI_SYNTHETIC_ONLY"]["value"] == "true"
    assert ai_env["RAG_INGEST_ENABLED"]["value"] == "true"
    assert ai_env["AI_SERVICE_TOKEN"]["generateValue"] is True
    assert ai_env["RAG_INGEST_TOKEN"]["generateValue"] is True
    assert "STORAGE_AV_SERVICE_URL" not in env_vars
    assert "STORAGE_AV_SERVICE_TOKEN" not in env_vars
    assert "SUPABASE_DB_URL" not in env_vars
    assert not any(key.startswith("NEXT_PUBLIC_") for key in env_vars)
