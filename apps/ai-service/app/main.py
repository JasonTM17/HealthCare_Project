import re
import secrets
from datetime import datetime
from typing import cast

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse

from app.config import Settings
from app.chatbot import (
    ChatContractError,
    generate_chat_response,
    retrieve_chat_candidates,
)
from app.embeddings import EmbeddingResult, embed
from app.llm import (
    chat_safety_response,
    contains_sensitive_or_injection,
    patient_chat_remote_enabled,
    resolve_chat,
    resolve_triage,
    triage_requires_local,
)
from app.providers import (
    LOCAL_CHAT_PROVIDERS,
    LOCAL_EMBEDDING_PROVIDERS,
    ProviderUnavailable,
    REMOTE_CHAT_PROVIDERS,
    merge_provenance,
    provider_configured,
    provider_secret,
    remote_provider_requested,
    runtime_allows_local_fallback,
)
from app.rag import CLINICAL_SOURCE_TYPES, EmbeddingContractError, normalize_projection_kind
from app.supabase_rag import (
    SupabaseRagContractError,
    SupabaseRagUnavailable,
    build_rag_service,
)
from app.schemas import (
    Citation,
    ChatRequest,
    ChatResponse,
    ChatGenerateRequest,
    ChatRetrieveRequest,
    ChatRetrieveResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    HealthResponse,
    RAGDeleteRequest,
    RAGDeleteResponse,
    RAGIndexRequest,
    RAGIndexResponse,
    RAGSearchRequest,
    RAGSearchResponse,
    RAGSearchResult,
    RAGSourcesResponse,
    RAGSource,
    ProjectionKind,
    ProviderProvenance,
    SOURCE_TYPES,
    SemanticSearchRequest,
    SemanticSearchResponse,
    SemanticSearchResult,
    SpecialtyRecommendationRequest,
    SpecialtyRecommendationResponse,
    TriageRequest,
    TriageResponse,
)


settings = Settings()
app = FastAPI(title="HealthCare AI Service", version="0.1.0")

# Shared RAG service. Local/test keeps the in-memory implementation by default,
# while explicit Supabase configuration can switch to the durable store.
rag_service = build_rag_service(settings)


# RAG metadata is a service-to-service contract, not an arbitrary text bag.
# Spring's projection workers send these fields as provenance for the source
# that was already authorized in PostgreSQL.  Keep the allow-list closed so a
# future caller cannot smuggle arbitrary text through this boundary while still
# allowing structured clinical provenance (notably ISO timestamps, which the
# generic PII detector intentionally treats as dates).
_RAG_METADATA_KEYS = frozenset(
    {
        "_sync_revision",
        "projection_kind",
        "public_operational",
        "slug",
        "content_revision",
        "eligibility_revision",
        "content_hash",
        "approval_id",
        "approval_state",
        "approval_expires_at",
    }
)
_RAG_OPERATIONAL_METADATA_KEYS = frozenset(
    {"_sync_revision", "projection_kind", "public_operational", "slug"}
)
_RAG_CLINICAL_METADATA_KEYS = frozenset(
    {
        "projection_kind",
        "content_revision",
        "eligibility_revision",
        "content_hash",
        "approval_id",
        "approval_state",
        "approval_expires_at",
    }
)
_RAG_CLINICAL_SOURCE_TYPES = CLINICAL_SOURCE_TYPES
_RAG_REVISION_PATTERN = re.compile(r"^[0-9]{1,19}$")
_RAG_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_RAG_SAFE_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


