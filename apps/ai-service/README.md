# AI Service

FastAPI AI/RAG service foundation. Rule-based triage and deterministic local
embeddings work without provider credentials. OpenAI-compatible chat and
embedding providers are opt-in; only local/demo/test runtimes may use a
deterministic fallback after a remote-provider error.

The provider-neutral contracts are `LLMClient`, `EmbeddingClient`,
`Retriever`, and `RagServiceContract`. Remote responses are accepted only
when they match the strict allow-listed recommendation shape; model-generated
doctor IDs, URLs, schedules, and availability are never trusted.

## Commands

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pytest
.venv\Scripts\ruff check .
.venv\Scripts\mypy
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000 --no-access-log
```

RAG documents default to the in-memory store. A Supabase/Postgres backend can
be enabled explicitly with `RAG_STORAGE_BACKEND=supabase` and `SUPABASE_DB_URL`
when durable persistence is required. Ingestion is disabled by default. To
enable trusted ingestion, configure both `RAG_INGEST_ENABLED=true` and a secret
`RAG_INGEST_TOKEN`, then send that token in the `X-RAG-Ingest-Token` header.
Do not expose this endpoint publicly.

For the patient chatbot, the durable adapter must use the protected projection
contract: `SUPABASE_DB_SCHEMA=healthcare`,
`SUPABASE_RAG_TABLE=ai_chat_documents`, and
`SUPABASE_RAG_RPC=match_chat_documents`. The database role is server-only;
never put its DSN or a `service_role` credential in the frontend. The legacy
`ai_documents`/`match_documents` pair remains for the older public catalog
index and is rejected by the patient-chat adapter.

Ingestion accepts `active`, `published`, and optional bounded metadata. Only
documents with both flags enabled are searchable; sending an inactive or
unpublished update removes the previous searchable version. Content is
normalized to visible text, capped by `RAG_MAX_DOCUMENT_CHARS`, and embedded
again only when its normalized content hash changes. Search combines bounded
keyword/vector relevance and returns citations containing the stored source
type, source ID, and title only.

`POST /chat` accepts `{ "message": "...", "recent_turns": [...], "top_k": 5 }`
and returns `{ "answer": "...", "disclaimer": "...", "citations": [...],
"provenance": "..." }`. Recent turns and retrieved RAG content are bounded
reference context. Citations are assembled from stored `source_type`,
`source_id`, and `title` identities; provider-generated URLs and IDs are not
accepted. Local/test fallback returns a deterministic answer with
`provenance: "local_fallback"` and no citations.

The backend catalog mirror is eventually consistent: it runs on the configured
schedule (five minutes by default) and removes SQL-deleted sources when a
catalog type fits within `ai.rag-ingest.max-catalog-items`. Sync revisions keep
an older in-flight index request from resurrecting a newer delete within the
same AI process. If a type is larger than that safety bound, the sync keeps
existing indexed rows instead of risking false deletion; the revision guard is
also process-local, not a durable multi-instance knowledge-store guarantee.
The durable Supabase backend preserves the same public contract but with
database-backed persistence.

Provider and safety settings are environment-backed:

```text
AI_PROVIDER=rule_based_triage | deepseek | openai
EMBEDDING_PROVIDER=local | <openai-compatible-provider>
AI_API_KEY=
AI_CHAT_MODEL=
AI_EMBEDDING_MODEL=
AI_BASE_URL=
AI_TIMEOUT_SECONDS=10
AI_MAX_INPUT_CHARS=10000
AI_MAX_RETRIEVED_CHUNKS=5
AI_PATIENT_CHAT_REMOTE_ENABLED=false
AI_CHAT_REMOTE_PROVIDER_ENABLED=false
AI_SERVICE_RUNTIME=local
REMOTE_AI_SYNTHETIC_ONLY=true
REMOTE_AI_KILL_SWITCH=false
REMOTE_AI_PROVIDER_ALLOWLIST=deepseek
REMOTE_AI_HTTPS_HOST_ALLOWLIST=api.deepseek.com
AI_CHAT_CIRCUIT_FAILURE_THRESHOLD=3
AI_CHAT_CIRCUIT_RESET_SECONDS=30
RAG_MAX_DOCUMENT_CHARS=20000
RAG_MAX_DOCUMENTS=10000

# Legacy aliases, used only for AI_PROVIDER=deepseek when the corresponding
# AI_* value is empty.
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_EMBEDDING_MODEL=
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

