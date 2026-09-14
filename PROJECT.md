# Project: Supabase pgvector Clinical Knowledge Enrichment & Cost-Saving Hybrid RAG Router

## Architecture
- **Supabase pgvector Vector Store**:
  - Table: `healthcare.ai_documents`
  - Columns: `id`, `source_type`, `source_id`, `title`, `content`, `metadata`, `embedding`, `embedding_model`, `embedding_dimension`, `embedding_provenance`, `content_hash`, `sync_revision`, `active`, `published`, `published_at`, `deleted_at`.
  - Constraints: `embedding_dimension = 384`, `content_hash ~ '^[0-9a-f]{64}$'`, `source_type in ('specialty', 'doctor', 'branch', 'service', 'package', 'article', 'faq')`, `UNIQUE (source_type, source_id)`.
  - Search RPC: `healthcare.match_documents(query_embedding, match_threshold, match_count, filter_source_types, query_text)` with hybrid scoring: 75% cosine similarity + 25% full-text ts_rank.
- **AI Service (FastAPI / Python 3.14)**:
  - Modules: `apps/ai-service/app/{main,schemas,chatbot,llm,embeddings,config,providers,supabase_rag,rag}.py`.
  - Embedder: `_local_embedding` in `app/embeddings.py` (deterministic 384-dimensional unit vector from SHA-256 word hashing).
  - Safety Gate: `chat_safety_response` in `app/llm.py` (crisis/115 detection, prescription refusal, PII masking, injection defense).
  - Smart Cost Router:
    - Route 1 (Local Vector RAG - 0đ): `top_score >= similarity_threshold (0.65)` and not multi-symptom complex -> `_local_grounded_response` -> `cost_tier: "local_free"`, `provenance: "local_provider"`.
    - Route 2 (DeepSeek v4 Flash Escalation): `top_score < 0.65` or multi-symptom complex clinical reasoning -> `OpenAIChatClient` -> `cost_tier: "remote_llm"`, `provenance: "remote_provider"`.
- **Backend & BFF (Spring Boot 3.5.4)**:
  - `PublicAiChatController.java` & `AiConversationService.java` pass through `cost_tier` and `routing_reason`.
- **Frontend (Next.js 16.3.3 App Router)**:
  - `types/hospital.ts` supports optional `cost_tier` and `routing_reason`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F1 | Clinical Knowledge Base Dataset | 200+ realistic medical records across 30 specialties, 20 branches, clinical guides (Cardiology, GI, Pulmonology, Endocrine, Pediatrics, Dermatology), and FAQs (BHYT, admission, pricing). | M1 | Survey / ORIGINAL_REQUEST R1 |
| F2 | Ingestion CLI Tool | `supabase/tools/ingest_clinical_knowledge.py` CLI supporting Markdown/JSON ingestion into `healthcare.ai_documents` with 384-dim embeddings and SHA-256 hash. | M1 | Survey / ORIGINAL_REQUEST R1 |
| F3 | Replace Synthetic Placeholders | Replace placeholder documents in `healthcare.ai_documents` with authentic clinical knowledge. | M1 | Survey / ORIGINAL_REQUEST R1 |
| F4 | Local Vector RAG (0đ Cost) | Route queries with similarity >= 0.65 to local internal knowledge with 0 external API calls. | M2 | Survey / ORIGINAL_REQUEST R2 |
| F5 | DeepSeek v4 Flash Escalation | Escalate out-of-KB queries or complex multi-symptom queries to DeepSeek v4 Flash. | M2 | Survey / ORIGINAL_REQUEST R2 |
| F6 | Secure DeepSeek Key Injection | Pass `DEEPSEEK_API_KEY` (`sk-ae8b1857...`) strictly via environment variables, avoiding git leaks. | M2 | Survey / ORIGINAL_REQUEST R2 |
| F7 | Audit Fields in Response Schema | Add `cost_tier: Literal["local_free", "remote_llm"]` and `routing_reason: str | None` to response models. | M2 | Survey / ORIGINAL_REQUEST R2 |
| F8 | Medical Safety Guardrails | Enforce 100% adherence to clinical boundaries: 115 emergency short-circuit, prescription refusal, disclaimer. | M2 | Survey / ORIGINAL_REQUEST R3 |
| F9 | Routing & Cost Test Suite | Dedicated test suite (`apps/ai-service/tests/test_routing_cost_suite.py`) covering all routing & cost dimensions. | M3 | Survey / ORIGINAL_REQUEST R2 & R3 |
| F10 | System Zero-Regression Gate | Maintain 100% pass across all 1,004 baseline tests (AI service 546, FE 319, Infra 69, Supabase 42, Backend 28). | M3 | Survey / ORIGINAL_REQUEST R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Knowledge Base Enrichment & Ingestion CLI | Features F1, F2, F3: Build `supabase/tools/ingest_clinical_knowledge.py`, compile 200+ clinical records (30 specialties, 20 branches, guides, FAQs), verify 384-dim embeddings and SHA-256 hashes. | none | IN_PROGRESS |
| M2 | Cost-Saving Hybrid RAG Router & Schema Audit | Features F4, F5, F6, F7, F8: Implement Smart Router, DeepSeek v4 Flash integration, audit fields (`cost_tier`, `routing_reason`), clinical safety guardrails. | M1 | PLANNED |
| M3 | Routing & Cost Test Suite & System Verification | Features F9, F10: Build comprehensive Routing & Cost test suite, run full 1,004 baseline test suites, verify zero regressions. | M1, M2 | PLANNED |

