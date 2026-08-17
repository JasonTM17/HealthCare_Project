import secrets
from typing import cast

from fastapi import Depends, FastAPI, Header, HTTPException, Query

from app.config import Settings
from app.embeddings import embed
from app.llm import resolve_triage
from app.rag import RagService
from app.schemas import (
    Citation,
    EmbeddingRequest,
    EmbeddingResponse,
    HealthResponse,
    RAGIndexRequest,
    RAGIndexResponse,
    RAGSearchRequest,
    RAGSearchResponse,
    RAGSearchResult,
    SOURCE_TYPES,
    SemanticSearchResponse,
    SemanticSearchResult,
    SpecialtyRecommendationRequest,
    SpecialtyRecommendationResponse,
    TriageRequest,
    TriageResponse,
)


settings = Settings()
app = FastAPI(title="HealthCare AI Service", version="0.1.0")

# Shared in-memory RAG index for the foundation phase.
rag_service = RagService()


def _configured_secret(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _enforce_input_limit(value: str, *, label: str, setting_name: str) -> str:
    """Apply the deployment limit after the schema's hard upper bound."""

    text = value.strip()
    limit = getattr(settings, setting_name, None)
    if not isinstance(limit, int) or limit < 1:
        limit = 10_000
    if len(text) > limit:
        raise HTTPException(status_code=413, detail=f"{label} exceeds the configured limit")
    return text


def _citation(source_type: str, source_id: str, title: str) -> Citation:
    return Citation(source_type=cast(SOURCE_TYPES, source_type), source_id=source_id, title=title)


def require_service_auth(
    x_ai_service_token: str | None = Header(default=None, alias="X-AI-Service-Token"),
) -> None:
    """Require a token unless an explicit local-only escape hatch is enabled."""

    configured_token = settings.ai_service_token
    if not _configured_secret(configured_token):
        if local_auth_escape_hatch_enabled():
            return
        raise HTTPException(status_code=503, detail="AI service authentication is not configured")
    if not x_ai_service_token or not secrets.compare_digest(x_ai_service_token, configured_token):
        raise HTTPException(status_code=401, detail="AI service authentication required")


def local_auth_escape_hatch_enabled() -> bool:
    return (
        settings.ai_service_runtime.lower() == "local"
        and settings.ai_service_allow_unauthenticated_local
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    api_key_configured = _configured_secret(settings.ai_api_key) or _configured_secret(
        settings.deepseek_api_key
    )
    auth_configured = _configured_secret(settings.ai_service_token)
    return HealthResponse(
        status="ok" if auth_configured or local_auth_escape_hatch_enabled() else "misconfigured",
        service=settings.service_name,
        ai_provider=settings.ai_provider,
        deepseek_configured=api_key_configured,
        deepseek_model=settings.deepseek_model if api_key_configured else None,
        service_auth_configured=auth_configured,
        local_auth_escape_hatch=local_auth_escape_hatch_enabled(),
    )


@app.post("/triage", response_model=TriageResponse, dependencies=[Depends(require_service_auth)])
def symptom_triage(request: TriageRequest) -> TriageResponse:
    symptoms = _enforce_input_limit(
        request.symptoms,
        label="Symptoms",
        setting_name="ai_max_input_chars",
    )
    return resolve_triage(symptoms, settings)


@app.post("/embeddings", response_model=EmbeddingResponse, dependencies=[Depends(require_service_auth)])
def embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    text = _enforce_input_limit(request.text, label="Embedding input", setting_name="ai_max_input_chars")
    vector, model = embed(text, settings)
    return EmbeddingResponse(embedding=vector, model=model)


@app.post("/rag/search", response_model=RAGSearchResponse, dependencies=[Depends(require_service_auth)])
def rag_search(request: RAGSearchRequest) -> RAGSearchResponse:
    query = _enforce_input_limit(request.query, label="RAG query", setting_name="ai_max_input_chars")
    query_embedding, _ = embed(query, settings)
    hits = rag_service.search(query_embedding, top_k=request.top_k)
    return RAGSearchResponse(
        results=[
            RAGSearchResult(
                source_type=cast(SOURCE_TYPES, doc.source_type),
                source_id=doc.source_id,
                title=doc.title,
                content=doc.content,
                score=round(score, 4),
                citation=_citation(doc.source_type, doc.source_id, doc.title),
            )
            for doc, score in hits
        ]
    )


@app.post("/rag/index", response_model=RAGIndexResponse)
def rag_index(
    payload: RAGIndexRequest,
    x_rag_ingest_token: str | None = Header(default=None),
    _service_auth: None = Depends(require_service_auth),
) -> RAGIndexResponse:
    """Ingest trusted knowledge; disabled and token-protected by default."""

    if not settings.rag_ingest_enabled:
        raise HTTPException(status_code=404, detail="RAG ingestion is disabled")
    if not _configured_secret(settings.rag_ingest_token):
        raise HTTPException(status_code=503, detail="RAG ingestion is not configured")
    if not x_rag_ingest_token or not secrets.compare_digest(
        x_rag_ingest_token, settings.rag_ingest_token
    ):
        raise HTTPException(status_code=403, detail="Invalid RAG ingestion token")

    content = _enforce_input_limit(
        payload.content,
        label="RAG document",
        setting_name="rag_max_document_chars",
    )
    embedding, _ = embed(content, settings)
    doc = rag_service.ingest(
        source_type=payload.source_type,
        source_id=payload.source_id,
        title=payload.title,
        content=content,
        embedding=embedding,
    )
    return RAGIndexResponse(id=doc.id, index_size=rag_service.index.size)


@app.post(
    "/recommendations/specialty",
    response_model=SpecialtyRecommendationResponse,
    dependencies=[Depends(require_service_auth)],
)
def specialty_recommendation(request: SpecialtyRecommendationRequest) -> SpecialtyRecommendationResponse:
    symptoms = _enforce_input_limit(
        request.symptoms,
        label="Symptoms",
        setting_name="ai_max_input_chars",
    )
    query_embedding, _ = embed(symptoms, settings)
    hits = rag_service.search(query_embedding, top_k=3)
    if hits:
        # Keep the existing provider contract stable.  Retrieved content is
        # passed as reference context and citations are built from stored
        # identities, never from model-generated URLs or IDs.
        context = [f"{doc.title}: {doc.content}" for doc, _ in hits[:2]]
        response = resolve_triage(symptoms, settings, context=context)
        citations = [
            _citation(doc.source_type, doc.source_id, doc.title) for doc, _ in hits[:2]
        ]
        return SpecialtyRecommendationResponse(
            **response.model_dump(exclude={"citations"}),
            citations=citations,
        )
    return SpecialtyRecommendationResponse(**resolve_triage(symptoms, settings).model_dump())


@app.get("/rag/stats", dependencies=[Depends(require_service_auth)])
def rag_stats() -> dict[str, int]:
    return {"documents": rag_service.index.size}


@app.get("/search", response_model=SemanticSearchResponse)
def semantic_search(
    q: str = Query(default="", max_length=10_000),
    specialty: str = Query(default="", max_length=200),
    top_k: int = Query(default=10, ge=1, le=20),
    _service_auth: None = Depends(require_service_auth),
) -> SemanticSearchResponse:
    """Hybrid semantic search over the RAG index.

    Keyword ``q`` is embedded and matched against indexed documents.  An
    optional ``specialty`` filter narrows results.  Results remain bounded and
    carry only source identities that can be verified by the backend.
    """

    query = _enforce_input_limit(q, label="Search query", setting_name="ai_max_input_chars")
    specialty_filter = specialty.strip()
    if not query and not specialty_filter:
        return SemanticSearchResponse(results=[])
    search_text = query or specialty_filter
    query_embedding, _ = embed(search_text, settings)
    hits = rag_service.search(query_embedding, top_k=top_k * 2)
    results: list[SemanticSearchResult] = []
    for doc, score in hits:
        if specialty_filter and specialty_filter.casefold() not in doc.title.casefold():
            continue
        results.append(
            SemanticSearchResult(
                source_type=cast(SOURCE_TYPES, doc.source_type),
                source_id=doc.source_id,
                title=doc.title,
                content=doc.content,
                score=round(score, 4),
                citation=_citation(doc.source_type, doc.source_id, doc.title),
            )
        )
        if len(results) >= top_k:
            break
    return SemanticSearchResponse(results=results, query=query, specialty=specialty_filter)
