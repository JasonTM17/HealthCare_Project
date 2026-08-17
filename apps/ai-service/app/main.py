import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic_settings import BaseSettings
from app.schemas import (
    EmbeddingRequest, EmbeddingResponse,
    HealthResponse, RAGIndexRequest, RAGIndexResponse, RAGSearchRequest,
    RAGSearchResponse, RAGSearchResult,
    SemanticSearchResponse, SemanticSearchResult,
    SpecialtyRecommendationRequest,
    TriageRequest, TriageResponse,
)
from app.llm import resolve_triage
from app.rag import RagService
from app.embeddings import embed


class Settings(BaseSettings):
    service_name: str = "healthcare-ai-service"
    ai_provider: str = "rule_based_triage"
    embedding_provider: str = "local"
    rag_ingest_enabled: bool = False
    rag_ingest_token: str = ""
    ai_service_token: str = ""
    ai_service_runtime: str = "non-local"
    ai_service_allow_unauthenticated_local: bool = False
    # DeepSeek LLM credentials
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"


settings = Settings()
app = FastAPI(title="HealthCare AI Service", version="0.1.0")

# Shared in-memory RAG index for the foundation phase.
rag_service = RagService()


def require_service_auth(
    x_ai_service_token: str | None = Header(default=None, alias="X-AI-Service-Token"),
) -> None:
    """Require a token unless an explicit local-only escape hatch is enabled."""
    if not settings.ai_service_token:
        if local_auth_escape_hatch_enabled():
            return
        raise HTTPException(status_code=503, detail="AI service authentication is not configured")
    if not x_ai_service_token or not secrets.compare_digest(x_ai_service_token, settings.ai_service_token):
        raise HTTPException(status_code=401, detail="AI service authentication required")


def local_auth_escape_hatch_enabled() -> bool:
    return settings.ai_service_runtime.lower() == "local" and settings.ai_service_allow_unauthenticated_local


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    auth_configured = bool(settings.ai_service_token)
    return HealthResponse(
        status="ok" if auth_configured or local_auth_escape_hatch_enabled() else "misconfigured",
        service=settings.service_name,
        ai_provider=settings.ai_provider,
        deepseek_configured=bool(settings.deepseek_api_key),
        deepseek_model=settings.deepseek_model if settings.deepseek_api_key else None,
        service_auth_configured=auth_configured,
        local_auth_escape_hatch=local_auth_escape_hatch_enabled(),
    )


@app.post("/triage", response_model=TriageResponse, dependencies=[Depends(require_service_auth)])
def symptom_triage(request: TriageRequest) -> TriageResponse:
    return resolve_triage(request.symptoms, settings)


@app.post("/embeddings", response_model=EmbeddingResponse, dependencies=[Depends(require_service_auth)])
def embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    vector, model = embed(request.text, settings)
    return EmbeddingResponse(embedding=vector, model=model)


@app.post("/rag/search", response_model=RAGSearchResponse, dependencies=[Depends(require_service_auth)])
def rag_search(request: RAGSearchRequest) -> RAGSearchResponse:
    query_embedding, _ = embed(request.query, settings)
    hits = rag_service.search(query_embedding, top_k=request.top_k)
    return RAGSearchResponse(results=[
        RAGSearchResult(
            source_type=doc.source_type,
            source_id=doc.source_id,
            title=doc.title,
            content=doc.content,
            score=round(score, 4),
        )
        for doc, score in hits
    ])


@app.post("/rag/index", response_model=RAGIndexResponse)
def rag_index(
    payload: RAGIndexRequest,
    x_rag_ingest_token: str | None = Header(default=None),
    _service_auth: None = Depends(require_service_auth),
) -> RAGIndexResponse:
    """Ingest trusted knowledge; disabled and token-protected by default."""
    if not settings.rag_ingest_enabled:
        raise HTTPException(status_code=404, detail="RAG ingestion is disabled")
    if not settings.rag_ingest_token:
        raise HTTPException(status_code=503, detail="RAG ingestion is not configured")
    if not x_rag_ingest_token or not secrets.compare_digest(
        x_rag_ingest_token, settings.rag_ingest_token
    ):
        raise HTTPException(status_code=403, detail="Invalid RAG ingestion token")

    embedding, _ = embed(payload.content, settings)
    doc = rag_service.ingest(
        source_type=payload.source_type,
        source_id=payload.source_id,
        title=payload.title,
        content=payload.content,
        embedding=embedding,
    )
    return RAGIndexResponse(id=doc.id, index_size=rag_service.index.size)


@app.post(
    "/recommendations/specialty",
    response_model=TriageResponse,
    dependencies=[Depends(require_service_auth)],
)
def specialty_recommendation(request: SpecialtyRecommendationRequest) -> TriageResponse:
    """Specialty recommendation grounded in the RAG index when documents exist."""
    query_embedding, _ = embed(request.symptoms, settings)
    hits = rag_service.search(query_embedding, top_k=3)
    if hits:
        # Ground the triage in the most relevant indexed specialty content.
        context = " ".join(f"{doc.title}: {doc.content}" for doc, _ in hits[:2])
        grounded = f"{request.symptoms}\n\nKiến thức tham khảo: {context}"
        return resolve_triage(grounded, settings)
    return resolve_triage(request.symptoms, settings)


@app.get("/rag/stats", dependencies=[Depends(require_service_auth)])
def rag_stats() -> dict:
    return {"documents": rag_service.index.size}


@app.get("/search", response_model=SemanticSearchResponse)
def semantic_search(
    q: str = Query(default="", max_length=10_000),
    specialty: str = Query(default="", max_length=200),
    top_k: int = Query(default=10, ge=1, le=20),
    _service_auth: None = Depends(require_service_auth),
) -> SemanticSearchResponse:
    """Hybrid semantic search over the RAG index.

    Keyword ``q`` is embedded and matched against indexed documents. An
    optional ``specialty`` filter narrows results. Returns the top_k hits
    with source metadata for rendering search results.
    """
    if not q and not specialty:
        return SemanticSearchResponse(results=[])
    query_embedding, _ = embed(q or specialty, settings)
    hits = rag_service.search(query_embedding, top_k=top_k * 2)
    results: list[SemanticSearchResult] = []
    for doc, score in hits:
        if specialty and specialty.lower() not in doc.title.lower():
            continue
        results.append(SemanticSearchResult(
            source_type=doc.source_type,
            source_id=doc.source_id,
            title=doc.title,
            content=doc.content,
            score=round(score, 4),
        ))
        if len(results) >= top_k:
            break
    return SemanticSearchResponse(results=results, query=q, specialty=specialty)
