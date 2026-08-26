package com.healthcare.ai.service;

import com.healthcare.sync.outbox.SyncOutboxEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Reconciles the current approved clinical projection into the protected AI
 * index.  It intentionally resolves the live source/head rows on every run;
 * an old outbox event can trigger work, but it can never reconstitute its old
 * payload or approval state.  Spring remains the sole eligibility authority.
 */
@Service
public class AiClinicalProjectionIndexService {

    private static final Logger log = LoggerFactory.getLogger(AiClinicalProjectionIndexService.class);

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
        UNION ALL
        SELECT 'article' AS source_type,
               a.id::text AS source_id,
               a.title AS title,
               left(concat_ws(E'\\n', a.title, a.summary, a.body,
                              a.sections::text), 20000) AS content,
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
        """;

    private final AiService aiService;
    private final JdbcTemplate jdbc;

    public AiClinicalProjectionIndexService(AiService aiService, JdbcTemplate jdbc) {
        this.aiService = aiService;
        this.jdbc = jdbc;
    }

    public boolean isConfigured() {
        return aiService.isRagIngestConfigured();
    }

    @Scheduled(
        initialDelayString = "${ai.rag-ingest.clinical-initial-delay-ms:20000}",
        fixedDelayString = "${ai.rag-ingest.clinical-sync-delay-ms:60000}"
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

    /** Run one bounded, database-authoritative reconciliation. */
    public int synchronizeClinicalNow() {
        if (!aiService.isRagIngestConfigured()) {
            throw new IllegalStateException("AI RAG ingestion is not configured");
        }
        // This query is deliberately a complete, database-authorized
        // snapshot.  Do not silently cap it at 5,000 rows: a truncated
        // snapshot is not allowed to delete or acknowledge projection state.
        // The protected Supabase source endpoint is paginated separately; the
        // Spring reconciliation only proceeds after it has read every page.
        List<Map<String, Object>> rows = jdbc.queryForList(CURRENT_APPROVED_SOURCES);
        boolean completeSnapshot = true;

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
            aiService.indexDocument(payload);
            current.add(sourceType + ":" + sourceId);
            processed++;
        }

        // Remove rows that are no longer current/eligible.  The AI endpoint
        // receives the projection discriminator so an operational specialty
        // row cannot be removed by a clinical expiry.
        if (!completeSnapshot) return processed;
        for (Map<String, Object> indexed : aiService.listIndexedDocuments()) {
            String type = text(indexed.get("source_type"));
            String id = text(indexed.get("source_id"));
            Object projection = indexed.get("projection_kind");
            if (type == null || id == null || !"CLINICAL".equalsIgnoreCase(String.valueOf(projection))) continue;
            if (!current.contains(type + ":" + id)) {
                // Clinical tombstones use the database-owned eligibility
                // revision.  The indexed row may be stale after a revoke or
                // expiry, and using that old value can be rejected as an
                // equal-revision update by the durable tombstone guard. Read
                // the current review head instead of inventing a worker-local
                // revision; if the head is unavailable, fail closed and let
                // the scheduled reconciliation retry.
                long revision = currentEligibilityRevision(type, id);
                aiService.removeIndexedDocument(type, id, revision, "CLINICAL");
                processed++;
            }
        }
        return processed;
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
        Long revision = jdbc.queryForObject("""
            SELECT eligibility_revision
              FROM ai_content_review_heads
             WHERE source_type = ? AND source_id = ?
            """, Long.class, sourceType.toUpperCase(java.util.Locale.ROOT), parsedId);
        if (revision == null || revision <= 0) {
            throw new IllegalStateException("clinical review head revision is unavailable");
        }
        return revision;
    }
}
