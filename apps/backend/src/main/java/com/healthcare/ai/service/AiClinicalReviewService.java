package com.healthcare.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.exception.BusinessException;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Database-time clinical content review workflow for governed patient chat. */
@Service
public class AiClinicalReviewService {

    private static final Set<String> TYPES = Set.of("SPECIALTY", "ARTICLE", "FAQ");
    private static final Set<String> DECISIONS = Set.of("APPROVE", "REQUEST_CHANGES", "REVOKE");
    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final AiClinicalOutboxService outboxService;
    private final ObjectMapper objectMapper;

    /** Compatibility constructor retained for focused unit fixtures. */
    public AiClinicalReviewService(JdbcTemplate jdbc, UserRepository userRepository) {
        this(jdbc, userRepository, null, new ObjectMapper());
    }

    public AiClinicalReviewService(
            JdbcTemplate jdbc,
            UserRepository userRepository,
            AiClinicalOutboxService outboxService) {
        this(jdbc, userRepository, outboxService, new ObjectMapper());
    }

    @Autowired
    public AiClinicalReviewService(
            JdbcTemplate jdbc,
            UserRepository userRepository,
            AiClinicalOutboxService outboxService,
            ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.outboxService = outboxService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> submit(
            String rawType,
            UUID sourceId,
            long revision,
            String contentHash,
            org.springframework.security.core.userdetails.UserDetails principal) {
        String type = type(rawType);
        UUID actor = actorId(principal);
        String hash = normalizedHash(contentHash);
        Map<String, Object> revisionRow = one("""
            SELECT content_revision, content_hash
              FROM ai_content_revisions
             WHERE source_type = ? AND source_id = ? AND content_revision = ?
            """, type, sourceId, revision);
        if (revisionRow == null || !hash.equals(String.valueOf(revisionRow.get("content_hash")))) {
            throw error(409, "AI_CONTENT_REVISION_STALE", "Content revision is stale");
        }
        Map<String, Object> head = one("""
            SELECT content_revision, content_hash, eligibility_revision, eligibility_state
              FROM ai_content_review_heads
             WHERE source_type = ? AND source_id = ?
             FOR UPDATE
            """, type, sourceId);
        if (head == null
                || ((Number) head.get("content_revision")).longValue() != revision
                || !hash.equals(String.valueOf(head.get("content_hash")))) {
            throw error(409, "AI_CONTENT_REVISION_STALE", "Content revision is stale");
        }
        String state = String.valueOf(head.get("eligibility_state"));
        if ("SUBMITTED".equals(state)) {
            throw error(409, "AI_CONTENT_ALREADY_DECIDED", "Content is already submitted");
        }
        long eligibility = ((Number) head.get("eligibility_revision")).longValue() + 1;
        Number roundNumber = jdbc.queryForObject("""
            SELECT COALESCE(MAX(approval_round), 0) + 1
              FROM ai_content_approval_rounds
             WHERE source_type = ? AND source_id = ? AND content_revision = ?
            """, Number.class, type, sourceId, revision);
        long round = roundNumber == null ? 1 : roundNumber.longValue();
        jdbc.update("""
            INSERT INTO ai_content_approval_rounds(
                source_type, source_id, content_revision, content_hash,
                approval_round, state, submitted_by)
            VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?)
            """, type, sourceId, revision, hash, round, actor);
        jdbc.update("""
            UPDATE ai_content_review_heads
               SET eligibility_revision = ?, eligibility_state = 'SUBMITTED',
                   current_approval_round = ?, edited_by = ?, submitted_at = CURRENT_TIMESTAMP,
                   approved_at = NULL, approval_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE source_type = ? AND source_id = ?
            """, eligibility, round, actor, type, sourceId);
        appendEvent(type, sourceId, revision, hash, eligibility, round, "SUBMITTED", actor, "ADMIN", null);
        appendOutbox(type, sourceId, revision, eligibility, hash, "TOMBSTONE");
        return head(type, sourceId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> queue(String state, int page, int size) {
        String normalized = state == null || state.isBlank() ? "SUBMITTED" : state.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("SUBMITTED", "APPROVED", "CHANGES_REQUESTED", "REVOKED", "EXPIRED", "DRAFT").contains(normalized)) {
            throw error(400, "AI_CONTENT_STATE_INVALID", "Invalid review state");
        }
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT h.source_type, h.source_id, h.content_revision, h.content_hash,
                   h.eligibility_revision, h.eligibility_state, h.current_approval_round,
                   h.submitted_at, h.approved_at, h.approval_expires_at,
                   COALESCE(
                     CASE h.source_type
                       WHEN 'SPECIALTY' THEN (SELECT s.name FROM specialties s WHERE s.id = h.source_id)
                       WHEN 'ARTICLE' THEN (SELECT a.title FROM articles a WHERE a.id = h.source_id)
                       WHEN 'FAQ' THEN (SELECT f.question FROM faqs f WHERE f.id = h.source_id)
                     END,
                     CASE h.source_type
                       WHEN 'SPECIALTY' THEN 'Chuyên khoa chưa có tiêu đề'
                       WHEN 'ARTICLE' THEN 'Bài viết chưa có tiêu đề'
                       WHEN 'FAQ' THEN 'Câu hỏi thường gặp chưa có tiêu đề'
                       ELSE 'Nội dung bệnh viện'
                     END
                   ) AS title
              FROM ai_content_review_heads h
             WHERE h.eligibility_state = ?
            ORDER BY h.submitted_at NULLS LAST, h.source_type, h.source_id
            LIMIT ? OFFSET ?
            """, normalized, safeSize, safePage * safeSize);
        return rows.stream().map(this::summary).toList();
    }

    /** Page-shaped response for the doctor UI while retaining the bounded list API. */
    @Transactional(readOnly = true)
    public Map<String, Object> queuePage(String state, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        List<Map<String, Object>> content = queue(state, safePage, safeSize);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", content);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("hasMore", content.size() == safeSize);
        return result;
    }

    /**
     * Admin inventory endpoint. It deliberately reuses the same head query as
     * the doctor queue, but permits a bounded source-type filter so the admin
     * can submit the exact current revision/hash shown by the database.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> adminQueuePage(String rawType, String state, int page, int size) {
        String normalizedState = state == null || state.isBlank() || "ALL".equalsIgnoreCase(state.trim())
            ? null : state.trim().toUpperCase(Locale.ROOT);
        if (normalizedState != null && !Set.of("SUBMITTED", "APPROVED", "CHANGES_REQUESTED", "REVOKED", "EXPIRED", "DRAFT")
            .contains(normalizedState)) {
            throw error(400, "AI_CONTENT_STATE_INVALID", "Invalid review state");
        }
        String normalizedType = null;
        if (rawType != null && !rawType.isBlank()) normalizedType = type(rawType);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        String sql = """
            SELECT h.source_type, h.source_id, h.content_revision, h.content_hash,
                   h.eligibility_revision, h.eligibility_state, h.current_approval_round,
                   h.submitted_at, h.approved_at, h.approval_expires_at,
                   COALESCE(
                     CASE h.source_type
                       WHEN 'SPECIALTY' THEN (SELECT s.name FROM specialties s WHERE s.id = h.source_id)
                       WHEN 'ARTICLE' THEN (SELECT a.title FROM articles a WHERE a.id = h.source_id)
                       WHEN 'FAQ' THEN (SELECT f.question FROM faqs f WHERE f.id = h.source_id)
                     END,
                     CASE h.source_type
                       WHEN 'SPECIALTY' THEN 'Chuyên khoa chưa có tiêu đề'
                       WHEN 'ARTICLE' THEN 'Bài viết chưa có tiêu đề'
                       WHEN 'FAQ' THEN 'Câu hỏi thường gặp chưa có tiêu đề'
                       ELSE 'Nội dung bệnh viện'
                     END
                   ) AS title
              FROM ai_content_review_heads h
             WHERE 1 = 1
            """ + (normalizedState == null ? "" : " AND h.eligibility_state = ?")
                + (normalizedType == null ? "" : " AND h.source_type = ?") + """
             ORDER BY h.submitted_at NULLS LAST, h.source_type, h.source_id
             LIMIT ? OFFSET ?
            """;
        List<Object> args = new ArrayList<>();
        if (normalizedState != null) args.add(normalizedState);
        if (normalizedType != null) args.add(normalizedType);
        args.add(safeSize);
        args.add(safePage * safeSize);
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", rows.stream().map(this::summary).toList());
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("hasMore", rows.size() == safeSize);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> revision(String rawType, UUID sourceId, long revision) {
        String type = type(rawType);
        Map<String, Object> row = one("""
            SELECT source_type, source_id, content_revision, content_hash,
                   content_snapshot, created_by, created_at
              FROM ai_content_revisions
             WHERE source_type = ? AND source_id = ? AND content_revision = ?
            """, type, sourceId, revision);
        if (row == null) throw error(404, "AI_CONTENT_REVISION_NOT_FOUND", "Content revision not found");
        return revisionView(row);
    }

    @Transactional
    public Map<String, Object> decide(
            String rawType,
            UUID sourceId,
            long revision,
            long round,
            String rawDecision,
            String reason,
            org.springframework.security.core.userdetails.UserDetails principal) {
        String type = type(rawType);
        String decision = rawDecision == null ? "" : rawDecision.trim().toUpperCase(Locale.ROOT);
        if (!DECISIONS.contains(decision)) {
            throw error(400, "AI_CONTENT_DECISION_INVALID", "Invalid review decision");
        }
        if (("REQUEST_CHANGES".equals(decision) || "REVOKE".equals(decision))
                && (reason == null || reason.isBlank())) {
            throw error(400, "AI_CONTENT_REASON_REQUIRED", "A reason is required");
        }
        UUID reviewer = actorId(principal);
        // Lock the review head before resolving an implicit round.  Resolving
        // the round from an unlocked snapshot allowed a concurrent submit to
        // advance current_approval_round, after which this transaction could
        // decide an old round and overwrite the new head state.
        Map<String, Object> head = one("""
            SELECT content_revision, content_hash, eligibility_revision,
                   current_approval_round, eligibility_state
              FROM ai_content_review_heads
             WHERE source_type = ? AND source_id = ?
             FOR UPDATE
            """, type, sourceId);
        if (head == null
                || ((Number) head.get("content_revision")).longValue() != revision) {
            throw error(409, "AI_CONTENT_REVISION_STALE", "Content revision is stale");
        }
        if (round <= 0) {
            if (head.get("current_approval_round") == null) {
                throw error(404, "AI_CONTENT_NOT_SUBMITTED", "Review round not found");
            }
            round = ((Number) head.get("current_approval_round")).longValue();
        } else if (head.get("current_approval_round") == null
                || ((Number) head.get("current_approval_round")).longValue() != round) {
            throw error(409, "AI_CONTENT_REVISION_STALE", "Review round is stale");
        }
        Map<String, Object> row = one("""
            SELECT submitted_by, content_hash, state
              FROM ai_content_approval_rounds
             WHERE source_type = ? AND source_id = ? AND content_revision = ? AND approval_round = ?
             FOR UPDATE
            """, type, sourceId, revision, round);
        if (row == null) throw error(404, "AI_CONTENT_NOT_SUBMITTED", "Review round not found");
        String currentState = String.valueOf(row.get("state"));
        boolean revokingApproved = "REVOKE".equals(decision) && "APPROVED".equals(currentState);
        if (!"SUBMITTED".equals(currentState) && !revokingApproved) {
            throw error(409, "AI_CONTENT_ALREADY_DECIDED", "Review round has already been decided");
        }
        UUID submitter = (UUID) row.get("submitted_by");
        if (reviewer.equals(submitter)) {
            throw error(403, "AI_CONTENT_APPROVER_NOT_INDEPENDENT", "Approver must be independent");
        }
        if (!String.valueOf(row.get("content_hash")).equals(String.valueOf(head.get("content_hash")))) {
            throw error(409, "AI_CONTENT_REVISION_STALE", "Content revision is stale");
        }
        String targetState = switch (decision) {
            case "APPROVE" -> "APPROVED";
            case "REQUEST_CHANGES" -> "CHANGES_REQUESTED";
            default -> "REVOKED";
        };
        jdbc.update("""
            UPDATE ai_content_approval_rounds
               SET state = ?, reviewed_by = ?, reviewer_role = 'DOCTOR',
                   decided_at = CURRENT_TIMESTAMP,
                   expires_at = CASE WHEN ? = 'APPROVED'
                       THEN CURRENT_TIMESTAMP + INTERVAL '180 days' ELSE NULL END,
                   reason = ?
             WHERE source_type = ? AND source_id = ? AND content_revision = ? AND approval_round = ?
            """, targetState, reviewer, targetState, blankToNull(reason), type, sourceId, revision, round);
        long eligibility = ((Number) head.get("eligibility_revision")).longValue() + 1;
        jdbc.update("""
            UPDATE ai_content_review_heads
               SET eligibility_revision = ?, eligibility_state = ?, current_approval_round = ?,
                   approved_at = CASE WHEN ? = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END,
                   approval_expires_at = CASE WHEN ? = 'APPROVED'
                       THEN CURRENT_TIMESTAMP + INTERVAL '180 days' ELSE NULL END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE source_type = ? AND source_id = ?
            """, eligibility, targetState, round, targetState, targetState, type, sourceId);
        appendEvent(type, sourceId, revision, String.valueOf(row.get("content_hash")), eligibility, round,
            targetState, reviewer, "DOCTOR", blankToNull(reason));
        appendOutbox(type, sourceId, revision, eligibility, String.valueOf(row.get("content_hash")),
            "APPROVED".equals(targetState) ? "UPSERT" : "TOMBSTONE");
        return head(type, sourceId);
    }

    private void appendOutbox(
            String sourceType,
            UUID sourceId,
            long sourceRevision,
            long eligibilityRevision,
            String contentHash,
            String operation) {
        if (outboxService != null) {
            outboxService.append(
                sourceType, sourceId, sourceRevision, eligibilityRevision, contentHash, operation
            );
        }
    }

    private Map<String, Object> head(String type, UUID sourceId) {
        Map<String, Object> row = one("""
            SELECT source_type, source_id, content_revision, content_hash,
                   eligibility_revision, eligibility_state, current_approval_round,
                   submitted_at, approved_at, approval_expires_at,
                   COALESCE(
                     CASE source_type
                       WHEN 'SPECIALTY' THEN (SELECT s.name FROM specialties s WHERE s.id = source_id)
                       WHEN 'ARTICLE' THEN (SELECT a.title FROM articles a WHERE a.id = source_id)
                       WHEN 'FAQ' THEN (SELECT f.question FROM faqs f WHERE f.id = source_id)
                     END,
                     CASE source_type
                       WHEN 'SPECIALTY' THEN 'Chuyên khoa chưa có tiêu đề'
                       WHEN 'ARTICLE' THEN 'Bài viết chưa có tiêu đề'
                       WHEN 'FAQ' THEN 'Câu hỏi thường gặp chưa có tiêu đề'
                       ELSE 'Nội dung bệnh viện'
                     END
                   ) AS title
              FROM ai_content_review_heads
             WHERE source_type = ? AND source_id = ?
            """, type, sourceId);
        return row == null ? null : summary(row);
    }

    private Map<String, Object> summary(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sourceType", row.get("source_type"));
        result.put("sourceId", row.get("source_id"));
        result.put("title", row.getOrDefault("title", "Nội dung bệnh viện"));
        result.put("state", row.get("eligibility_state"));
        result.put("revision", row.get("content_revision"));
        result.put("contentHash", row.get("content_hash"));
        result.put("eligibilityRevision", row.get("eligibility_revision"));
        result.put("approvalRound", row.get("current_approval_round"));
        result.put("submittedAt", row.get("submitted_at"));
        result.put("approvedAt", row.get("approved_at"));
        result.put("expiresAt", row.get("approval_expires_at"));
        return result;
    }

    /** Normalize PostgreSQL JSONB driver shapes before crossing the HTTP
     * boundary. Depending on the JDBC configuration a JSONB value can arrive
     * as a Map, String, or PGobject; the browser contract is always an object. */
    private Map<String, Object> normalizeSnapshot(Object raw) {
        if (raw instanceof Map<?, ?> map) {
            Map<String, Object> normalized = new LinkedHashMap<>();
            map.forEach((key, value) -> normalized.put(String.valueOf(key), value));
            return normalized;
        }
        String json = null;
        if (raw != null) {
            // PostgreSQL is a runtime-scoped dependency in this service. Use
            // reflection for PGobject so compile-time contracts stay portable
            // while still extracting its JSON value when the driver supplies
            // that wrapper.
            if ("org.postgresql.util.PGobject".equals(raw.getClass().getName())) {
                try {
                    Object value = raw.getClass().getMethod("getValue").invoke(raw);
                    json = value == null ? null : String.valueOf(value);
                } catch (ReflectiveOperationException ignored) {
                    json = String.valueOf(raw);
                }
            } else {
                json = String.valueOf(raw);
            }
        }
        if (json != null && !json.isBlank()) {
            try {
                Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
                if (parsed != null) return parsed;
            } catch (Exception ignored) {
                // Fail closed below; raw JSONB/provider data never reaches UI.
            }
        }
        throw error(502, "AI_CONTENT_REVISION_INVALID", "Clinical content revision is invalid");
    }

    private Map<String, Object> revisionView(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sourceType", row.get("source_type"));
        result.put("sourceId", row.get("source_id"));
        result.put("revision", row.get("content_revision"));
        result.put("contentHash", row.get("content_hash"));
        result.put("snapshot", normalizeSnapshot(row.get("content_snapshot")));
        result.put("createdBy", row.get("created_by"));
        result.put("createdAt", row.get("created_at"));
        Map<String, Object> head = one("""
            SELECT eligibility_state, current_approval_round, approval_expires_at
              FROM ai_content_review_heads
             WHERE source_type = ? AND source_id = ?
               AND content_revision = ?
            """, row.get("source_type"), row.get("source_id"), row.get("content_revision"));
        if (head != null) {
            result.put("state", head.get("eligibility_state"));
            // The public FE contract treats the approval identifier as an
            // opaque string.  The database currently owns a numeric round;
            // never leak the driver-specific Long shape across the API.
            Object approvalRound = head.get("current_approval_round");
            result.put("approvalId", approvalRound == null ? null : String.valueOf(approvalRound));
            result.put("expiresAt", head.get("approval_expires_at"));
        } else {
            result.put("state", "DRAFT");
        }
        return result;
    }

    private void appendEvent(String type, UUID sourceId, long revision, String hash,
            long eligibility, long round, String eventType, UUID actor, String role, String reason) {
        jdbc.update("""
            INSERT INTO ai_content_review_events(
                event_id, source_type, source_id, content_revision, content_hash,
                eligibility_revision, approval_round, event_type, actor_id, actor_role,
                correlation_id, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, UUID.randomUUID(), type, sourceId, revision, hash, eligibility, round,
            eventType, actor, role, UUID.randomUUID(), reason);
    }

    private Map<String, Object> one(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : new LinkedHashMap<>(rows.get(0));
    }

    private String type(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (!TYPES.contains(value)) throw error(400, "AI_CONTENT_TYPE_INVALID", "Unsupported content type");
        return value;
    }

    private String normalizedHash(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (!value.matches("[0-9a-f]{64}")) throw error(400, "AI_CONTENT_HASH_INVALID", "Invalid content hash");
        return value;
    }

    private UUID actorId(org.springframework.security.core.userdetails.UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal hp) {
            return hp.getUserId();
        }
        if (principal == null || principal.getUsername() == null) {
            throw new BusinessException(401, "AUTHENTICATION_REQUIRED", "Authentication required");
        }
        User user = userRepository.findByEmail(principal.getUsername())
            .orElseThrow(() -> new BusinessException(401, "AUTHENTICATION_REQUIRED", "Authentication required"));
        return user.getId();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private BusinessException error(int status, String code, String message) {
        return new BusinessException(status, code, message);
    }
}