## Interface Contracts
### `supabase/tools/ingest_clinical_knowledge.py` ↔ `healthcare.ai_documents`
- Input: JSON dataset (`supabase/tools/data/clinical_knowledge.json`) or Markdown directory.
- Embedding Generation: Deterministic 384-dim unit vector matching `apps/ai-service/app/embeddings.py` `_local_embedding`.
- Content Normalization: Strip HTML, collapse whitespace, SHA-256 hash.
- Upsert Target: `INSERT INTO healthcare.ai_documents (...) ON CONFLICT (source_type, source_id) DO UPDATE ...`
- Verification: Exit code 0, documents count >= 200, embedding dimension = 384, content_hash = 64 hex chars.

### `apps/ai-service/app/schemas.py` ↔ Clients (Spring Boot & Frontend)
- `ChatResponse`:
  - `answer: str`
  - `disclaimer: str`
  - `citations: list[Citation]`
  - `provenance: ProviderProvenance` (`"local_provider"` | `"remote_provider"` | `"local_fallback"`)
  - `mode: ChatMode`
  - `safety_action: ChatSafetyAction`
  - `used_sources: list[UsedSource]`
  - `cost_tier: Literal["local_free", "remote_llm"] = "local_free"` (NEW)
  - `routing_reason: str | None = None` (NEW)

### `apps/ai-service/app/chatbot.py` Router Contract
- Routing Decision:
  - If `safety_action in (ChatSafetyAction.EMERGENCY, ChatSafetyAction.REFUSE)`: return immediate safety response, `cost_tier = "local_free"`, `routing_reason = "safety_guardrail_shortcircuit"`.
  - Else if `is_complex_multisymptom_query(message)`: escalate to DeepSeek v4 Flash, `cost_tier = "remote_llm"`, `routing_reason = "complex_multisymptom_clinical_reasoning"`.
  - Else if `top_score >= similarity_threshold (0.65)`: local grounded response from internal KB, `cost_tier = "local_free"`, `routing_reason = "high_similarity_internal_kb"`.
  - Else: escalate to DeepSeek v4 Flash, `cost_tier = "remote_llm"`, `routing_reason = "low_similarity_escalation"`.

## Code Layout
- `supabase/tools/ingest_clinical_knowledge.py`: Clinical knowledge ingestion CLI.
- `supabase/tools/data/clinical_knowledge.json`: 200+ clinical records (specialties, branches, guides, FAQs).
- `apps/ai-service/app/schemas.py`: Response schemas with `cost_tier` and `routing_reason`.
- `apps/ai-service/app/chatbot.py`: Smart Router, multi-symptom detector, local grounded responses.
- `apps/ai-service/app/main.py`: Chat endpoints with routing integration.
- `apps/ai-service/app/llm.py`: Clinical safety short-circuits & DeepSeek client.
- `apps/ai-service/tests/test_routing_cost_suite.py`: Dedicated 6-dimension routing & cost test suite.
- `supabase/tests/`: Supabase vector contract tests.