The hard request bounds are 10,000 characters for patient/query input and
20,000 characters for knowledge documents. A deployment can lower them with
the settings above. `AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL`, `AI_BASE_URL`, and
`AI_API_KEY` take precedence; the corresponding `DEEPSEEK_*` values are
legacy aliases used only when `AI_PROVIDER=deepseek` and the provider-neutral
value is empty. When `AI_PROVIDER=deepseek` and no model is supplied, the
default is `deepseek-v4-flash`. When `AI_PROVIDER=openai`, DeepSeek credentials
and defaults are ignored; configure the provider-neutral key/model/base URL
explicitly.

DeepSeek is a chat-generation provider in this contract, not an assumed vector
model. Keep `EMBEDDING_PROVIDER=local` and the deterministic 384-dimensional
`local-hash` profile for local/test and for the initial Supabase projection.
Only switch to a remote embedding provider after its endpoint, dimension,
model provenance, privacy review, and negative-PII tests have been approved.
Remote patient chat requires a synthetic-beta runtime, `AI_PROVIDER=deepseek`,
`AI_PATIENT_CHAT_REMOTE_ENABLED=true`, `RAG_STORAGE_BACKEND=supabase`, and
`SUPABASE_RAG_FALLBACK_TO_MEMORY=false`. The Spring provenance switch
`AI_CHAT_REMOTE_PROVIDER_ENABLED` is a second independent gate. Production
startup rejects the combination and `REMOTE_AI_KILL_SWITCH=true` disables it;
local/test defaults never call DeepSeek. Every generate request in the
synthetic-beta runtime must carry the internal `synthetic_beta=true` assertion.

Embedding vectors are capped at 4,096 dimensions. Indexed documents retain
their embedding model and provenance, reject mixed model/provenance/dimension
contracts, and are bounded by `RAG_MAX_DOCUMENTS` (10,000 by default). The
`/rag/sources` reconciliation endpoint is cursor-paginated and returns
`next_cursor`, `complete`, and `total` metadata on paged requests; callers must
not treat a single 5,000-row page as a complete snapshot.

Provider calls use no automatic retries and a bounded timeout of at most 60
seconds. In `local`,
`demo`, or `test` runtime, a remote provider error may return deterministic
output only with `provenance: "local_fallback"`. In every other runtime, a
selected remote provider that is missing or unavailable fails with HTTP 503;
local output is never presented as a successful remote result. `/health`
returns HTTP 503 when authentication or selected-provider readiness is not
valid, including a degraded local fallback mode. No remote liveness probe is
performed: a configured remote provider reports `remote_probe_required: true`
and remains unready until a bounded probe is added. Patient text and secrets
are not logged.

Patient conversation requests are local-only by default, independently of the
provider chosen for non-patient AI routes. Enabling remote patient chat requires
`AI_PATIENT_CHAT_REMOTE_ENABLED=true` plus an approved provider/privacy contract.
Email addresses, phone numbers, UUID-like identifiers, access tokens and
sensitive clinical markers are rejected before any remote call. A bounded
circuit opens after repeated provider failures. Spring remains the only owner
of conversation history and sends only the six most recent turns.

Protected AI routes require the same non-empty `AI_SERVICE_TOKEN` in the
backend and AI service. The backend forwards it as `X-AI-Service-Token`.
Missing tokens fail closed for Compose, staging, and every non-local runtime.

For a bare local process only, an explicit escape hatch may be enabled with
both `AI_SERVICE_RUNTIME=local` and
`AI_SERVICE_ALLOW_UNAUTHENTICATED_LOCAL=true`. This never applies to Compose:
Compose sets a non-local runtime and refuses to render without a non-empty
`AI_SERVICE_TOKEN`. Tokens are compared in memory and are never logged. The
AI health endpoint also requires this token outside the explicit local escape
hatch; the Compose healthcheck sends it in `X-AI-Service-Token`.

Uvicorn access logging is disabled in the container and in the documented
local command so free-text `/search` values are not emitted in request URLs.
The backend's public search route remains a GET compatibility contract, so
reverse proxies and application access logs must still be configured not to
record query strings. The backend-to-AI search hop uses POST with a bounded
request body.

Specialty recommendations carry a visible disclaimer and citations when
trusted knowledge is available. They do not claim a diagnosis or prescription,
and they do not return doctor or appointment recommendations; those must be
resolved by the authenticated backend against active catalog and schedule
data. This slice models one fictional hospital/public catalog only; it does
not provide tenant isolation or a multi-hospital data model.

Citations are deliberately identity-only (`source_type`, `source_id`, and
`title`) and are not authoritative clinical source URLs. The backend must
resolve or verify any catalog follow-up; a URL or clinical authority cannot be
inferred from an AI response. If a recommendation uses `local_fallback`, its
retrieved citations are suppressed because the indexed context does not support
the fallback result.
