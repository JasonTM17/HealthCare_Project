#!/usr/bin/env bash
# Rebuild ONLY backend/ai-service/frontend in the isolated audit stack,
# reusing the secrets and non-secret overrides resolved in the RUNNING
# containers. Nothing secret is printed or persisted.
set -euo pipefail
cd /d/HealthCare_Project
p=healthcare-local-audit
be=$p-backend-1; ai=$p-ai-service-1; fe=$p-frontend-1

for c in "$be" "$ai" "$fe" "$p-postgres-1" "$p-minio-1"; do
  label="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c")"
  if [ "$label" != "$p" ]; then echo "LABEL_MISMATCH:$c"; exit 1; fi
done

be_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$be")"
ai_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$ai")"
fe_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$fe")"

getv() { printf '%s\n' "$2" | sed -n "s|^$1=\(.*\)\$|\1|p" | head -n1; }
req() {
  local name="$1" val="$2"
  if [ -z "$val" ]; then echo "MISSING_ENV:$name"; exit 1; fi
  export "$name=$val"
}

# ── secrets ──────────────────────────────────────────────────────────────
req POSTGRES_USER                       "$(getv DATABASE_USERNAME "$be_env")"
req POSTGRES_PASSWORD                   "$(getv DATABASE_PASSWORD "$be_env")"
req JWT_SECRET                          "$(getv JWT_SECRET "$be_env")"
req BACKEND_BFF_SERVICE_TOKEN           "$(getv BACKEND_BFF_SERVICE_TOKEN "$be_env")"
req AI_SERVICE_TOKEN                    "$(getv AI_SERVICE_TOKEN "$be_env")"
req APP_MAIL_OUTBOX_ENCRYPTION_KEY      "$(getv APP_MAIL_OUTBOX_ENCRYPTION_KEY "$be_env")"
req STORAGE_AV_SERVICE_TOKEN            "$(getv STORAGE_AV_SERVICE_TOKEN "$be_env")"
req STORAGE_CONSULTATION_KEY_SIGNING_SECRET "$(getv STORAGE_CONSULTATION_KEY_SIGNING_SECRET "$be_env")"
req MINIO_ROOT_USER                     "$(getv MINIO_ACCESS_KEY "$be_env")"
req MINIO_ROOT_PASSWORD                 "$(getv MINIO_SECRET_KEY "$be_env")"

be_rag="$(getv AI_RAG_INGEST_TOKEN "$be_env")"
ai_rag="$(getv RAG_INGEST_TOKEN "$ai_env")"
if [ "$be_rag" != "$ai_rag" ]; then echo "RAG_TOKEN_MISMATCH"; exit 1; fi
req RAG_INGEST_TOKEN "$be_rag"
# frontend's resolved token must match backend's
if [ "$(getv BACKEND_BFF_SERVICE_TOKEN "$fe_env")" != "$BACKEND_BFF_SERVICE_TOKEN" ]; then
  echo "BFF_TOKEN_MISMATCH"; exit 1
fi

opt() {
  local name="$1" val="$2"
  if [ -n "$val" ]; then export "$name=$val"; fi
}

