# AI service HealthCare

[AI system](../../docs/ai-system.md) · [Architecture](../../docs/architecture/system-overview.md) · [Security](../../docs/security.md)

FastAPI service cho routing, retrieval, bounded generation và recommendation. Spring là user/business authority; service token bảo vệ hop vào FastAPI, không thay quyền patient/doctor.

## Chạy local và checks

Dùng Python 3.12, tạo environment trong apps/ai-service và cài [requirements.txt](requirements.txt). Trên Windows:

~~~powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m mypy
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000 --no-access-log
~~~

Chọn đúng interpreter 3.12 trước tạo venv. Bare process phải cung cấp runtime/service authentication đúng [config.py](app/config.py); Compose không dùng unauthenticated local escape hatch. [Getting started](../../docs/getting-started.md) giải thích stack đầy đủ.

## Source navigation

| Boundary | Owner |
| --- | --- |
| HTTP routes/auth/health | [main.py](app/main.py) |
| Configuration và runtime gates | [config.py](app/config.py) |
| Chat routing/safety | [chatbot.py](app/chatbot.py), [emergency terms](app/emergency_terms.py) |
| LLM providers và validation | [llm.py](app/llm.py), [providers.py](app/providers.py), [schemas.py](app/schemas.py) |
| Embeddings/retrieval | [embeddings.py](app/embeddings.py), [rag.py](app/rag.py) |
| Durable adapter | [supabase_rag.py](app/supabase_rag.py) |
| Cancellation | [cancellation.py](app/cancellation.py) |
| Public-answer acceleration | [public_chat_acceleration.py](app/public_chat_acceleration.py) |
| Tests/typecheck | [tests](tests), [pyproject.toml](pyproject.toml) |

## Configuration groups

| Nhóm | Khóa chính | Vì sao tách |
| --- | --- | --- |
| Service/runtime | AI_SERVICE_TOKEN, AI_SERVICE_RUNTIME, AI_SERVICE_ALLOW_UNAUTHENTICATED_LOCAL | Local bare process khác Compose/hosted |
| Provider | AI_PROVIDER, AI_API_KEY, AI_CHAT_MODEL, AI_BASE_URL, AI_TIMEOUT_SECONDS | Credential/model selection khác authorization cho patient text |
| Embedding | EMBEDDING_PROVIDER và embedding model/dimension contract | Chat provider không tự có vector contract tương thích |
| Storage | RAG_STORAGE_BACKEND, SUPABASE_DB_URL, schema/table/RPC | Primary business SQL khác protected retrieval projection |
| Ingest | RAG_INGEST_ENABLED, RAG_INGEST_TOKEN | Trusted server indexing, không là public endpoint |
| Policy | Patient/public remote flags, release/runtime/provenance settings | Đọc consumer thật, không suy ra semantics từ tên biến |

[Compose](../../infrastructure/docker-compose.yml) và [Render manifest](../../render-free-beta.yaml) có flags khác nhau. Comment hoặc báo cáo cũ “patient egress luôn HOLD” không sở hữu current behavior; config.py + llm.py + Spring policy và manifest được chọn mới xác định đường được phép. Một YAML flag không chứng minh live provider đã chạy.

## RAG authority và projection

Only active/published sources are searchable under ingestion contract. Source identity, hash/revision và provenance được giữ để Core xác minh; provider-generated URLs/doctor IDs không thành authority.

Memory index phù hợp local/ephemeral use; durable adapter là lựa chọn có điều kiện. Patient-chat protected projection dùng healthcare schema, ai_chat_documents table và match_chat_documents RPC theo adapter contract. Legacy public ai_documents/match_documents là contract khác; không tự thay hai cặp này cho nhau.

[Supabase README](../../supabase/README.md), [reconciliation](../../supabase/reconciliation/README.md) và adapter tests sở hữu durable setup. Catalog sync có bounded reconciliation và lag; không khẳng định một update SQL đã xuất hiện trong retrieval chỉ vì source row được lưu.

## Health, fallback và evidence

livez xác nhận process sống. Authenticated health báo readiness theo cấu hình; không tự chứng minh authenticated provider generation. Fallback memory/local chỉ được dùng khi runtime/policy cho phép; hosted durable/provider outage phải giữ fail-closed khi contract yêu cầu.

Public support, patient history, clinical review, source eligibility, quota và cancellation là các boundary riêng. [AI system](../../docs/ai-system.md) mô tả chúng và liên kết Core owners. JSON/SSE delivery không tự chứng minh provider-token streaming.

Không ghi access logs có query/patient text, DSN, tokens hoặc raw provider errors vào repo. Tests/mock adapters không phải live-provider evidence. [Testing](../../docs/testing.md) giải thích gate đúng môi trường.
