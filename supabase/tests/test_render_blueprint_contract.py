"""Static safety contract for the synthetic Render blueprint.

This deliberately does not claim that Render accepted or deployed the file;
the live Dashboard/CLI validation remains an external gate.
"""

from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]


def _service(blueprint: dict, name: str) -> dict:
    return next(item for item in blueprint["services"] if item["name"] == name)


def test_render_beta_blueprint_keeps_private_runtime_boundaries() -> None:
    blueprint = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))

    database = blueprint["databases"][0]
    assert database["postgresMajorVersion"] == "16"
    assert database["region"] == "singapore"
    assert database["ipAllowList"] == []

    redis = _service(blueprint, "healthcare-beta-redis")
    assert redis["type"] == "keyvalue"
    assert redis["plan"] == "free"
    assert redis["ipAllowList"] == []

    backend = _service(blueprint, "healthcare-beta-backend")
    env_vars = {item["key"]: item for item in backend["envVars"]}
    assert env_vars["REDIS_URL"]["fromService"]["property"] == "connectionString"
    assert env_vars["REDIS_URL"]["fromService"]["type"] == "keyvalue"
    assert "REDIS_HOST" not in env_vars
    assert "REDIS_PORT" not in env_vars
    assert env_vars["STORAGE_UPLOAD_ENABLED"]["value"] == "false"
    assert env_vars["STORAGE_REQUIRE_PRIVATE_ENDPOINT"]["value"] == "true"
    assert env_vars["STORAGE_AV_REQUIRED"]["value"] == "true"

    ai = _service(blueprint, "healthcare-beta-ai")
    assert "healthCheckPath" not in ai
    ai_env = {item["key"]: item for item in ai["envVars"]}
    assert ai_env["REMOTE_AI_KILL_SWITCH"]["value"] == "true"
    assert ai_env["SUPABASE_RAG_FALLBACK_TO_MEMORY"]["value"] == "false"