# ── non-secret, recovered resolved values ────────────────────────────────
req POSTGRES_DB "$(getv DATABASE_URL "$be_env" | sed 's|.*/||')"
for kv in \
  "STORAGE_BUCKET:STORAGE_BUCKET" "STORAGE_REGION:STORAGE_REGION" \
  "STORAGE_PUBLIC_ENDPOINT:STORAGE_PUBLIC_ENDPOINT" \
  "STORAGE_CONSULTATION_ENABLED:STORAGE_CONSULTATION_ENABLED" \
  "STORAGE_UPLOAD_ENABLED:STORAGE_UPLOAD_ENABLED" \
  "STORAGE_REQUIRE_PRIVATE_ENDPOINT:STORAGE_REQUIRE_PRIVATE_ENDPOINT" \
  "BFF_ALLOWED_ORIGINS:BFF_ALLOWED_ORIGINS" \
  "CORS_ALLOWED_ORIGINS:CORS_ALLOWED_ORIGINS" \
  "APP_BOOKING_ALLOW_TEST_OTP:APP_BOOKING_ALLOW_TEST_OTP" \
  "RAG_INGEST_ENABLED:AI_RAG_INGEST_ENABLED" \
  "AI_CHAT_SYMPTOM_TRIAGE_ENABLED:AI_CHAT_SYMPTOM_TRIAGE_ENABLED" \
  "AI_CHAT_HEALTH_EDUCATION_ENABLED:AI_CHAT_HEALTH_EDUCATION_ENABLED" \
  "AI_CHAT_CHUNKED_ENABLED:AI_CHAT_CHUNKED_ENABLED" \
  "AI_CHAT_REMOTE_PROVIDER_ENABLED:AI_CHAT_REMOTE_PROVIDER_ENABLED" \
  "AI_CHAT_SYNTHETIC_BETA_ASSERTED:AI_CHAT_SYNTHETIC_BETA_ASSERTED" \
  "BACKEND_LOG_LEVEL:LOGGING_LEVEL_COM_HEALTHCARE_AI" \
  ; do
  opt "${kv%%:*}" "$(getv "${kv##*:}" "$be_env")"
done

for kv in \
  "AI_PROVIDER:AI_PROVIDER" "AI_CHAT_MODEL:AI_CHAT_MODEL" \
  "AI_EMBEDDING_MODEL:AI_EMBEDDING_MODEL" "AI_BASE_URL:AI_BASE_URL" \
  "DEEPSEEK_MODEL:DEEPSEEK_MODEL" "DEEPSEEK_EMBEDDING_MODEL:DEEPSEEK_EMBEDDING_MODEL" \
  "DEEPSEEK_BASE_URL:DEEPSEEK_BASE_URL" "EMBEDDING_PROVIDER:EMBEDDING_PROVIDER" \
  "AI_PUBLIC_RETRIEVAL_CANDIDATES:AI_PUBLIC_RETRIEVAL_CANDIDATES" \
  "AI_PUBLIC_CHAT_CACHE_ENABLED:AI_PUBLIC_CHAT_CACHE_ENABLED" \
  "RAG_MAX_DOCUMENTS:RAG_MAX_DOCUMENTS" "RAG_STORAGE_BACKEND:RAG_STORAGE_BACKEND" \
  "SUPABASE_DB_SCHEMA:SUPABASE_DB_SCHEMA" "SUPABASE_RAG_TABLE:SUPABASE_RAG_TABLE" \
  "SUPABASE_RAG_RPC:SUPABASE_RAG_RPC" \
  "SUPABASE_DB_CONNECT_TIMEOUT_SECONDS:SUPABASE_DB_CONNECT_TIMEOUT_SECONDS" \
  "SUPABASE_RAG_FALLBACK_TO_MEMORY:SUPABASE_RAG_FALLBACK_TO_MEMORY" \
  "RAG_EMBEDDING_DIMENSION:RAG_EMBEDDING_DIMENSION" \
  "AI_PATIENT_CHAT_REMOTE_ENABLED:AI_PATIENT_CHAT_REMOTE_ENABLED" \
  "AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED:AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED" \
  "REMOTE_AI_RELEASE_HOLD:REMOTE_AI_RELEASE_HOLD" \
  "REMOTE_AI_SYNTHETIC_ONLY:REMOTE_AI_SYNTHETIC_ONLY" \
  "REMOTE_AI_KILL_SWITCH:REMOTE_AI_KILL_SWITCH" \
  "REMOTE_AI_PROVIDER_ALLOWLIST:REMOTE_AI_PROVIDER_ALLOWLIST" \
  "REMOTE_AI_HTTPS_HOST_ALLOWLIST:REMOTE_AI_HTTPS_HOST_ALLOWLIST" \
  "AI_CHAT_CIRCUIT_FAILURE_THRESHOLD:AI_CHAT_CIRCUIT_FAILURE_THRESHOLD" \
  "AI_CHAT_CIRCUIT_RESET_SECONDS:AI_CHAT_CIRCUIT_RESET_SECONDS" \
  "AI_SERVICE_RUNTIME:AI_SERVICE_RUNTIME" \
  ; do
  val="$(getv "${kv##*:}" "$ai_env")"
  [ -n "$val" ] && export "${kv%%:*}=$val" || true
done
# keys that must remain EMPTY even when recovered value is empty
export AI_API_KEY="" DEEPSEEK_API_KEY="" SUPABASE_DB_URL=""

req BFF_PUBLIC_ORIGIN "$(getv BFF_PUBLIC_ORIGIN "$fe_env")"

# ── fixed ports / identity from recorded audit context ──────────────────
export FRONTEND_HOST_PORT=3330 BACKEND_HOST_PORT=8180 AI_SERVICE_HOST_PORT=8100
export POSTGRES_HOST_PORT=5540 REDIS_HOST_PORT=6390
export MINIO_API_HOST_PORT=9010 MINIO_CONSOLE_HOST_PORT=9011
export MAILPIT_SMTP_HOST_PORT=1125 MAILPIT_UI_HOST_PORT=8125
export NEXT_PUBLIC_SITE_URL="http://localhost:3330"
export BUILD_VCS_REF=HEAD

DC="docker compose --env-file .env.example -p $p -f infrastructure/docker-compose.yml -f reports/local-audit.compose.yaml"

$DC config --quiet
echo "CONFIG_OK"
$DC build backend ai-service frontend
$DC up -d --no-deps backend ai-service frontend
echo "UP_DONE"
