package com.healthcare.ai.service;

import com.healthcare.sync.outbox.SyncOutboxEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Reconciles the current approved clinical projection into the protected AI
 * index.  It intentionally resolves the live source/head rows on every run;
 * an old outbox event can trigger work, but it can never reconstitute its old
 * payload or approval state.  Spring remains the sole eligibility authority.
 */
@Service
public class AiClinicalProjectionIndexService {

    private static final Logger log = LoggerFactory.getLogger(AiClinicalProjectionIndexService.class);
    private static final Set<String> CLINICAL_SOURCE_TYPES = Set.of("specialty", "article", "faq");

    private static final String CURRENT_APPROVED_SOURCES = """
        SELECT 'specialty' AS source_type,
               s.id::text AS source_id,
               s.name AS title,
               left(concat_ws(E'\\n', s.name, s.description, s.care_pathway,
                              s.common_symptoms, s.preparation_steps), 20000) AS content,
               s.active AS active,
               TRUE AS published,
               h.content_revision,
               h.eligibility_revision,
               h.content_hash,
               h.current_approval_round AS approval_round,
               r.expires_at::text AS approval_expires_at
          FROM specialties s
          JOIN ai_content_review_heads h
            ON h.source_type = 'SPECIALTY' AND h.source_id = s.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type
           AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision
           AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer ON reviewer.id = r.reviewed_by
         WHERE s.active
           AND h.eligibility_state = 'APPROVED'
           AND r.state = 'APPROVED'
           AND reviewer.status = 'ACTIVE'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND EXISTS (
               SELECT 1 FROM user_roles ur
               JOIN roles role ON role.id = ur.role_id
                AND role.code = 'DOCTOR'
               WHERE ur.user_id = reviewer.id
           )
           -- A direct SQL/seed edit must not leave the old approved snapshot
           -- in the protected AI index.  The review resolver applies the same
           -- live-canonical-content fence at answer time; applying it here
           -- keeps retrieval from even seeing stale clinical material.
           AND h.content_hash = encode(digest(convert_to(jsonb_build_object(
               'active', s.active,
               'care_pathway', s.care_pathway,
               'common_symptoms', s.common_symptoms,
               'description', s.description,
               'id', s.id::text,
               'name', s.name,
               'preparation_steps', s.preparation_steps,
               'slug', s.slug
           )::text, 'UTF8'), 'sha256'), 'hex')
        UNION ALL
        SELECT 'article' AS source_type,
               a.id::text AS source_id,
               a.title AS title,
               left(concat_ws(E'\\n', a.title, a.summary, a.body,
                              COALESCE((
                                  SELECT string_agg(
                                      concat_ws(': ', value->>'heading', value->>'body'),
                                      E'\\n'
                                  )
                                    FROM jsonb_array_elements(
                                        CASE
                                            WHEN jsonb_typeof(a.sections) = 'array' THEN a.sections
                                            ELSE '[]'::jsonb
                                        END
                                    ) AS section(value)
                              ), '')), 20000) AS content,
               a.active AS active,
               (a.published_at IS NOT NULL) AS published,
               h.content_revision,
               h.eligibility_revision,
               h.content_hash,
               h.current_approval_round AS approval_round,
               r.expires_at::text AS approval_expires_at
          FROM articles a
          JOIN ai_content_review_heads h
            ON h.source_type = 'ARTICLE' AND h.source_id = a.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type
           AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision
           AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer ON reviewer.id = r.reviewed_by
         WHERE a.active
           AND a.published_at IS NOT NULL
           AND h.eligibility_state = 'APPROVED'
           AND r.state = 'APPROVED'
           AND reviewer.status = 'ACTIVE'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND EXISTS (
               SELECT 1 FROM user_roles ur
               JOIN roles role ON role.id = ur.role_id
                AND role.code = 'DOCTOR'
               WHERE ur.user_id = reviewer.id
           )
           -- Keep the indexed text and the approved canonical revision tied
           -- to the same live article row.  If an out-of-band catalog update
           -- bypasses AiClinicalContentRevisionService, the next complete
           -- reconciliation removes its old projection.
           AND h.content_hash = encode(digest(convert_to(jsonb_build_object(
               'active', a.active,
               'author_name', a.author_name,
               'body', a.body,
               'category', a.category,
               'id', a.id::text,
               'reading_minutes', a.reading_minutes,
               'related_specialty_slug', a.related_specialty_slug,
               'published_at', a.published_at,
               'sections', a.sections,
               'slug', a.slug,
               'summary', a.summary,
               'title', a.title
           )::text, 'UTF8'), 'sha256'), 'hex')
        UNION ALL
        SELECT 'faq' AS source_type,
               f.id::text AS source_id,
               f.question AS title,
               left(concat_ws(E'\\n', f.question, f.answer), 20000) AS content,
               f.active AS active,
               TRUE AS published,
               h.content_revision,
               h.eligibility_revision,
               h.content_hash,
               h.current_approval_round AS approval_round,
               r.expires_at::text AS approval_expires_at
          FROM faqs f
          JOIN ai_content_review_heads h
            ON h.source_type = 'FAQ' AND h.source_id = f.id
          JOIN ai_content_approval_rounds r
            ON r.source_type = h.source_type
           AND r.source_id = h.source_id
           AND r.content_revision = h.content_revision
           AND r.content_hash = h.content_hash
           AND r.approval_round = h.current_approval_round
          JOIN users reviewer ON reviewer.id = r.reviewed_by
         WHERE f.active
           AND h.eligibility_state = 'APPROVED'
           AND r.state = 'APPROVED'
           AND reviewer.status = 'ACTIVE'
           AND r.expires_at > CURRENT_TIMESTAMP
           AND EXISTS (
               SELECT 1 FROM user_roles ur
               JOIN roles role ON role.id = ur.role_id
                AND role.code = 'DOCTOR'
               WHERE ur.user_id = reviewer.id
           )
           AND h.content_hash = encode(digest(convert_to(jsonb_build_object(
               'active', f.active,
               'answer', f.answer,
               'id', f.id::text,
               'question', f.question
           )::text, 'UTF8'), 'sha256'), 'hex')
        """;

