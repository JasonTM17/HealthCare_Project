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

RAG documents are kept in memory and are not a production knowledge store.
Ingestion is disabled by default. To enable trusted ingestion, configure both
`RAG_INGEST_ENABLED=true` and a secret `RAG_INGEST_TOKEN`, then send that token
in the `X-RAG-Ingest-Token` header. Do not expose this endpoint publicly.

Ingestion accepts `active`, `published`, and optional bounded metadata. Only
documents with both flags enabled are searchable; sending an inactive or
unpublished update removes the previous searchable version. Content is
normalized to visible text, capped by `RAG_MAX_DOCUMENT_CHARS`, and embedded
again only when its normalized content hash changes. Search combines bounded
keyword/vector relevance and returns citations containing the stored source
type, source ID, and title only.

The backend catalog mirror is eventually consistent: it runs on the configured
schedule (five minutes by default) and removes SQL-deleted sources when a
catalog type fits within `ai.rag-ingest.max-catalog-items`. If a type is larger
than that safety bound, the sync keeps existing indexed rows instead of risking
false deletion; this is a documented local-MVP limitation, not a durable
multi-instance knowledge-store guarantee.

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
RAG_MAX_DOCUMENT_CHARS=20000
RAG_MAX_DOCUMENTS=1000

# Legacy aliases, used only for AI_PROVIDER=deepseek when the corresponding
# AI_* value is empty.
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_EMBEDDING_MODEL=
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

The hard request bounds are 10,000 characters for patient/query input and
20,000 characters for knowledge documents. A deployment can lower them with
the settings above. `AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL`, `AI_BASE_URL`, and
`AI_API_KEY` take precedence; the corresponding `DEEPSEEK_*` values are
legacy aliases used only when `AI_PROVIDER=deepseek` and the provider-neutral
value is empty. When `AI_PROVIDER=openai`, DeepSeek credentials and defaults
are ignored; configure the provider-neutral key/model/base URL explicitly.

Embedding vectors are capped at 4,096 dimensions. Indexed documents retain
their embedding model and provenance, reject mixed model/provenance/dimension
contracts, and are bounded by `RAG_MAX_DOCUMENTS` (1,000 by default).

Provider calls use no automatic retries and a bounded timeout. In `local`,
`demo`, or `test` runtime, a remote provider error may return deterministic
output only with `provenance: "local_fallback"`. In every other runtime, a
selected remote provider that is missing or unavailable fails with HTTP 503;
local output is never presented as a successful remote result. `/health`
returns HTTP 503 when authentication or selected-provider readiness is not
valid, including a degraded local fallback mode. No remote liveness probe is
performed: a configured remote provider reports `remote_probe_required: true`
and remains unready until a bounded probe is added. Patient text and secrets
are not logged.

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
