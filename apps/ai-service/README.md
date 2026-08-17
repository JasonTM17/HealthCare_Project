# AI Service

FastAPI AI/RAG service baseline. Rule-based triage and deterministic local
embeddings work without provider credentials. DeepSeek and remote embeddings
are opt-in and always fall back to the local implementation on provider errors.

## Commands

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pytest
.venv\Scripts\ruff check .
.venv\Scripts\mypy
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

RAG documents are kept in memory and are not a production knowledge store.
Ingestion is disabled by default. To enable trusted ingestion, configure both
`RAG_INGEST_ENABLED=true` and a secret `RAG_INGEST_TOKEN`, then send that token
in the `X-RAG-Ingest-Token` header. Do not expose this endpoint publicly.