    private final AiService aiService;
    private final JdbcTemplate jdbc;
    private final AiClinicalReviewExpiryService expiryService;
    private final ReentrantLock syncLock = new ReentrantLock();

    public AiClinicalProjectionIndexService(AiService aiService, JdbcTemplate jdbc) {
        this(aiService, jdbc, null);
    }

    @Autowired
    public AiClinicalProjectionIndexService(
            AiService aiService,
            JdbcTemplate jdbc,
            @Nullable AiClinicalReviewExpiryService expiryService) {
        this.aiService = aiService;
        this.jdbc = jdbc;
        this.expiryService = expiryService;
    }

    public boolean isConfigured() {
        return aiService.isRagIngestConfigured();
    }

    @Scheduled(
        initialDelayString = "${ai.rag-ingest.clinical-initial-delay-ms:20000}",
        fixedDelayString = "${ai.rag-ingest.clinical-sync-delay-ms:1800000}"
    )
    public void synchronizeClinical() {
        if (!aiService.isRagIngestConfigured()) return;
        try {
            int processed = synchronizeClinicalNow();
            log.info("AI clinical projection reconciliation completed: {} documents processed", processed);
        } catch (RuntimeException exception) {
            // The next run re-resolves the same database-owned head.  Do not
            // mark a source eligible or emit provider-facing error payloads.
            log.warn("AI clinical projection reconciliation deferred: {}", exception.getClass().getSimpleName());
        }
    }

