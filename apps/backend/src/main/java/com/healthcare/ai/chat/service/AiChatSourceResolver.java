package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Re-resolves every AI identity against the live catalog.  The AI service can
 * suggest identities, but it cannot choose labels, links, revisions, or CTA
 * parameters.  Clinical rows additionally require a current independent
 * doctor approval in the database-owned review tables.
 */
@Service
public class AiChatSourceResolver {

    private static final Pattern SLUG = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9-]{0,219}$");
    private static final Set<String> SUPPORT_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package"
    );
    private static final Set<String> CLINICAL_TYPES = Set.of("specialty", "article", "faq");

    private final BranchRepository branchRepository;
    private final SpecialtyRepository specialtyRepository;
    private final DoctorRepository doctorRepository;
    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;
    private final ArticleRepository articleRepository;
    private final FaqRepository faqRepository;
    private final JdbcTemplate jdbc;

    public AiChatSourceResolver(
            BranchRepository branchRepository,
            SpecialtyRepository specialtyRepository,
            DoctorRepository doctorRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository,
            JdbcTemplate jdbc) {
        this.branchRepository = branchRepository;
        this.specialtyRepository = specialtyRepository;
        this.doctorRepository = doctorRepository;
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
        this.articleRepository = articleRepository;
        this.faqRepository = faqRepository;
        this.jdbc = jdbc;
    }

    /** Resolve AI retrieval candidates into exact source metadata for generate. */
    public List<ResolvedSource> authorize(ChatMode mode, Object rawCandidates) {
        if (!(rawCandidates instanceof List<?> candidates)) return List.of();
        List<ResolvedSource> resolved = new ArrayList<>();
        for (Object raw : candidates) {
            if (!(raw instanceof Map<?, ?> candidate)) continue;
            String type = text(candidate.get("source_type"));
            if (type == null) type = text(candidate.get("sourceType"));
            String id = text(candidate.get("source_id"));
            if (id == null) id = text(candidate.get("sourceId"));
            if (type == null || id == null) continue;
            ResolvedSource source = resolve(mode, type.toLowerCase(Locale.ROOT), id);
            if (source != null && resolved.stream().noneMatch(item -> item.key().equals(source.key()))) {
                resolved.add(source);
            }
            if (resolved.size() >= 20) break;
        }
        return List.copyOf(resolved);
    }

    /** Revalidate a source identity immediately before persistence/display. */
    public ResolvedSource revalidate(ChatMode mode, String type, String id) {
        if (type == null || id == null) return null;
        return resolve(mode, type.toLowerCase(Locale.ROOT), id);
    }

    /**
     * Revalidate the exact sources used for an answer at the persistence
     * linearization point.  Clinical sources are fenced with the same
     * per-source advisory lock used by the review/revision service, then the
     * catalog row, review head and current approval row are locked before the
     * live eligibility query runs.  A concurrent edit/revoke therefore either
     * completes before this check (and is detected as drift) or waits until the
     * answer transaction commits; an old approved context can never be
     * persisted after the lock is acquired.
     *
     * Operational sources are still re-resolved against the current catalog,
     * but do not take clinical review locks.  The returned list keeps the
     * caller's order so citations remain deterministic.  Any malformed,
     * duplicated, missing or drifted source fails closed as an empty list.
     */
    public List<ResolvedSource> revalidateForPersistence(
            ChatMode mode,
            List<ResolvedSource> expected) {
        if (expected == null || expected.isEmpty()) return List.of();

        Set<String> keys = new HashSet<>();
        for (ResolvedSource source : expected) {
            if (source == null || source.type() == null || source.id() == null
                    || !keys.add(source.key())) {
                return List.of();
            }
        }

        // Lock in stable order so two simultaneous conversations citing the
        // same clinical sources cannot deadlock by acquiring them in provider
        // ranking order.
        try {
            expected.stream()
                .filter(source -> isClinicalSource(mode, source))
                .sorted(Comparator.comparing(ResolvedSource::key))
                .forEach(source -> lockClinicalSource(source.type(), source.id()));

            List<ResolvedSource> current = new ArrayList<>(expected.size());
            for (ResolvedSource source : expected) {
                if (isClinicalMode(mode) && !isClinicalSource(mode, source)) {
                    return List.of();
                }
                ResolvedSource refreshed = revalidate(mode, source.type(), source.id());
                if (refreshed == null || !sameProvenance(source, refreshed)) {
                    return List.of();
                }
                current.add(refreshed);
            }
            return List.copyOf(current);
        } catch (RuntimeException ex) {
            // Governance/catalog availability is a hard deny.  Do not let a
            // transient SQL/lock error turn into an answer without provenance.
            return List.of();
        }
    }

    private boolean isClinicalMode(ChatMode mode) {
        return mode == ChatMode.SYMPTOM_TRIAGE || mode == ChatMode.HEALTH_EDUCATION;
    }

    private boolean isClinicalSource(ChatMode mode, ResolvedSource source) {
        return isClinicalMode(mode)
            && "CLINICAL".equals(source.projectionKind())
            && CLINICAL_TYPES.contains(source.type());
    }

    private void lockClinicalSource(String type, String id) {
        String table = switch (type) {
            case "specialty" -> "specialties";
            case "article" -> "articles";
            case "faq" -> "faqs";
            default -> throw new IllegalArgumentException("Unsupported clinical source");
        };
        // Catalog writers flush the source entity before taking the shared
        // advisory fence.  Acquire the row lock first to preserve that order
        // and avoid a resolver/writer cycle (advisory -> row vs row ->
        // advisory) while still fencing the review head below.
        if (jdbc.queryForList(
                "SELECT id FROM " + table + " WHERE id = CAST(? AS uuid) FOR UPDATE", id)
                .isEmpty()) {
            throw new IllegalStateException("Clinical source row is missing");
        }

        // This advisory key is deliberately identical to the key acquired by
        // AiClinicalContentRevisionService before mutating a governed source.
        jdbc.queryForList(
            "SELECT pg_advisory_xact_lock(hashtextextended(? || ':' || ?::text, 0))",
            type.toUpperCase(Locale.ROOT), id);

        List<Map<String, Object>> heads = jdbc.queryForList("""
            SELECT content_revision, content_hash, current_approval_round
              FROM ai_content_review_heads
             WHERE upper(source_type) = upper(?)
               AND source_id = CAST(? AS uuid)
             FOR UPDATE
            """, type, id);
        if (heads.isEmpty()) {
            throw new IllegalStateException("Clinical review head is missing");
        }
        Map<String, Object> head = heads.get(0);
        Object round = head.get("current_approval_round");
        if (round == null) {
            throw new IllegalStateException("Clinical approval round is missing");
        }
        if (jdbc.queryForList("""
            SELECT approval_round
              FROM ai_content_approval_rounds
             WHERE upper(source_type) = upper(?)
               AND source_id = CAST(? AS uuid)
               AND content_revision = ?
               AND content_hash = ?
               AND approval_round = ?
             FOR UPDATE
            """, type, id, head.get("content_revision"), head.get("content_hash"), round)
            .isEmpty()) {
            throw new IllegalStateException("Clinical approval row is missing");
        }
    }

    private boolean sameProvenance(ResolvedSource expected, ResolvedSource actual) {
        return java.util.Objects.equals(expected.type(), actual.type())
            && java.util.Objects.equals(expected.id(), actual.id())
            && java.util.Objects.equals(expected.projectionKind(), actual.projectionKind())
            && java.util.Objects.equals(expected.contentRevision(), actual.contentRevision())
            && java.util.Objects.equals(expected.eligibilityRevision(), actual.eligibilityRevision())
            && java.util.Objects.equals(expected.contentHash(), actual.contentHash())
            && java.util.Objects.equals(expected.approvalId(), actual.approvalId());
    }

    /**
     * Build citations from current catalog labels (never AI titles).
     *
     * The revision fields are deliberately persisted with the citation. They
     * are provenance metadata, not navigation data: the public response
     * strips them, while history reloads use them to detect a source that was
     * edited, revoked, or otherwise drifted since the answer was generated.
     */
    public List<Map<String, String>> citations(List<ResolvedSource> sources) {
        return sources.stream().map(source -> {
            Map<String, String> citation = new LinkedHashMap<>();
            citation.put("source_type", source.type());
            citation.put("source_id", source.id());
            citation.put("title", source.title());
            citation.put("projection_kind", source.projectionKind());
            if (source.contentRevision() != null) {
                citation.put("content_revision", Long.toString(source.contentRevision()));
            }
            if (source.eligibilityRevision() != null) {
                citation.put("eligibility_revision", Long.toString(source.eligibilityRevision()));
            }
            if (source.contentHash() != null) {
                citation.put("content_hash", source.contentHash());
            }
            if (source.approvalId() != null) {
                citation.put("approval_id", source.approvalId());
            }
            return Map.copyOf(citation);
        }).toList();
    }

    /** Build at most three closed-union actions from current catalog identity. */
    public List<Map<String, String>> actions(List<ResolvedSource> sources) {
        List<Map<String, String>> actions = new ArrayList<>();
        for (ResolvedSource source : sources) {
            addAction(actions, "VIEW_SOURCE", source.title(), source.viewHref());
            if (source.bookingHref() != null) {
                addAction(actions, "START_BOOKING", "Đặt lịch", source.bookingHref());
            }
            if (actions.size() >= 3) break;
        }
        return List.copyOf(actions);
    }

    /** Return a provider-ready exact allowlist (snake_case keys). */
    public List<Map<String, Object>> authorizedPayload(List<ResolvedSource> sources) {
        return sources.stream().map(source -> {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("source_type", source.type());
            value.put("source_id", source.id());
            value.put("projection_kind", source.projectionKind());
            if (source.contentRevision() != null) value.put("content_revision", source.contentRevision());
            if (source.eligibilityRevision() != null) value.put("eligibility_revision", source.eligibilityRevision());
            if (source.contentHash() != null) value.put("content_hash", source.contentHash());
            if (source.approvalId() != null) value.put("approval_id", source.approvalId());
            return value;
        }).toList();
    }

    private ResolvedSource resolve(ChatMode mode, String type, String id) {
        if (!isUuid(id)) return null;
        boolean clinical = mode == ChatMode.SYMPTOM_TRIAGE || mode == ChatMode.HEALTH_EDUCATION;
        if (mode == ChatMode.SYMPTOM_TRIAGE && !"specialty".equals(type)) return null;
        if (mode == ChatMode.HEALTH_EDUCATION && !("article".equals(type) || "faq".equals(type))) return null;
        if (clinical && !CLINICAL_TYPES.contains(type)) {
            return null;
        } else if (!clinical && !SUPPORT_TYPES.contains(type)) {
            return null;
        }

        ResolvedSource operational = resolveOperational(type, id);
        if (operational == null) return null;
        if (!clinical) return operational;
        if (!isClinicalEligible(type, id, operational.active(), operational.published())) return null;
        ReviewHead head = reviewHead(type, id);
        if (head == null) return null;
        return operational.withClinical(head);
    }

    private ResolvedSource resolveOperational(String type, String id) {
        UUID uuid;
        try {
            uuid = UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            return null;
        }
        return switch (type) {
            case "branch" -> branchRepository.findByIdAndActiveTrue(uuid)
                .map(value -> source(type, id, value.getName(), value.getSlug(), true, true))
                .orElse(null);
            case "specialty" -> specialtyRepository.findByIdAndActiveTrue(uuid)
                .map(value -> source(type, id, value.getName(), value.getSlug(), true, true))
                .orElse(null);
            case "doctor" -> doctorRepository.findById(uuid)
                .filter(Doctor::isActive)
                .map(value -> source(type, id, value.getFullName(), value.getSlug(), true, true))
                .orElse(null);
            case "service" -> serviceRepository.findById(uuid)
                .filter(MedicalService::isActive)
                .map(value -> source(type, id, value.getName(), value.getSlug(), true, true))
                .orElse(null);
            case "package" -> packageRepository.findByIdAndActiveTrue(uuid)
                .map(value -> source(type, id, value.getName(), value.getSlug(), true, true))
                .orElse(null);
            case "article" -> articleRepository.findById(uuid)
                .filter(Article::isActive)
                .map(value -> source(type, id, value.getTitle(), value.getSlug(), true, value.getPublishedAt() != null))
                .orElse(null);
            case "faq" -> faqRepository.findById(uuid)
                .filter(Faq::isActive)
                .map(value -> source(type, id, value.getQuestion(), null, true, true))
                .orElse(null);
            default -> null;
        };
    }

    private boolean isClinicalEligible(String type, String id, boolean active, boolean published) {
        if (!active || ("article".equals(type) && !published)) return false;
        return reviewHead(type, id) != null;
    }

    private ReviewHead reviewHead(String type, String id) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT h.content_revision, h.eligibility_revision, h.content_hash,
                       h.current_approval_round, r.expires_at::text AS expires_at
                  FROM ai_content_review_heads h
                  JOIN ai_content_approval_rounds r
                    ON r.source_type = h.source_type
                   AND r.source_id = h.source_id
                   AND r.content_revision = h.content_revision
                   AND r.content_hash = h.content_hash
                   AND r.approval_round = h.current_approval_round
                  JOIN users reviewer ON reviewer.id = r.reviewed_by
                  JOIN user_roles ur ON ur.user_id = reviewer.id
                  JOIN roles role ON role.id = ur.role_id AND role.code = 'DOCTOR'
                 WHERE upper(h.source_type) = upper(?)
                   AND h.source_id = CAST(? AS uuid)
                   AND h.eligibility_state = 'APPROVED'
                   AND r.state = 'APPROVED'
                   AND reviewer.status = 'ACTIVE'
                   AND r.expires_at > CURRENT_TIMESTAMP
                   -- The approved revision must still describe the live
                   -- catalog row.  A catalog edit that bypasses/reorders a
                   -- review hook therefore fails closed at authorization.
                   AND h.content_hash = encode(digest(convert_to((
                       CASE upper(h.source_type)
                         WHEN 'SPECIALTY' THEN (
                           SELECT jsonb_build_object(
                               'active', s.active,
                               'care_pathway', s.care_pathway,
                               'common_symptoms', s.common_symptoms,
                               'description', s.description,
                               'id', s.id::text,
                               'name', s.name,
                               'preparation_steps', s.preparation_steps,
                               'slug', s.slug
                           )::text
                             FROM specialties s WHERE s.id = h.source_id
                         )
                         WHEN 'ARTICLE' THEN (
                           SELECT jsonb_build_object(
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
                           )::text
                             FROM articles a WHERE a.id = h.source_id
                         )
                         WHEN 'FAQ' THEN (
                           SELECT jsonb_build_object(
                               'active', f.active,
                               'answer', f.answer,
                               'id', f.id::text,
                               'question', f.question
                           )::text
                             FROM faqs f WHERE f.id = h.source_id
                         )
                       END
                   ), 'UTF8'), 'sha256'), 'hex')
                 LIMIT 1
                """, type, id);
            if (rows.isEmpty()) return null;
            Map<String, Object> row = rows.get(0);
            return new ReviewHead(
                ((Number) row.get("content_revision")).longValue(),
                ((Number) row.get("eligibility_revision")).longValue(),
                String.valueOf(row.get("content_hash")),
                ((Number) row.get("current_approval_round")).longValue(),
                String.valueOf(row.get("expires_at")));
        } catch (RuntimeException ex) {
            // Missing/unavailable governance data is a hard deny, never an AI fallback.
            return null;
        }
    }

    private ResolvedSource source(String type, String id, String title, String slug,
            boolean active, boolean published) {
        String safeSlug = slug != null && SLUG.matcher(slug).matches() ? slug : null;
        String viewHref = switch (type) {
            case "branch" -> safeSlug == null ? null : "/branches/" + safeSlug;
            case "specialty" -> safeSlug == null ? null : "/specialties/" + safeSlug;
            case "doctor" -> safeSlug == null ? null : "/doctors/" + safeSlug;
            case "service" -> safeSlug == null ? null : "/services/" + safeSlug;
            case "package" -> safeSlug == null ? null : "/packages/" + safeSlug;
            case "article" -> safeSlug == null ? null : "/articles/" + safeSlug;
            case "faq" -> "/faq#faq-" + id;
            default -> null;
        };
        String bookingHref = switch (type) {
            case "branch" -> "/dat-lich?branchId=" + id;
            case "specialty" -> "/dat-lich?specialtyId=" + id;
            case "doctor" -> "/dat-lich?doctorId=" + id;
            case "package" -> "/dat-lich?packageId=" + id;
            default -> null;
        };
        return new ResolvedSource(type, id, title == null ? "Nguồn bệnh viện" : title.strip(),
            safeSlug, active, published, "OPERATIONAL", null, null, null, null, viewHref, bookingHref);
    }

    private void addAction(List<Map<String, String>> actions, String kind, String label, String href) {
        if (href == null || actions.size() >= 3) return;
        Map<String, String> action = new LinkedHashMap<>();
        action.put("kind", kind);
        action.put("label", label == null || label.isBlank() ? "Xem thông tin" : label);
        action.put("href", href);
        actions.add(Map.copyOf(action));
    }

    private boolean isUuid(String value) {
        try { UUID.fromString(value); return true; } catch (RuntimeException ex) { return false; }
    }

    private String text(Object value) {
        return value instanceof String text && !text.isBlank() ? text.strip() : null;
    }

    public record ResolvedSource(
        String type,
        String id,
        String title,
        String slug,
        boolean active,
        boolean published,
        String projectionKind,
        Long contentRevision,
        Long eligibilityRevision,
        String contentHash,
        String approvalId,
        String viewHref,
        String bookingHref
    ) {
        String key() { return type + ":" + id; }

        ResolvedSource withClinical(ReviewHead head) {
            return new ResolvedSource(type, id, title, slug, active, published, "CLINICAL",
                head.contentRevision(), head.eligibilityRevision(), head.contentHash(),
                Long.toString(head.approvalRound()), viewHref, bookingHref);
        }
    }

    private record ReviewHead(
        long contentRevision,
        long eligibilityRevision,
        String contentHash,
        long approvalRound,
        String expiresAt
    ) { }
}