def _reject_invalid_rag_metadata(payload: RAGIndexRequest) -> None:
    """Validate the closed provenance schema before any embedding operation.

    Clinical provenance values are typed identifiers rather than user-facing
    prose.  Validating each field here lets us skip the generic egress text
    scanner for those fields without weakening the title/content safety gate.
    Unknown keys and cross-projection fields fail closed.
    """

    metadata = payload.metadata
    unknown = set(metadata).difference(_RAG_METADATA_KEYS)
    if unknown:
        raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")

    for key, raw_value in metadata.items():
        if not isinstance(raw_value, str):
            raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        value = raw_value.strip()
        if not value or any(ord(character) < 0x20 for character in value):
            raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")

        if key == "projection_kind":
            if value.upper() not in {"OPERATIONAL", "CLINICAL"}:
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        elif key in {"_sync_revision", "content_revision", "eligibility_revision"}:
            if not _RAG_REVISION_PATTERN.fullmatch(value):
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
            numeric = int(value)
            if numeric < 1:
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        elif key == "content_hash":
            if not _RAG_SHA256_PATTERN.fullmatch(value):
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        elif key == "approval_id":
            if not _RAG_SAFE_TOKEN_PATTERN.fullmatch(value):
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        elif key == "approval_state":
            if value.upper() != "APPROVED":
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        elif key == "approval_expires_at":
            try:
                expiry = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract") from None
            if expiry.tzinfo is None or expiry.utcoffset() is None:
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        elif key == "public_operational":
            if value.casefold() not in {"true", "false"}:
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        elif key == "slug":
            if not _RAG_SAFE_TOKEN_PATTERN.fullmatch(value):
                raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")

    projection = metadata.get("projection_kind")
    normalized_projection = projection.strip().upper() if isinstance(projection, str) else None
    if normalized_projection is None:
        # Legacy operational rows may omit the discriminator, but clinical
        # provenance is never accepted without an explicit projection marker.
        if set(metadata).difference(_RAG_OPERATIONAL_METADATA_KEYS):
            raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        normalized_projection = "OPERATIONAL"

    if normalized_projection == "CLINICAL":
        # Clinical eligibility is owned by the review heads for governed
        # content only.  Operational catalog entities must never be able to
        # masquerade as approved clinical sources at this service boundary.
        if payload.source_type not in _RAG_CLINICAL_SOURCE_TYPES:
            raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        required = _RAG_CLINICAL_METADATA_KEYS.difference({"projection_kind"})
        if not required.issubset(metadata):
            raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
        if set(metadata).difference(_RAG_CLINICAL_METADATA_KEYS):
            raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")
    elif set(metadata).difference(_RAG_OPERATIONAL_METADATA_KEYS):
        raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")

    public_marker = metadata.get("public_operational")
    if isinstance(public_marker, str) and public_marker.casefold() == "true":
        if payload.source_type != "branch" or normalized_projection != "OPERATIONAL":
            raise HTTPException(status_code=422, detail="RAG metadata rejected by contract")


def _metadata_revision(metadata: dict[str, str], key: str) -> int | None:
    raw = metadata.get(key)
    if raw is None and key == "content_revision":
        raw = metadata.get("_sync_revision")
    try:
        value = int(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None
    return value if value is not None and value >= 0 else None


def _metadata_value(metadata: dict[str, str], key: str) -> str | None:
    value = metadata.get(key)
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _embedding_parts(value: object) -> tuple[list[float], str, ProviderProvenance]:
    """Read the additive result while tolerating legacy test doubles."""

    if isinstance(value, EmbeddingResult):
        return value.vector, value.model, value.provenance
    if isinstance(value, tuple) and len(value) == 2:
        vector = cast(list[float], value[0])
        model = cast(str, value[1])
        provenance: ProviderProvenance = (
            "local_provider" if model in {"local", "local-hash"} else "remote_provider"
        )
        return vector, model, provenance
    raise TypeError("invalid embedding result")


@app.exception_handler(ProviderUnavailable)
async def provider_unavailable_handler(request: Request, exc: ProviderUnavailable) -> JSONResponse:
    del request, exc
    return JSONResponse(status_code=503, content={"detail": "AI provider unavailable"})


@app.exception_handler(EmbeddingContractError)
async def embedding_contract_handler(request: Request, exc: EmbeddingContractError) -> JSONResponse:
    del request, exc
    return JSONResponse(status_code=503, content={"detail": "AI embedding contract unavailable"})


@app.exception_handler(ChatContractError)
async def chat_contract_handler(request: Request, exc: ChatContractError) -> JSONResponse:
    """Return stable, content-free errors for the Spring two-step contract."""

    del request
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.code})


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


def _reject_unsafe_egress_text(
    *values: str,
    allow_public_operational: bool = False,
) -> None:
    """Reject unsafe text before any embedding or provider operation.

    This gate is intentionally generic and does not echo the rejected value;
    callers may use it for both local and remote embedding routes because the
    endpoint contract is an egress boundary, not a redaction service.
    """

    if any(
        contains_sensitive_or_injection(
            value,
            allow_public_operational=allow_public_operational,
        )
        for value in values
        if isinstance(value, str)
    ):
        raise HTTPException(status_code=422, detail="Input rejected by safety policy")


def _public_operational_branch(payload: RAGIndexRequest) -> bool:
    """Recognize Spring's closed marker for public branch catalog text."""

    marker = payload.metadata.get("public_operational")
    return (
        payload.source_type == "branch"
        and normalize_projection_kind(payload.metadata) == "OPERATIONAL"
        and isinstance(marker, str)
        and marker.casefold() == "true"
    )


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