    /**
     * Empty-index warm check for the governed clinical projection. After an
     * ai-service restart its in-memory index is empty and the APPROVED
     * specialty/article/faq projections stay unreachable until the next
     * 30-minute reconciliation tick, during which every clinical question
     * falls into the INSUFFICIENT_EVIDENCE window. When the live approved
     * snapshot holds more eligible rows than the index holds CLINICAL
     * documents, push the snapshot right away. Same warm-check cadence and
     * fail-soft contract as the catalog warm check
     * ({@link AiCatalogIndexService#warmEmptyCatalogIndex}).
     */
    @Scheduled(
        initialDelayString = "${ai.rag-ingest.warm-check-initial-delay-ms:20000}",
        fixedDelayString = "${ai.rag-ingest.warm-check-delay-ms:60000}"
    )
    public void warmEmptyClinicalProjectionIndex() {
        if (!aiService.isRagIngestConfigured()) return;
        try {
            int eligible = 0;
            for (Map<String, Object> row : jdbc.queryForList(CURRENT_APPROVED_SOURCES)) {
                if (isPushableClinicalRow(row)) eligible++;
            }
            // Nothing is currently eligible: a warm push could only run the
            // tombstone sweep, which the periodic tick already owns.
            if (eligible == 0) return;
            if (countIndexedClinicalDocuments() >= eligible) return;
            // synchronizeClinicalNow is serialized by the same sync lock as
            // the periodic tick, so this cannot run concurrently with a full
            // reconciliation pass.
            synchronizeClinicalNow();
            log.info("AI clinical projection warm check pushed the approved snapshot into a depleted index");
        } catch (RuntimeException exception) {
            // Same deferral posture as the periodic tick: the next warm check
            // re-resolves the same database-owned snapshot. Do not mark a
            // source eligible or emit provider-facing error payloads.
            log.warn("AI clinical projection warm check deferred: {}", exception.getClass().getSimpleName());
        }
    }

    /** Mirror the push-eligibility checks {@link #synchronizeClinicalNow()} applies per row. */
    private boolean isPushableClinicalRow(Map<String, Object> row) {
        return text(row.get("source_type")) != null
            && text(row.get("source_id")) != null
            && text(row.get("title")) != null
            && text(row.get("content")) != null
            && text(row.get("content_hash")) != null
            && text(row.get("approval_expires_at")) != null;
    }

    /** Count only rows this projection owns: CLINICAL docs of a clinical source type. */
    private int countIndexedClinicalDocuments() {
        int count = 0;
        for (Map<String, Object> indexed : aiService.listIndexedDocuments()) {
            String type = text(indexed.get("source_type"));
            Object projection = indexed.get("projection_kind");
            if (type == null || text(indexed.get("source_id")) == null) continue;
            if (!"CLINICAL".equalsIgnoreCase(String.valueOf(projection))) continue;
            if (!CLINICAL_SOURCE_TYPES.contains(type.toLowerCase(java.util.Locale.ROOT))) continue;
            count++;
        }
        return count;
    }

