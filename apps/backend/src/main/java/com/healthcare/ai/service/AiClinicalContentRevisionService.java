package com.healthcare.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.sql.PreparedStatement;

/**
 * Owns the write-side boundary for governed patient-chat content.
 *
 * <p>An ADMIN catalog mutation first becomes visible to JPA, then creates an
 * immutable canonical revision, advances the database-owned eligibility head,
 * invalidates the previous approval, writes an append-only audit event, and
 * appends a metadata-only outbox row in the same transaction.  No patient
 * message or provider payload enters any of these tables.</p>
 */
@Service
public class AiClinicalContentRevisionService {

    private static final String EVENT_EDITED = "EDITED";
    private static final String EVENT_INVALIDATED = "INVALIDATED";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final EntityManager entityManager;
    private final AiClinicalOutboxService outboxService;

    /** Compatibility constructor retained for focused unit fixtures. */
    public AiClinicalContentRevisionService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            UserRepository userRepository,
            EntityManager entityManager) {
        this(jdbc, objectMapper, userRepository, entityManager, null);
    }

    @Autowired
    public AiClinicalContentRevisionService(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            UserRepository userRepository,
            EntityManager entityManager,
            AiClinicalOutboxService outboxService) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.userRepository = userRepository;
        this.entityManager = entityManager;
        this.outboxService = outboxService;
    }

    @Transactional
    public void recordSpecialty(Specialty source, UserDetails actor) {
        requireId(source == null ? null : source.getId(), "SPECIALTY");
        record("SPECIALTY", source.getId(), specialtySnapshot(source), actor, "UPSERT");
    }

    @Transactional
    public void recordArticle(Article source, UserDetails actor) {
        requireId(source == null ? null : source.getId(), "ARTICLE");
        record("ARTICLE", source.getId(), articleSnapshot(source), actor, "UPSERT");
    }

    @Transactional
    public void recordFaq(Faq source, UserDetails actor) {
        requireId(source == null ? null : source.getId(), "FAQ");
        record("FAQ", source.getId(), faqSnapshot(source), actor, "UPSERT");
    }

    /**
     * Records a FAQ draft produced by the independently reviewed patient Q&A
     * workflow. The Q&A reviewer is an editor at this boundary, never the
     * clinical approver: the head remains DRAFT until another eligible doctor
     * approves the exact revision through the clinical-review workflow.
     */
    @Transactional
    public void recordFaqFromDoctorReview(Faq source, UUID doctorUserId) {
        requireId(source == null ? null : source.getId(), "FAQ");
        if (doctorUserId == null) {
            throw new IllegalArgumentException("doctor user id is required for Q&A materialization");
        }
        record("FAQ", source.getId(), faqSnapshot(source), doctorUserId, "DOCTOR", "UPSERT");
    }

    /** Record a tombstone before the catalog row is physically deleted. */
    @Transactional
    public void recordSpecialtyDeletion(Specialty source, UserDetails actor) {
        requireId(source == null ? null : source.getId(), "SPECIALTY");
        record("SPECIALTY", source.getId(), tombstoneSnapshot(source.getId()), actor, "TOMBSTONE");
    }

    @Transactional
    public void recordArticleDeletion(Article source, UserDetails actor) {
        requireId(source == null ? null : source.getId(), "ARTICLE");
        record("ARTICLE", source.getId(), tombstoneSnapshot(source.getId()), actor, "TOMBSTONE");
    }

    @Transactional
    public void recordFaqDeletion(Faq source, UserDetails actor) {
        requireId(source == null ? null : source.getId(), "FAQ");
        record("FAQ", source.getId(), tombstoneSnapshot(source.getId()), actor, "TOMBSTONE");
    }

    private void record(
            String sourceType,
            UUID sourceId,
            Map<String, Object> snapshot,
            UserDetails actor,
            String operation) {
        UUID actorId = actorId(actor);
        record(sourceType, sourceId, snapshot, actorId, actorRole(actorId), operation);
    }

    private void record(
            String sourceType,
            UUID sourceId,
            Map<String, Object> snapshot,
            UUID actorId,
            String actorRole,
            String operation) {
        if (entityManager != null) {
            // Repository save() may otherwise leave the source INSERT queued
            // behind the JDBC snapshot query in the same transaction.
            entityManager.flush();
        }

        String json = canonicalSnapshot(sourceType, sourceId, operation, snapshot);
        lockSource(sourceType, sourceId);
        Map<String, Object> previous = one("""
            SELECT content_revision, content_hash, eligibility_revision,
                   current_approval_round
              FROM ai_content_review_heads
             WHERE source_type = ? AND source_id = ?
             FOR UPDATE
            """, sourceType, sourceId);
        long revision = previous == null
            ? 1L
            : number(previous.get("content_revision")) + 1L;
        long eligibility = previous == null
            ? 1L
            : number(previous.get("eligibility_revision")) + 1L;
        String hash = canonicalHash(json);

        jdbc.update("""
            INSERT INTO ai_content_revisions(
                source_type, source_id, content_revision, content_hash,
                content_snapshot, created_by)
            VALUES (?, ?, ?, ?, ?::jsonb, ?)
            """, sourceType, sourceId, revision, hash, json, actorId);

        if (previous == null) {
            jdbc.update("""
                INSERT INTO ai_content_review_heads(
                    source_type, source_id, content_revision, content_hash,
                    eligibility_revision, eligibility_state, edited_by)
                VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)
                """, sourceType, sourceId, revision, hash, eligibility, actorId);
        } else {
            Object previousRound = previous.get("current_approval_round");
            if (previousRound != null) {
                long oldRound = number(previousRound);
                String oldHash = String.valueOf(previous.get("content_hash"));
                jdbc.update("""
                    UPDATE ai_content_approval_rounds
                       SET state = 'REVOKED', reason = 'Source revision changed',
                           expires_at = NULL
                     WHERE source_type = ? AND source_id = ?
                       AND content_revision = ? AND approval_round = ?
                       AND state = 'APPROVED'
                    """, sourceType, sourceId,
                    number(previous.get("content_revision")), oldRound);
                appendEvent(sourceType, sourceId,
                    number(previous.get("content_revision")), oldHash,
                    eligibility, oldRound, EVENT_INVALIDATED, actorId, actorRole,
                    "Source revision changed");
            }
            jdbc.update("""
                UPDATE ai_content_review_heads
                   SET content_revision = ?, content_hash = ?,
                       eligibility_revision = ?, eligibility_state = 'DRAFT',
                       current_approval_round = NULL, edited_by = ?,
                       submitted_at = NULL, approved_at = NULL,
                       approval_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE source_type = ? AND source_id = ?
                """, revision, hash, eligibility, actorId, sourceType, sourceId);
        }

        appendEvent(sourceType, sourceId, revision, hash, eligibility, null,
            EVENT_EDITED, actorId, actorRole, null);
        appendOutbox(sourceType, sourceId, revision, eligibility, hash, operation);
    }

    private void appendOutbox(
            String sourceType,
            UUID sourceId,
            long revision,
            long eligibility,
            String hash,
            String operation) {
        if (outboxService != null) {
            outboxService.append(sourceType, sourceId, revision, eligibility, hash, operation);
            return;
        }
        // This insert deliberately joins the caller's transaction (all public
        // entry points are @Transactional).  The fallback exists only for
        // legacy focused unit fixtures that use the four-argument constructor;
        // the Spring bean always uses AiClinicalOutboxService above.
        jdbc.update("""
            INSERT INTO sync_outbox_events(
                event_id, entity_classification, entity_type, entity_id,
                revision, operation, content_hash, occurred_at,
                correlation_id, status, attempt_count, available_at,
                updated_at, source_revision, eligibility_revision)
            VALUES (?, 'DEIDENTIFIED_CLINICAL', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
                    ?, 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
            ON CONFLICT DO NOTHING
            """, UUID.randomUUID(), sourceType.toLowerCase(), sourceId,
            eligibility, operation, hash, UUID.randomUUID(), revision, eligibility);
    }

    private void appendEvent(
            String sourceType,
            UUID sourceId,
            long revision,
            String hash,
            long eligibility,
            Long round,
            String eventType,
            UUID actorId,
            String actorRole,
            String reason) {
        jdbc.update("""
            INSERT INTO ai_content_review_events(
                event_id, source_type, source_id, content_revision, content_hash,
                eligibility_revision, approval_round, event_type, actor_id,
                actor_role, correlation_id, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, UUID.randomUUID(), sourceType, sourceId, revision, hash,
            eligibility, round, eventType, actorId, actorRole, UUID.randomUUID(), reason);
    }

    private void lockSource(String sourceType, UUID sourceId) {
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT pg_advisory_xact_lock(hashtextextended(? || ':' || ?::text, 0))")) {
                statement.setString(1, sourceType);
                statement.setObject(2, sourceId);
                statement.execute();
            }
            return null;
        });
    }

    private String canonicalHash(String json) {
        String hash = jdbc.queryForObject("""
            SELECT encode(digest(convert_to(?::jsonb::text, 'UTF8'), 'sha256'), 'hex')
            """, String.class, json);
        if (hash == null || !hash.matches("[0-9a-f]{64}")) {
            throw new IllegalStateException("database returned an invalid clinical content hash");
        }
        return hash;
    }

    /** Build the snapshot from the same PostgreSQL values used by the live
     * authorization query.  This avoids Java timestamp/JSON formatting drift
     * and makes a catalog edit/hash comparison deterministic. */
    private String canonicalSnapshot(
            String sourceType,
            UUID sourceId,
            String operation,
            Map<String, Object> fallback) {
        if ("TOMBSTONE".equals(operation)) return serialize(fallback);
        String sql = switch (sourceType) {
            case "SPECIALTY" -> """
                SELECT jsonb_build_object(
                    'active', active,
                    'care_pathway', care_pathway,
                    'common_symptoms', common_symptoms,
                    'description', description,
                    'id', id::text,
                    'name', name,
                    'preparation_steps', preparation_steps,
                    'slug', slug
                )::text
                  FROM specialties WHERE id = ?
                """;
            case "ARTICLE" -> """
                SELECT jsonb_build_object(
                    'active', active,
                    'author_name', author_name,
                    'body', body,
                    'category', category,
                    'id', id::text,
                    'reading_minutes', reading_minutes,
                    'related_specialty_slug', related_specialty_slug,
                    'published_at', published_at,
                    'sections', sections,
                    'slug', slug,
                    'summary', summary,
                    'title', title
                )::text
                  FROM articles WHERE id = ?
                """;
            case "FAQ" -> """
                SELECT jsonb_build_object(
                    'active', active,
                    'answer', answer,
                    'id', id::text,
                    'question', question
                )::text
                  FROM faqs WHERE id = ?
                """;
            default -> throw new IllegalArgumentException("unsupported clinical source type");
        };
        String json = jdbc.queryForObject(sql, String.class, sourceId);
        if (json == null || json.isBlank()) {
            throw new IllegalStateException("clinical source disappeared before revision commit");
        }
        return json;
    }

    private Map<String, Object> specialtySnapshot(Specialty source) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("active", source.isActive());
        value.put("care_pathway", source.getCarePathway());
        value.put("common_symptoms", source.getCommonSymptoms());
        value.put("description", source.getDescription());
        value.put("id", source.getId().toString());
        value.put("name", source.getName());
        value.put("preparation_steps", source.getPreparationSteps());
        value.put("slug", source.getSlug());
        return value;
    }

    private Map<String, Object> articleSnapshot(Article source) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("active", source.isActive());
        value.put("author_name", source.getAuthorName());
        value.put("body", source.getBody());
        value.put("category", source.getCategory());
        value.put("id", source.getId().toString());
        value.put("reading_minutes", source.getReadingMinutes());
        value.put("related_specialty_slug", source.getRelatedSpecialtySlug());
        value.put("published_at", source.getPublishedAt());
        value.put("sections", source.getSections());
        value.put("slug", source.getSlug());
        value.put("summary", source.getSummary());
        value.put("title", source.getTitle());
        return value;
    }

    private Map<String, Object> faqSnapshot(Faq source) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("active", source.isActive());
        value.put("answer", source.getAnswer());
        value.put("id", source.getId().toString());
        value.put("question", source.getQuestion());
        return value;
    }

    private Map<String, Object> tombstoneSnapshot(UUID sourceId) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("deleted", true);
        value.put("id", sourceId.toString());
        return value;
    }

    private UUID actorId(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        if (principal == null || principal.getUsername() == null) return null;
        return userRepository.findByEmail(principal.getUsername())
            .map(User::getId)
            .orElse(null);
    }

    private String actorRole(UUID actorId) {
        return actorId == null ? "SYSTEM" : "ADMIN";
    }

    private void requireId(UUID id, String type) {
        if (id == null) throw new IllegalArgumentException(type + " id is required before revisioning");
    }

    private String serialize(Map<String, Object> snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("clinical content snapshot could not be encoded", exception);
        }
    }

    private Map<String, Object> one(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private long number(Object value) {
        if (!(value instanceof Number number)) {
            throw new IllegalStateException("database revision is not numeric");
        }
        return number.longValue();
    }
}