def _rag_ready() -> bool:
    """Probe the configured RAG backend without exposing dependency errors."""

    probe = getattr(rag_service, "health_probe", None)
    if not callable(probe):
        return True
    try:
        return bool(probe())
    except Exception:
        # Readiness must fail closed without returning database/provider error
        # text to callers or logs.
        return False


@app.get("/health", response_model=HealthResponse, dependencies=[Depends(require_service_auth)])
def health(response: Response) -> HealthResponse:
    chat_provider = settings.ai_provider.strip().casefold()
    api_key_configured = _configured_secret(provider_secret(settings, chat_provider))
    auth_configured = _configured_secret(settings.ai_service_token)
    provider_ready = (
        chat_provider in LOCAL_CHAT_PROVIDERS | REMOTE_CHAT_PROVIDERS
        and provider_configured(
            settings,
            "ai_provider",
            LOCAL_CHAT_PROVIDERS,
        )
        and provider_configured(
            settings,
            "embedding_provider",
            LOCAL_EMBEDDING_PROVIDERS,
        )
    )
    fallback_allowed = runtime_allows_local_fallback(settings)
    remote_probe_required = remote_provider_requested(
        settings,
        "ai_provider",
        LOCAL_CHAT_PROVIDERS,
    ) or remote_provider_requested(
        settings,
        "embedding_provider",
        LOCAL_EMBEDDING_PROVIDERS,
    )
    auth_ready = auth_configured or local_auth_escape_hatch_enabled()
    rag_ready = _rag_ready()
    ready = auth_ready and provider_ready and not remote_probe_required and rag_ready
    status = "ok" if ready else "degraded" if fallback_allowed and auth_ready else "misconfigured"
    response.status_code = 200 if ready else 503
    return HealthResponse(
        status=status,
        service=settings.service_name,
        ai_provider=settings.ai_provider,
        deepseek_configured=chat_provider == "deepseek" and api_key_configured,
        deepseek_model=(settings.ai_chat_model or settings.deepseek_model)
        if chat_provider == "deepseek" and api_key_configured
        else None,
        service_auth_configured=auth_configured,
        local_auth_escape_hatch=local_auth_escape_hatch_enabled(),
        ready=ready,
        provider_configured=provider_ready,
        fallback_allowed=fallback_allowed,
        remote_probe_required=remote_probe_required,
        rag_ready=rag_ready,
    )


@app.get("/livez")
def livez() -> dict[str, str]:
    """Process liveness probe; it intentionally does not call providers."""

    return {"status": "ok", "service": settings.service_name}


@app.get("/readyz", response_model=HealthResponse)
def readyz(
    response: Response,
    _service_auth: None = Depends(require_service_auth),
) -> HealthResponse:
    """Readiness mirrors `/health` while retaining the service-token boundary."""

    return health(response)


@app.post("/triage", response_model=TriageResponse, dependencies=[Depends(require_service_auth)])
def symptom_triage(request: TriageRequest) -> TriageResponse:
    symptoms = _enforce_input_limit(
        request.symptoms,
        label="Symptoms",
        setting_name="ai_max_input_chars",
    )
    return resolve_triage(symptoms, settings, synthetic_beta=request.synthetic_beta)