    /** Run one bounded, database-authoritative reconciliation. */
    public int synchronizeClinicalNow() {
        if (!aiService.isRagIngestConfigured()) {
            throw new IllegalStateException("AI RAG ingestion is not configured");
        }
        if (!syncLock.tryLock()) {
            log.info("AI clinical projection reconciliation skipped: another synchronization is active");
            return 0;
        }
        try {
            if (expiryService != null) {
                try {
                    expiryService.expireNow();
                } catch (RuntimeException exception) {
                    log.warn("AI clinical review expiry pre-sweep deferred: {}", exception.getClass().getSimpleName());
                }
            }
            // This query is deliberately a complete, database-authorized
            // snapshot.  Do not silently cap it at 5,000 rows: a truncated
            // snapshot is not allowed to delete or acknowledge projection state.
            // The protected Supabase source endpoint is paginated separately; the
            // Spring reconciliation only proceeds after it has read every page.
            List<Map<String, Object>> rows = jdbc.queryForList(CURRENT_APPROVED_SOURCES);
            boolean completeSnapshot = true;

            // One index listing serves both the push loop (skip unchanged
            // rows) and the tombstone sweep.  Re-pushing ~750 approved
            // documents every cycle re-embeds each one and starves the chat
            // worker for minutes; a row whose governed identity (revisions,
            // content hash, approval round and expiry) is already indexed
            // byte-for-byte gains nothing from another upsert.  A failed or
            // partial listing simply pushes everything, as before.
            List<Map<String, Object>> indexedDocuments;
            try {
                indexedDocuments = aiService.listIndexedDocuments();
            } catch (RuntimeException exception) {
                log.warn("AI clinical projection index listing unavailable; pushing the full snapshot");
                indexedDocuments = List.of();
            }
            Map<String, Map<String, Object>> indexedByKey = new java.util.HashMap<>();
            for (Map<String, Object> indexed : indexedDocuments) {
                String indexedType = text(indexed.get("source_type"));
                String indexedId = text(indexed.get("source_id"));
                if (indexedType != null && indexedId != null
                        && "CLINICAL".equalsIgnoreCase(text(indexed.get("projection_kind")))) {
                    indexedByKey.put(indexedType + ":" + indexedId, indexed);
                }
            }

            Set<String> current = new HashSet<>();
            int processed = 0;
            for (Map<String, Object> row : rows) {
                String sourceType = text(row.get("source_type"));
                String sourceId = text(row.get("source_id"));
                String title = text(row.get("title"));
                String content = text(row.get("content"));
                if (sourceType == null || sourceId == null || title == null || content == null) continue;

                long contentRevision = number(row.get("content_revision"));
                long eligibilityRevision = number(row.get("eligibility_revision"));
                long approvalRound = number(row.get("approval_round"));
                String contentHash = text(row.get("content_hash"));
                String expiresAt = text(row.get("approval_expires_at"));
                if (contentHash == null || expiresAt == null) continue;

                Map<String, String> metadata = new LinkedHashMap<>();
                metadata.put("projection_kind", "CLINICAL");
                metadata.put("content_revision", Long.toString(contentRevision));
                metadata.put("eligibility_revision", Long.toString(eligibilityRevision));
                metadata.put("content_hash", contentHash);
                metadata.put("approval_id", Long.toString(approvalRound));
                metadata.put("approval_state", "APPROVED");
                metadata.put("approval_expires_at", expiresAt);

                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("source_type", sourceType);
                payload.put("source_id", sourceId);
                payload.put("title", title);
                payload.put("content", content);
                payload.put("active", true);
                payload.put("published", true);
                payload.put("metadata", metadata);
                // One rejected or failing source must never abort the whole
                // snapshot pass: a single ai-service rejection otherwise
                // starves every later source and keeps the tombstone sweep
                // (below) from ever running — production evidence: one FAQ
                // rejected by the egress gate stopped 17 eligible sources for
                // days. The row still counts as current either way: it came
                // from the live approval query, so it may only suppress a
                // tombstone, never create one.
                current.add(sourceType + ":" + sourceId);
                Map<String, Object> indexed = indexedByKey.get(sourceType + ":" + sourceId);
                if (indexed != null
                        && number(indexed.get("content_revision")) == contentRevision
                        && number(indexed.get("eligibility_revision")) == eligibilityRevision
                        && contentHash.equalsIgnoreCase(text(indexed.get("content_hash")))
                        && Long.toString(approvalRound).equals(text(indexed.get("approval_id")))
                        && expiresAt.equals(text(indexed.get("approval_expires_at")))) {
                    continue;
                }
                try {
                    aiService.indexDocument(payload);
                } catch (RuntimeException exception) {
                    log.warn(
                        "Clinical projection push failed for {}:{} ({}: {}) - skipping, next cycle retries",
                        sourceType,
                        sourceId,
                        exception.getClass().getSimpleName(),
                        exception.getMessage()
                    );
                    continue;
                }
                processed++;
            }

            // Remove rows that are no longer current/eligible.  The AI endpoint
            // receives the projection discriminator so an operational specialty
            // row cannot be removed by a clinical expiry.
            if (!completeSnapshot) return processed;
            for (Map<String, Object> indexed : indexedDocuments) {
                String type = text(indexed.get("source_type"));
                String id = text(indexed.get("source_id"));
                Object projection = indexed.get("projection_kind");
                if (type == null || id == null || !"CLINICAL".equalsIgnoreCase(String.valueOf(projection))) continue;
                if (!CLINICAL_SOURCE_TYPES.contains(type.toLowerCase(java.util.Locale.ROOT))) {
                    // A legacy or forged row must never make reconciliation look
                    // up a review head for an entity type that has no clinical
                    // approval workflow.  It is quarantined from this pass and
                    // cannot enter a patient-chat source allowlist.
                    log.warn("Ignoring unsupported clinical projection source type during reconciliation");
                    continue;
                }
                if (!current.contains(type + ":" + id)) {
                    // Clinical tombstones use the database-owned eligibility
                    // revision.  The indexed row may be stale after a revoke or
                    // expiry, and using that old value can be rejected as an
                    // equal-revision update by the durable tombstone guard. Read
                    // the current review head instead of inventing a worker-local
                    // revision; if the head is unavailable, fail closed and let
                    // the scheduled reconciliation retry.
                    long revision = currentEligibilityRevision(type, id);
                    try {
                        aiService.removeIndexedDocument(type, id, revision, "CLINICAL");
                    } catch (RuntimeException exception) {
                        // Same fault isolation as the push loop: one refused
                        // tombstone must not abort the sweep for every other
                        // revoked source; the next scheduled cycle retries.
                        log.warn(
                            "Clinical projection tombstone failed for {}:{} ({}: {}) - skipping, next cycle retries",
                            type,
                            id,
                            exception.getClass().getSimpleName(),
                            exception.getMessage()
                        );
                        continue;
                    }
                    processed++;
                }
            }
            return processed;
        } finally {
            syncLock.unlock();
        }
    }

