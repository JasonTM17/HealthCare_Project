from fastapi import FastAPI
from pydantic_settings import BaseSettings
from app.schemas import (
    EmbeddingRequest, EmbeddingResponse,
    HealthResponse, RAGSearchRequest, RAGSearchResponse, RAGSearchResult,
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
    # DeepSeek LLM credentials
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"


settings = Settings()
app = FastAPI(title="HealthCare AI Service", version="0.1.0")

# Shared in-memory RAG index for the foundation phase.
rag_service = RagService()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        ai_provider=settings.ai_provider,
        deepseek_configured=bool(settings.deepseek_api_key),
        deepseek_model=settings.deepseek_model if settings.deepseek_api_key else None,
    )


@app.post("/triage", response_model=TriageResponse)
def symptom_triage(request: TriageRequest) -> TriageResponse:
    return resolve_triage(request.symptoms, settings)


@app.post("/embeddings", response_model=EmbeddingResponse)
def embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    vector, model = embed(request.text, settings)
    return EmbeddingResponse(embedding=vector, model=model)


@app.post("/rag/search", response_model=RAGSearchResponse)
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


@app.post("/rag/index")
def rag_index(payload: dict) -> dict:
    """Ingest a document into the RAG index. Body: source_type, source_id, title, content."""
    embedding, _ = embed(payload.get("content", ""), settings)
    doc = rag_service.ingest(
        source_type=payload.get("source_type", "unknown"),
        source_id=payload.get("source_id", ""),
        title=payload.get("title", ""),
        content=payload.get("content", ""),
        embedding=embedding,
    )
    return {"id": doc.id, "index_size": rag_service.index.size}


@app.post("/recommendations/specialty", response_model=TriageResponse)
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


@app.get("/rag/stats")
def rag_stats() -> dict:
    return {"documents": rag_service.index.size}