@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(require_service_auth)])
def chat(request: ChatRequest) -> ChatResponse:
    message = _enforce_input_limit(
        request.message,
        label="Chat message",
        setting_name="ai_max_input_chars",
    )
    turns = [(turn.role, turn.content) for turn in request.recent_turns]
    safety_response = chat_safety_response(message, turns)
    if safety_response is not None:
        return safety_response

    embedding_provider = settings.embedding_provider.strip().casefold()
    if (
        embedding_provider not in LOCAL_EMBEDDING_PROVIDERS
        and not patient_chat_remote_enabled(settings)
    ):
        return resolve_chat(
            message,
            settings,
            recent_turns=turns,
            synthetic_beta=request.synthetic_beta,
        )

    query_embedding, query_model, embedding_provenance = _embedding_parts(
        embed(message, settings, synthetic_beta=request.synthetic_beta)
    )
    # A local fallback uses the same deterministic local-hash model as the
    # configured local provider. Keep the fallback provenance for the final
    # response, but use the compatible retrieval profile for the index check.
    retrieval_provenance: ProviderProvenance = (
        "local_provider" if embedding_provenance == "local_fallback" else embedding_provenance
    )
    try:
        hits = rag_service.search(
            query_embedding,
            top_k=min(request.top_k, settings.ai_max_retrieved_chunks),
            query_text=message,
            embedding_model=query_model,
            embedding_provenance=retrieval_provenance,
        )
    except EmbeddingContractError:
        if embedding_provenance != "local_fallback":
            raise
        # A persisted index built by another embedding model is not safe
        # context for a local fallback. Continue with the deterministic answer.
        hits = []
    context = [f"{doc.title}: {doc.content}" for doc, _ in hits]
    citations = [
        _citation(doc.source_type, doc.source_id, doc.title)
        for doc, _ in hits
    ]
    response = resolve_chat(
        message,
        settings,
        recent_turns=turns,
        context=context,
        citations=citations,
        synthetic_beta=request.synthetic_beta,
    )
    final_provenance = merge_provenance(response.provenance, embedding_provenance)
    if final_provenance == "local_fallback":
        return response.model_copy(
            update={
                "provenance": final_provenance,
                "citations": [],
                "mode": request.mode,
            }
        )
    return response.model_copy(update={"provenance": final_provenance, "mode": request.mode})


@app.post(
    "/chat/retrieve",
    response_model=ChatRetrieveResponse,
    dependencies=[Depends(require_service_auth)],
)
def chat_retrieve(request: ChatRetrieveRequest) -> ChatRetrieveResponse:
    """Return bounded candidates without invoking a language model.

    Spring must re-authorize these identities against its current SQL catalog
    before forwarding them to `/chat/generate`.
    """

    message = _enforce_input_limit(
        request.message,
        label="Chat message",
        setting_name="ai_max_input_chars",
    )
    bounded_request = request.model_copy(update={"message": message})
    return retrieve_chat_candidates(bounded_request, settings, rag_service, embedder=embed)


@app.post(
    "/chat/generate",
    response_model=ChatResponse,
    dependencies=[Depends(require_service_auth)],
)
def chat_generate(request: ChatGenerateRequest) -> ChatResponse:
    """Generate only from Spring's exact, revisioned source allowlist."""

    message = _enforce_input_limit(
        request.message,
        label="Chat message",
        setting_name="ai_max_input_chars",
    )
    bounded_request = request.model_copy(update={"message": message})
    return generate_chat_response(bounded_request, settings, rag_service)


@app.post("/embeddings", response_model=EmbeddingResponse, dependencies=[Depends(require_service_auth)])
def embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    text = _enforce_input_limit(request.text, label="Embedding input", setting_name="ai_max_input_chars")
    _reject_unsafe_egress_text(text)
    vector, model, provenance = _embedding_parts(
        embed(text, settings, synthetic_beta=request.synthetic_beta)
    )
    return EmbeddingResponse(embedding=vector, model=model, provenance=provenance)


@app.post("/rag/search", response_model=RAGSearchResponse, dependencies=[Depends(require_service_auth)])
def rag_search(request: RAGSearchRequest) -> RAGSearchResponse:
    query = _enforce_input_limit(request.query, label="RAG query", setting_name="ai_max_input_chars")
    _reject_unsafe_egress_text(query)
    query_embedding, query_model, provenance = _embedding_parts(
        embed(query, settings, synthetic_beta=request.synthetic_beta)
    )
    hits = rag_service.search(
        query_embedding,
        top_k=min(request.top_k, settings.ai_max_retrieved_chunks),
        query_text=query,
        embedding_model=query_model,
        embedding_provenance=provenance,
    )
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
        ],
        provenance=provenance,
    )


def require_rag_ingest_token(token: str | None) -> None:
    if not settings.rag_ingest_enabled:
        raise HTTPException(status_code=404, detail="RAG ingestion is disabled")
    if not _configured_secret(settings.rag_ingest_token):
        raise HTTPException(status_code=503, detail="RAG ingestion is not configured")
    if not token or not secrets.compare_digest(token, settings.rag_ingest_token):
        raise HTTPException(status_code=403, detail="Invalid RAG ingestion token")