    /**
     * Confirm that a claimed event is represented by the current database-owned
     * projection before its lease is acknowledged.  A newer eligibility
     * revision supersedes an older event; it is safe to acknowledge the older
     * row only after the newer state itself is present (or absent, for an
     * ineligible/tombstoned source).
     */
    public boolean isEventConverged(SyncOutboxEvent event) {
        String sourceType = event.identity().entity().entityType();
        String sourceId = event.identity().entity().entityId().toString();
        Map<String, Object> current = null;
        for (Map<String, Object> row : jdbc.queryForList(CURRENT_APPROVED_SOURCES)) {
            if (sourceType.equalsIgnoreCase(text(row.get("source_type")))
                    && sourceId.equals(text(row.get("source_id")))) {
                current = row;
                break;
            }
        }

        Map<String, Object> indexed = null;
        for (Map<String, Object> row : aiService.listIndexedDocuments()) {
            if (sourceType.equalsIgnoreCase(text(row.get("source_type")))
                    && sourceId.equals(text(row.get("source_id")))
                    && "CLINICAL".equalsIgnoreCase(text(row.get("projection_kind")))) {
                indexed = row;
                break;
            }
        }
        if (current == null) {
            return indexed == null;
        }
        if (indexed == null) return false;

        long expectedEligibility = number(current.get("eligibility_revision"));
        long indexedEligibility = number(indexed.get("eligibility_revision"));
        long indexedContent = number(indexed.get("content_revision"));
        String expectedHash = text(current.get("content_hash"));
        String indexedHash = text(indexed.get("content_hash"));
        if (expectedEligibility == event.identity().revision()
                && !event.contentHash().value().equalsIgnoreCase(expectedHash)) {
            return false;
        }
        return indexedEligibility >= expectedEligibility
            && indexedContent == number(current.get("content_revision"))
            && expectedHash != null
            && expectedHash.equals(indexedHash)
            && "APPROVED".equalsIgnoreCase(text(indexed.get("approval_state")));
    }

    private String text(Object value) {
        if (value == null) return null;
        String result = String.valueOf(value).strip();
        return result.isBlank() ? null : result;
    }

    private long number(Object value) {
        if (value instanceof Number number && number.longValue() > 0) return number.longValue();
        throw new IllegalStateException("clinical projection returned an invalid revision");
    }

    private long currentEligibilityRevision(String sourceType, String sourceId) {
        UUID parsedId;
        try {
            parsedId = UUID.fromString(sourceId);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("clinical projection returned an invalid source id", exception);
        }
        try {
            Long revision = jdbc.queryForObject("""
                SELECT eligibility_revision
                  FROM ai_content_review_heads
                 WHERE source_type = ? AND source_id = ?
                """, Long.class, sourceType.toUpperCase(java.util.Locale.ROOT), parsedId);
            if (revision == null || revision <= 0) {
                throw new IllegalStateException("clinical review head revision is unavailable");
            }
            return revision;
        } catch (EmptyResultDataAccessException exception) {
            return Long.MAX_VALUE / 2;
        }
    }
}