@app.get("/rag/sources", response_model=RAGSourcesResponse, response_model_exclude_none=True)
def rag_sources(
    x_rag_ingest_token: str | None = Header(default=None),
    cursor: str | None = Query(default=None, pattern=r"^[0-9]{1,12}$"),
    limit: int = Query(default=1_000, ge=1, le=5_000),
    _service_auth: None = Depends(require_service_auth),
) -> RAGSourcesResponse:
    """Expose source identities so a trusted catalog sync can tombstone deletes."""

    require_rag_ingest_token(x_rag_ingest_token)
    start = int(cursor or "0")
    page_reader = getattr(rag_service, "source_page", None)
    if callable(page_reader):
        page, total = page_reader(start, limit)
    else:
        documents = sorted(
            rag_service.index.documents,
            key=lambda item: (item.source_type, item.source_id, item.id),
        )
        total = len(documents)
        page = documents[start : start + limit]
    source_rows: list[RAGSource] = []
    for document in page:
        projection = normalize_projection_kind(document.metadata)
        content_revision = _metadata_revision(document.metadata, "content_revision")
        eligibility_revision = _metadata_revision(document.metadata, "eligibility_revision")
        source_rows.append(
            RAGSource(
                source_type=document.source_type,
                source_id=document.source_id,
                projection_kind=cast(ProjectionKind, projection) if projection is not None else None,
                content_revision=content_revision,
                eligibility_revision=eligibility_revision,
                content_hash=_metadata_value(document.metadata, "content_hash"),
                approval_state=_metadata_value(document.metadata, "approval_state"),
                approval_id=_metadata_value(document.metadata, "approval_id"),
                approval_expires_at=_metadata_value(document.metadata, "approval_expires_at"),
            )
        )
    next_start = start + len(page)
    complete = next_start >= total
    # Preserve the old response shape for the first legacy request while
    # exposing explicit completeness metadata whenever the caller asks for a
    # cursor/limit page.
    if cursor is None and limit == 1_000 and complete:
        return RAGSourcesResponse(sources=source_rows)
    return RAGSourcesResponse(
        sources=source_rows,
        next_cursor=None if complete else str(next_start),
        complete=complete,
        total=total,
    )


@app.post("/rag/delete", response_model=RAGDeleteResponse)
def rag_delete(
    payload: RAGDeleteRequest,
    x_rag_ingest_token: str | None = Header(default=None),
    _service_auth: None = Depends(require_service_auth),
) -> RAGDeleteResponse:
    """Remove one trusted catalog source from the searchable index."""

    require_rag_ingest_token(x_rag_ingest_token)
    existed = any(
        document.source_type == payload.source_type
        and document.source_id == payload.source_id
        and (
            payload.projection_kind is None
            or normalize_projection_kind(document.metadata) == payload.projection_kind
        )
        for document in rag_service.index.documents
    )
    try:
        rag_service.remove(
            payload.source_type,
            payload.source_id,
            revision=payload.revision,
            projection=payload.projection_kind,
        )
    except SupabaseRagContractError:
        raise HTTPException(status_code=409, detail="RAG source revision rejected") from None
    except SupabaseRagUnavailable:
        raise HTTPException(status_code=503, detail="RAG persistence unavailable") from None
    return RAGDeleteResponse(removed=existed, index_size=rag_service.index.size)


@app.post("/rag/index", response_model=RAGIndexResponse)
def rag_index(
    payload: RAGIndexRequest,
    x_rag_ingest_token: str | None = Header(default=None),
    _service_auth: None = Depends(require_service_auth),
) -> RAGIndexResponse:
    """Ingest trusted knowledge; disabled and token-protected by default."""

    require_rag_ingest_token(x_rag_ingest_token)

    content = _enforce_input_limit(
        payload.content,
        label="RAG document",
        setting_name="rag_max_document_chars",
    )
    public_operational = _public_operational_branch(payload)
    _reject_invalid_rag_metadata(payload)
    # Metadata has now passed the closed provenance schema above.  Only the
    # human-authored title/content remain on the generic egress text path;
    # hashes, revisions, approval IDs/state and expiry timestamps are typed
    # values and must not be mistaken for PII dates or identifiers.
    _reject_unsafe_egress_text(payload.title)
    _reject_unsafe_egress_text(
        content,
        allow_public_operational=public_operational,
    )
    def embed_document(normalized_content: str) -> tuple[list[float], str, ProviderProvenance]:
        return _embedding_parts(
            embed(
                normalized_content,
                settings,
                synthetic_beta=payload.synthetic_beta,
                allow_public_operational=public_operational,
            )
        )

    try:
        doc = rag_service.ingest(
            source_type=payload.source_type,
            source_id=payload.source_id,
            title=payload.title,
            content=content,
            active=payload.active,
            published=payload.published,
            metadata=payload.metadata,
            embedder=embed_document,
        )
    except SupabaseRagContractError:
        raise HTTPException(status_code=409, detail="RAG source revision rejected") from None
    except SupabaseRagUnavailable:
        raise HTTPException(status_code=503, detail="RAG persistence unavailable") from None
    projection = normalize_projection_kind(payload.metadata)
    return RAGIndexResponse(
        id=doc.id,
        index_size=rag_service.index.size,
        indexed=rag_service.index.get(doc.id, projection=projection) is not None,
    )


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
    # Safety must run before embedding/provider access.  This keeps emergency,
    # PII, and prompt-injection text local even when remote embeddings are
    # configured for the synthetic canary.
    if triage_requires_local(symptoms):
        response = resolve_triage(
            symptoms,
            settings,
            synthetic_beta=request.synthetic_beta,
        )
        return SpecialtyRecommendationResponse(
            **response.model_dump(exclude={"provenance"}),
            provenance=response.provenance,
        )
    query_embedding, query_model, embedding_provenance = _embedding_parts(
        embed(symptoms, settings, synthetic_beta=request.synthetic_beta)
    )
    hits = rag_service.search(
        query_embedding,
        top_k=min(3, settings.ai_max_retrieved_chunks),
        query_text=symptoms,
        embedding_model=query_model,
        embedding_provenance=embedding_provenance,
    )
    if hits:
        # Keep the existing provider contract stable.  Retrieved content is
        # passed as reference context and citations are built from stored
        # identities, never from model-generated URLs or IDs.
        context = [f"{doc.title}: {doc.content}" for doc, _ in hits[:2]]
        response = resolve_triage(
            symptoms,
            settings,
            context=context,
            synthetic_beta=request.synthetic_beta,
        )
        recommendation_provenance = merge_provenance(
            response.provenance,
            embedding_provenance,
        )
        citations = [] if recommendation_provenance == "local_fallback" else [
            _citation(doc.source_type, doc.source_id, doc.title) for doc, _ in hits[:2]
        ]
        return SpecialtyRecommendationResponse(
            **response.model_dump(exclude={"citations", "provenance"}),
            citations=citations,
            provenance=recommendation_provenance,
        )
    response = resolve_triage(symptoms, settings, synthetic_beta=request.synthetic_beta)
    return SpecialtyRecommendationResponse(
        **response.model_dump(exclude={"provenance"}),
        provenance=merge_provenance(response.provenance, embedding_provenance),
    )


@app.get("/rag/stats", dependencies=[Depends(require_service_auth)])
def rag_stats() -> dict[str, int]:
    return {"documents": rag_service.index.size}


def _semantic_search(
    query_input: str,
    specialty_input: str,
    top_k: int,
    *,
    synthetic_beta: bool = False,
) -> SemanticSearchResponse:
    """Run bounded search while keeping free text out of the internal URL shape."""

    query = _enforce_input_limit(query_input, label="Search query", setting_name="ai_max_input_chars")
    specialty_filter = specialty_input.strip()
    _reject_unsafe_egress_text(query, specialty_filter)
    if not query and not specialty_filter:
        return SemanticSearchResponse(results=[])
    search_text = query or specialty_filter
    query_embedding, query_model, provenance = _embedding_parts(
        embed(search_text, settings, synthetic_beta=synthetic_beta)
    )
    hits = rag_service.search(
        query_embedding,
        top_k=min(top_k * 2, settings.ai_max_retrieved_chunks),
        query_text=search_text,
        embedding_model=query_model,
        embedding_provenance=provenance,
    )
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
    return SemanticSearchResponse(
        results=results,
        query=query,
        specialty=specialty_filter,
        provenance=provenance,
    )


@app.get("/search", response_model=SemanticSearchResponse)
def semantic_search(
    q: str = Query(default="", max_length=10_000),
    specialty: str = Query(default="", max_length=200),
    top_k: int = Query(default=10, ge=1, le=20),
    _service_auth: None = Depends(require_service_auth),
) -> SemanticSearchResponse:
    """Backward-compatible GET search for local callers."""

    return _semantic_search(q, specialty, top_k)


@app.post("/search", response_model=SemanticSearchResponse)
def semantic_search_post(
    request: SemanticSearchRequest,
    _service_auth: None = Depends(require_service_auth),
) -> SemanticSearchResponse:
    """Preferred internal search shape; query text stays in the request body."""

    return _semantic_search(
        request.query,
        request.specialty,
        request.top_k,
        synthetic_beta=request.synthetic_beta,
    )
