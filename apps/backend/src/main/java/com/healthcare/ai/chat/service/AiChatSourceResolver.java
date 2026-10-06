package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.LinkedHashSet;
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
    private static final int MAX_CATALOG_SAMPLES = 3;
    private static final int MAX_BRANCH_LOOKUP_ROWS = 100;
    private static final int MAX_DOCTOR_LOOKUP_ROWS = 100;
    /** Intent words that describe "find a doctor" but name no specialty. */
    private static final Set<String> DOCTOR_QUERY_STOPWORDS = Set.of(
        "bac", "si", "nao", "gioi", "ve", "tim", "danh", "sach", "thong", "tin",
        "muon", "xem", "doi", "ngu", "tot", "hay", "cho", "toi", "minh", "co",
        "khong", "benh", "vien", "o", "dau", "chuyen", "khoa", "gi"
    );
    private static final Pattern BRANCH_NUMBER = Pattern.compile(
        "\\b(?:co\\s+so|chi\\s+nhanh)(?:\\s+thu)?\\s+(?:so\\s+){0,2}(\\d+)\\b");
    private static final Pattern DISTRICT_ANCHOR = Pattern.compile("\\b(?:quan|huyen|phuong)\\s+[a-z0-9]+\\b");
    // Stopwords are limited to particles and attribute nouns that can
    // never be part of a branch name or address.  Place-name-capable
    // tokens (dien/thoai/la/dau/sao/dong/chu/tuan/nhat — e.g. "Sao Mai",
    // "La Khê", "Dầu Tiếng", "Điện Bàn") stay as identity terms on
    // purpose: dropping them would turn a toponym query like
    // "Cơ sở Sao Mai" into a single residual token that substring-matches
    // an unrelated branch on "Mai Chí Thọ".
    private static final Set<String> BRANCH_LOOKUP_STOPWORDS = Set.of(
        "bao", "benh", "chi", "cho", "co", "cua", "da", "den", "dia", "duoc", "gio",
        "healthcare", "hoat", "hoi", "kham", "lam", "may", "mo", "nhanh", "nhieu", "o", "so", "tai", "the",
        "thoi", "thu", "toi", "viec", "vien", "xem", "nao", "gi", "khong", "ngay"
    );
    private static final Set<String> SUPPORT_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package"
    );
    private static final Set<String> CLINICAL_TYPES = Set.of("specialty", "article", "faq");

    private final BranchRepository branchRepository;
    private final SpecialtyRepository specialtyRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;
    private final ArticleRepository articleRepository;
    private final FaqRepository faqRepository;
    private final JdbcTemplate jdbc;

    @org.springframework.beans.factory.annotation.Autowired
    public AiChatSourceResolver(
            BranchRepository branchRepository,
            SpecialtyRepository specialtyRepository,
            DoctorRepository doctorRepository,
            DoctorBranchRepository doctorBranchRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository,
            JdbcTemplate jdbc) {
        this.branchRepository = branchRepository;
        this.specialtyRepository = specialtyRepository;
        this.doctorRepository = doctorRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
        this.articleRepository = articleRepository;
        this.faqRepository = faqRepository;
        this.jdbc = jdbc;
    }

    /** Compatibility constructor for source-focused tests and older callers. */
    public AiChatSourceResolver(
            BranchRepository branchRepository,
            SpecialtyRepository specialtyRepository,
            DoctorRepository doctorRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository,
            JdbcTemplate jdbc) {
        this(branchRepository, specialtyRepository, doctorRepository, null,
            serviceRepository, packageRepository, articleRepository, faqRepository, jdbc);
    }

    /**
     * Converts the retrieval candidates returned by the AI service into exact,
     * mode-legal source identities, and drops everything else.
     *
     * <p>This is one half of the authorization invariant for a chat answer; the
     * other half is {@link #revalidateForPersistence(ChatMode, List)}. What this
     * method guarantees:
     *
     * <ul>
     *   <li><b>The mode decides the plane.</b> Each candidate is resolved
     *       through {@link #resolve(ChatMode, String, String)}, which refuses any
     *       source type the mode may not cite at all — SYMPTOM_TRIAGE accepts
     *       only specialties, HEALTH_EDUCATION only articles and FAQs. A public
     *       education answer therefore cannot cite a clinical source no matter
     *       what the retrieval layer proposed, and a hospital-support answer
     *       cannot cite one either: in non-clinical modes the resolver requires
     *       a type from the operational set and rejects the rest.</li>
     *   <li><b>Only rows that are still eligible survive.</b> A clinical source
     *       must additionally be live, published and backed by a review head,
     *       so an unpublished or never-approved catalog row is dropped rather
     *       than cited.</li>
     *   <li><b>Fail-closed.</b> Malformed candidates, unknown types, missing ids
     *       and unresolvable rows are skipped; a null or non-list argument yields
     *       an empty list. Nothing is inferred and nothing is passed through
     *       unverified, and a transient SQL/lock failure also yields an empty
     *       list instead of an answer without provenance.</li>
     *   <li><b>Bounded and deduplicated.</b> At most 20 distinct sources are
     *       authorized, keyed by type and id, so a provider cannot inflate the
     *       answer's citation set.</li>
     * </ul>
     *
     * <p>An identity authorized here is not yet a promise: the same identity is
     * re-resolved at the persistence linearization point, and a source that
     * changed, expired or was revoked in between fails the whole answer closed.
     */
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
            addAction(actions, "VIEW_SOURCE", viewActionLabel(source), source.viewHref());
            if (source.bookingHref() != null) {
                addAction(actions, "START_BOOKING", "Đặt lịch", source.bookingHref());
            }
            if (actions.size() >= 3) break;
        }
        return List.copyOf(actions);
    }

    private String viewActionLabel(ResolvedSource source) {
        if (source == null || source.type() == null) return "Xem thông tin";
        return switch (source.type().toLowerCase(Locale.ROOT)) {
            case "article" -> "Đọc bài viết";
            case "faq" -> "Xem câu trả lời";
            default -> source.title();
        };
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

    /**
     * Read a small, server-owned operational catalog snapshot for broad
     * visitor/patient navigation questions.  This is intentionally separate
     * from RAG retrieval: counts, labels and links come from the live Spring
     * catalog, while the AI service remains responsible for semantic search
     * and generation.  An unavailable catalog is represented as empty data so
     * callers can keep the normal fail-closed response.
     */
    public CatalogOverview catalogOverview() {
        try {
            Page<Specialty> specialties = specialtyRepository.findByActiveTrue(PageRequest.of(
                0, MAX_CATALOG_SAMPLES, Sort.by(Sort.Direction.ASC, "name")));
            Page<Branch> branches = branchRepository.findByActiveTrue(PageRequest.of(
                0, MAX_CATALOG_SAMPLES, Sort.by(Sort.Direction.ASC, "name")));
            if (specialties == null || branches == null) {
                return CatalogOverview.empty();
            }

            List<ResolvedSource> specialtySources = specialties.getContent().stream()
                .filter(Objects::nonNull)
                .map(value -> catalogSource("specialty", value.getId(), value.getName(), value.getSlug()))
                .filter(Objects::nonNull)
                .toList();
            List<ResolvedSource> branchSources = branches.getContent().stream()
                .filter(Objects::nonNull)
                .map(value -> catalogSource(
                    "branch", value.getId(), branchDisplayTitle(value), value.getSlug()))
                .filter(Objects::nonNull)
                .toList();
            return new CatalogOverview(
                boundedCount(specialties.getTotalElements()),
                boundedCount(branches.getTotalElements()),
                specialtySources,
                branchSources);
        } catch (RuntimeException ex) {
            return CatalogOverview.empty();
        }
    }

    /**
     * Deterministic opening-hours overview for generic branch questions that
     * carry no branch identity. Returns the first active branches in catalog
     * name order with their verified display fields, so the answer mirrors
     * the live public catalog instead of deflecting the visitor to a page.
     */
    public List<BranchDetails> activeBranchOverview(int limit) {
        int boundedLimit = Math.max(1, limit);
        try {
            Page<Branch> branches = branchRepository.findByActiveTrue(PageRequest.of(
                0, boundedLimit, Sort.by(Sort.Direction.ASC, "name")));
            if (branches == null || branches.getContent() == null) return List.of();

            List<BranchDetails> result = new ArrayList<>();
            for (Branch branch : branches.getContent()) {
                if (branch == null || !branch.isActive()) continue;
                ResolvedSource source = catalogSource(
                    "branch", branch.getId(), branchDisplayTitle(branch), branch.getSlug());
                if (source == null) continue;
                result.add(new BranchDetails(
                    source,
                    cleanBranchField(branch.getAddress(), 500),
                    cleanBranchField(branch.getWorkingHours(), 255),
                    cleanBranchField(branch.getPhone(), 100),
                    branchAmenities(branch)));
                if (result.size() >= boundedLimit) break;
            }
            return List.copyOf(result);
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    /**
     * Bounded live doctor list for degraded doctor-navigation answers.  The
     * optional specialty query is normalized and reduced to its non-intent
     * tokens ("Bác sĩ nào giỏi về da liễu?" → "da lieu"), then matched
     * conservatively against each active doctor's own name, bio and
     * achievements text: a doctor that never mentions the specialty is not
     * claimed as a match.  With no keyword left after normalization, the
     * bounded list is returned unfiltered.  An unavailable catalog yields an
     * empty list so the caller keeps its fail-closed fallback.
     */
    public List<ResolvedSource> activeDoctorOverview(int limit, String specialtyQuery) {
        int boundedLimit = Math.max(1, limit);
        try {
            Page<Doctor> doctors = doctorRepository.findByActiveTrue(PageRequest.of(
                0, MAX_DOCTOR_LOOKUP_ROWS, Sort.by(Sort.Direction.ASC, "fullName")));
            if (doctors == null || doctors.getContent() == null) return List.of();
            String keyword = doctorSpecialtyKeyword(specialtyQuery);

            List<ResolvedSource> result = new ArrayList<>();
            for (Doctor doctor : doctors.getContent()) {
                if (doctor == null || !doctor.isActive()) continue;
                if (keyword != null && !doctorMentionsKeyword(doctor, keyword)) continue;
                ResolvedSource source = catalogSource(
                    "doctor", doctor.getId(), doctorDisplayTitle(doctor), doctor.getSlug());
                if (source == null) continue;
                result.add(source);
                if (result.size() >= boundedLimit) break;
            }
            return List.copyOf(result);
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    private String doctorSpecialtyKeyword(String specialtyQuery) {
        String normalized = normalizeLookupText(specialtyQuery);
        if (normalized.isBlank()) return null;
        List<String> tokens = new ArrayList<>();
        for (String token : normalized.split(" ")) {
            if (token.isBlank() || DOCTOR_QUERY_STOPWORDS.contains(token)) continue;
            tokens.add(token);
        }
        return tokens.isEmpty() ? null : String.join(" ", tokens);
    }

    private boolean doctorMentionsKeyword(Doctor doctor, String keyword) {
        String identity = normalizeLookupText(
            (doctor.getFullName() == null ? "" : doctor.getFullName()) + " "
                + (doctor.getBio() == null ? "" : doctor.getBio()) + " "
                + (doctor.getAchievements() == null ? "" : doctor.getAchievements()));
        return identity.contains(keyword);
    }

    /**
     * Resolve a specific branch question against the live active catalog.
     * Matching is deliberately conservative: a branch number without a
     * unique locality remains ambiguous and returns every candidate so the
     * caller can fail closed instead of guessing.
     */
    public List<BranchDetails> branchDetails(String query) {
        String normalizedQuery = normalizeLookupText(query);
        if (normalizedQuery.isBlank()) return List.of();

        Set<Integer> requestedNumbers = branchNumbers(normalizedQuery);
        Set<String> locationAnchors = branchLocationAnchors(normalizedQuery);
        Set<String> identityTerms = branchIdentityTerms(normalizedQuery, locationAnchors, requestedNumbers);
        if (requestedNumbers.isEmpty() && locationAnchors.isEmpty()
                && (identityTerms.size() < 2 || GENERIC_BRANCH_ATTRIBUTE_TERMS.containsAll(identityTerms))) {
            // A lone residual token is too weak to name a branch: "Cơ sở
            // ở đâu?" reduces to "dau", which must defer rather than
            // substring-match an unrelated branch on "Đầu Mối".
            return List.of();
        }
        return branchDetailsByIdentity(requestedNumbers, locationAnchors, identityTerms);
    }

    /**
     * Scan the live catalog for the already-extracted identity.  Split
     * from {@link #branchDetails} so the amenity lane can subtract its own
     * vocabulary ("wifi", "bãi xe") from the residual terms — otherwise a
     * branch whose name is all attribute-words ("Cơ sở Sân Bay") could
     * never resolve, and the amenity phrase itself would wrongly become a
     * required name token.
     */
    private List<BranchDetails> branchDetailsByIdentity(
            Set<Integer> requestedNumbers,
            Set<String> locationAnchors,
            Set<String> identityTerms) {
        try {
            Page<Branch> branches = branchRepository.findByActiveTrue(PageRequest.of(
                0, MAX_BRANCH_LOOKUP_ROWS, Sort.by(Sort.Direction.ASC, "name")));
            if (branches == null || branches.getContent() == null) return List.of();

            List<BranchDetails> matches = new ArrayList<>();
            for (Branch branch : branches.getContent()) {
                if (branch == null || !branch.isActive() || !matchesBranch(
                        branch, requestedNumbers, locationAnchors, identityTerms)) {
                    continue;
                }
                ResolvedSource source = catalogSource(
                    "branch", branch.getId(), branchDisplayTitle(branch), branch.getSlug());
                if (source == null) continue;
                matches.add(new BranchDetails(
                    source,
                    cleanBranchField(branch.getAddress(), 500),
                    cleanBranchField(branch.getWorkingHours(), 255),
                    cleanBranchField(branch.getPhone(), 100),
                    branchAmenities(branch)));
                if (matches.size() >= MAX_BRANCH_LOOKUP_ROWS) break;
            }
            return List.copyOf(matches);
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    private static final Set<String> BRANCH_NOUN_KEYWORDS = Set.of(
        "co so", "chi nhanh", "phong kham", "tru so"
    );

    private boolean containsBranchNoun(String normalizedQuery) {
        for (String noun : BRANCH_NOUN_KEYWORDS) {
            if (normalizedQuery.contains(noun)) return true;
        }
        return false;
    }

    /**
     * Return whether a branch question contains an explicit identity or
     * locality constraint.  This lets public and authenticated chat callers
     * stop before generic RAG retrieval when the live catalog must decide
     * between an exact row, multiple rows, or no row at all.
     */
    public boolean isSpecificBranchQuery(String query) {
        String normalizedQuery = normalizeLookupText(query);
        if (normalizedQuery.isBlank()) return false;
        Set<Integer> requestedNumbers = branchNumbers(normalizedQuery);
        Set<String> locationAnchors = branchLocationAnchors(normalizedQuery);
        if (!requestedNumbers.isEmpty() || !locationAnchors.isEmpty()) {
            return true;
        }
        if (!containsBranchNoun(normalizedQuery)) {
            return false;
        }
        Set<String> identityTerms = branchIdentityTerms(
            normalizedQuery, locationAnchors, requestedNumbers);
        return identityTerms.size() >= 2
            && !GENERIC_BRANCH_ATTRIBUTE_TERMS.containsAll(identityTerms);
    }

    /**
     * Attribute cues for a branch question that does not itself carry an
     * identity — the marker for a follow-up ("Còn số điện thoại thì
     * sao?") whose referent must come from conversation history.
     */
    private static final String[] BRANCH_ATTRIBUTE_CUES = {
        "dien thoai", "so dt", "sdt", "hotline", "lien lac", "lien he",
        "dia chi", "o dau", "gio lam", "gio kham", "gio hoat dong",
        "lam viec", "mo cua", "may gio",
        // Facility/amenity attributes — a follow-up like "Còn chỗ đậu xe
        // thì sao?" asks for a branch fact, not a clinical input.
        "dau xe", "do xe", "bai xe", "gui xe", "giu xe", "nha xe", "san xe",
        "cho dau", "cho do", "dau oto", "do oto", "nha thuoc", "quay thuoc",
        "wifi", "atm", "rut tien", "can tin", "nha an", "phong cho",
        "khu vuc cho", "tien ich",
        // "giat la"/"giat do" are absent: as substring they collide with the
        // clinical "giật lại"/"giật do X" after folding — the dedicated
        // LAUNDRY_QUERY_CUE pattern below matches them token-bounded and
        // continuation-gated instead (Wukong wave-14 CE: "be giat lai"
        // misrouted to the laundry lane).
        "giat ui", "co giat", "dich vu giat",
    };

    /**
     * Return whether the message asks for a branch attribute (phone,
     * address, opening hours) without necessarily naming a branch.
     */
    public boolean hasBranchAttributeCue(String query) {
        String normalized = normalizeLookupText(query);
        if (LAUNDRY_QUERY_CUE.matcher(normalized).find()) return true;
        for (String cue : BRANCH_ATTRIBUTE_CUES) {
            if (normalized.contains(cue)) return true;
        }
        return false;
    }

    /**
     * Amenity groups keyed by the facility a visitor asks about.  Each
     * inner array lists the normalized label keywords accepted as that
     * amenity inside a branch's {@code amenities} JSON — "đậu xe" and
     * "đỗ xe" are different spellings of the same facility.
     */
    private static final String[][] AMENITY_LABEL_KEYWORDS = {
        {"bai dau xe", "bai do xe", "bai xe", "dau xe", "do xe", "gui xe",
            "giu xe", "nha xe", "san xe", "cho dau xe", "cho do xe",
            "khu dau xe", "khu do xe", "dau oto", "do oto", "dau o to",
            "do o to", "parking"},
        {"nha thuoc", "quay thuoc", "thuoc tay", "cua hang thuoc", "pharmacy"},
        {"wifi", "wi fi", "internet", "mang wifi", "mang internet"},
        {"atm", "cay atm", "may rut tien", "rut tien"},
        {"can tin", "canteen", "nha an", "quay an", "quay tu phuc vu",
            "bua an", "do an"},
        {"phong cho", "khu vuc cho", "ghe cho", "sanh cho", "noi cho", "khu cho"},
        {"giat ui", "giat la", "giat do", "giat quan ao", "giat giu",
            "giat khan", "giat say", "giat hap", "giat tham", "giat cong nghiep",
            "dich vu giat", "phong giat", "laundry"},
    };
    private static final String[] AMENITY_TYPES = {
        "parking", "pharmacy", "wifi", "atm", "canteen", "waiting", "laundry"
    };
    /**
     * Explicit "every branch" scope phrases — "các cơ sở", "tất cả chi
     * nhánh", "mọi phòng khám".  These questions name no identity, so an
     * amenity lookup that resolves nothing must scan the catalog rather
     * than fail closed as a named-but-missing branch.  Deliberately
     * multi-word: single tokens like "mới" or "tùng" can be real branch
     * names and never trigger this.
     */
    private static final Pattern GENERIC_BRANCH_SCOPE = Pattern.compile(
        "\\b(?:cac|moi|tung|toan bo|het|tat ca)\\s+"
            + "(?:co so|chi nhanh|phong kham|benh vien|tru so)\\b"
            + "|\\btat ca\\s+(?:cac\\s+)?(?:co so|chi nhanh|phong kham|benh vien)\\b");
    /** Normalized query phrases mapped to the same amenity type ordering. */
    private static final String[][] AMENITY_QUERY_PHRASES = {
        {"dau xe", "do xe", "bai xe", "gui xe", "giu xe", "nha xe", "san xe",
            "xe dau", "xe do", "xe gui", "xe giu",
            "xe may dau", "xe may do", "xe dap dau", "xe dap do",
            "xe tay ga dau", "xe tay ga do", "xe tai dau", "xe tai do",
            "xe buyt dau", "xe buyt do", "xe bus dau", "xe bus do",
            "xe hoi dau", "xe hoi do", "xe om dau", "xe om do",
            "xe dien dau", "xe dien do", "xe khach dau", "xe khach do",
            "xe ba gac dau", "xe ba gac do",
            "oto dau", "oto do", "o to dau", "o to do",
            "moto dau", "moto do", "mo to dau", "mo to do",
            "de xe o", "xe de o",
            "xe may de o", "xe dap de o", "xe tay ga de o", "xe tai de o",
            "xe buyt de o", "xe bus de o", "xe hoi de o", "xe om de o",
            "xe dien de o", "xe khach de o", "xe ba gac de o",
            "oto de o", "o to de o", "moto de o", "mo to de o",
            "cho de xe", "noi de xe", "khu de xe",
            "cho de oto", "cho de o to", "noi de oto",
            "cho dau xe", "cho do xe", "khu dau xe", "khu do xe",
            "cho dau oto", "cho do oto", "cho dau o to", "cho do o to",
            "dau oto", "do oto", "dau o to", "do o to", "parking"},
        {"nha thuoc", "quay thuoc", "cua hang thuoc"},
        {"wifi", "wi fi", "internet"},
        {"atm", "cay atm", "may rut tien", "rut tien"},
        {"can tin", "canteen", "nha an", "quay an", "quay tu phuc vu"},
        {"phong cho", "khu vuc cho", "ghe cho", "noi cho", "cho ngoi"},
        // Laundry phrasings reach here only after the emergency gate
        // already passed — "co giat" is the laundry reading in this lane.
        // "giat la"/"giat do" are handled by LAUNDRY_QUERY_CUE instead of
        // substring: "be giat lai" / "giat do chan thuong" are clinical
        // convulsion reports that must never classify as amenity (Wukong
        // wave-14 CE).
        {"giat ui", "giat quan ao", "giat giu", "giat khan", "giat say",
            "giat hap", "giat tham", "giat cong nghiep", "co giat",
            "dich vu giat", "phong giat", "laundry"},
    };
    /**
     * Token-bounded laundry cues for the two collision-prone phrases.
     * "giat la" needs a word boundary so "giật lại" stays clinical;
     * "giat do" additionally requires clause end or a laundry continuation
     * (the same unit list as the emergency co-giat suppression) so
     * "giật do chấn thương / bị ngã / tiền sử" stays out of this lane.
     */
    private static final Pattern LAUNDRY_QUERY_CUE = Pattern.compile(
        "\\bgiat\\s+la\\b"
            + "|\\bgiat\\s+do\\b(?:\\W*$|\\W+(?:khong|ko|a|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|thue|"
            + "o\\W+dau|o\\W+day|the\\W*nao|nhu\\W*the\\W*nao|mien\\W*phi|phi|dich\\W*vu|"
            + "gia|bao\\W*nhieu|cho\\W+(?:khach|nguoi|benh\\W*nhan|minh|toi|em|anh|chi|con|me|ba|ong)))",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /**
     * Classify the amenity a normalized question asks about, or
     * {@code "generic"} for a facilities overview ("có tiện ích gì"),
     * or {@code null} when the question mentions no amenity at all.
     */
    public String amenityType(String query) {
        String normalized = normalizeLookupText(query);
        if (normalized.isBlank()) return null;
        if (LAUNDRY_QUERY_CUE.matcher(normalized).find()) return "laundry";
        for (int i = 0; i < AMENITY_TYPES.length; i++) {
            for (String phrase : AMENITY_QUERY_PHRASES[i]) {
                if (normalized.contains(phrase)) return AMENITY_TYPES[i];
            }
        }
        if (normalized.contains("tien ich") || normalized.contains("tien nghi")) {
            return "generic";
        }
        return null;
    }

    /** Markers that classify the generic facilities-overview question. */
    private static final String[] GENERIC_AMENITY_MARKERS = {"tien ich", "tien nghi"};

    /**
     * Every amenity-vocabulary token present in the question for the
     * classified type.  ResolveAmenity subtracts ALL of them — not just the
     * first matching phrase — so a leading token like {@code bai} in "cơ sở
     * Sân Bay có bãi đậu xe không" or the {@code tien ich} marker in a
     * facilities overview cannot poison the residual branch identity.
     */
    private java.util.Set<String> matchedAmenityTokens(
            String normalizedQuery, String amenityType) {
        java.util.Set<String> tokens = new java.util.HashSet<>();
        if (normalizedQuery == null || amenityType == null) return tokens;
        if ("generic".equals(amenityType)) {
            for (String marker : GENERIC_AMENITY_MARKERS) {
                if (normalizedQuery.contains(marker)) {
                    for (String token : marker.split(" ")) tokens.add(token);
                }
            }
            return tokens;
        }
        for (int i = 0; i < AMENITY_TYPES.length; i++) {
            if (!AMENITY_TYPES[i].equals(amenityType)) continue;
            for (String phrase : AMENITY_QUERY_PHRASES[i]) {
                if (normalizedQuery.contains(phrase)) {
                    for (String token : phrase.split(" ")) tokens.add(token);
                }
            }
        }
        // LAUNDRY_QUERY_CUE matches live outside AMENITY_QUERY_PHRASES — its
        // tokens ("giat do cho khach") must still be subtracted or they
        // poison the residual branch identity (wave-14 CI regression:
        // "cơ sở có giặt đồ cho khách không?" resolved a false specific
        // identity instead of scanning the catalog).
        if ("laundry".equals(amenityType)) {
            java.util.regex.Matcher cue = LAUNDRY_QUERY_CUE.matcher(normalizedQuery);
            while (cue.find()) {
                for (String token : cue.group().split("\\s+")) tokens.add(token);
            }
        }
        return tokens;
    }

    /** Vietnamese display name used inside deterministic amenity answers. */
    public String amenityDisplayName(String amenityType) {
        if (amenityType == null) return "tiện ích";
        return switch (amenityType) {
            case "parking" -> "bãi đậu xe/chỗ đỗ xe";
            case "pharmacy" -> "nhà thuốc";
            case "wifi" -> "Wi-Fi";
            case "atm" -> "ATM/máy rút tiền";
            case "canteen" -> "căn tin/quầy ăn uống";
            case "waiting" -> "khu vực chờ";
            case "laundry" -> "dịch vụ giặt ủi/giặt đồ";
            default -> "tiện ích";
        };
    }

    /**
     * Original amenity labels on a branch matching the requested type.
     * Returned verbatim ("Bãi đỗ xe") so answers quote catalog facts
     * instead of a model's paraphrase; {@code generic} returns all labels.
     */
    public List<String> matchedAmenityLabels(BranchDetails branch, String amenityType) {
        if (branch == null || branch.amenities() == null) return List.of();
        if ("generic".equals(amenityType)) return branch.amenities();
        int index = -1;
        for (int i = 0; i < AMENITY_TYPES.length; i++) {
            if (AMENITY_TYPES[i].equals(amenityType)) {
                index = i;
                break;
            }
        }
        if (index < 0) return List.of();
        List<String> labels = new ArrayList<>();
        for (String label : branch.amenities()) {
            if (label == null) continue;
            String normalizedLabel = normalizeLookupText(label);
            for (String keyword : AMENITY_LABEL_KEYWORDS[index]) {
                if (normalizedLabel.contains(keyword)) {
                    labels.add(label);
                    break;
                }
            }
        }
        return List.copyOf(labels);
    }

    /** Whether the normalized query scopes to every branch explicitly. */
    private boolean hasGenericBranchScope(String normalizedQuery) {
        return GENERIC_BRANCH_SCOPE.matcher(normalizedQuery).find();
    }

    /**
     * Resolve an amenity question against the live catalog.  A question
     * naming a branch resolves that branch's own amenities; a generic
     * question scans every active branch.  Only rows that actually carry
     * the requested facility land in {@code matches} — an amenity the
     * catalog does not advertise must fail honestly, not be implied.
     */
    public AmenityResolution resolveAmenity(String query) {
        String type = amenityType(query);
        if (type == null) return null;
        boolean specific;
        List<BranchDetails> resolved;
        List<BranchDetails> candidates;
        try {
            String normalized = normalizeLookupText(query);
            // Amenity-aware specificity: strip the matched amenity phrase's
            // tokens before judging the residual identity, so "cơ sở có bãi
            // đỗ xe" scans generically while "cơ sở Sân Bay có wifi" keeps
            // its (all-toponym) name for the specific branch lookup.
            Set<Integer> requestedNumbers = branchNumbers(normalized);
            Set<String> locationAnchors = branchLocationAnchors(normalized);
            Set<String> identity = new java.util.HashSet<>(
                branchIdentityTerms(normalized, locationAnchors, requestedNumbers));
            identity.removeAll(matchedAmenityTokens(normalized, type));
            if (!requestedNumbers.isEmpty() || !locationAnchors.isEmpty()) {
                specific = true;
            } else {
                specific = containsBranchNoun(normalized)
                    && identity.size() >= 2
                    && !GENERIC_BRANCH_ATTRIBUTE_TERMS.containsAll(identity);
            }
            if (specific) {
                resolved = branchDetailsByIdentity(requestedNumbers, locationAnchors, identity);
                if ((resolved == null || resolved.isEmpty())
                        && hasGenericBranchScope(normalized)) {
                    // "các cơ sở", "tất cả chi nhánh" scope to EVERY branch —
                    // no concrete identity exists to fail closed on, so scan
                    // the whole active catalog instead.
                    specific = false;
                    resolved = List.of();
                    candidates = activeBranchOverview(MAX_BRANCH_LOOKUP_ROWS);
                } else {
                    candidates = resolved;
                }
            } else {
                resolved = List.of();
                candidates = activeBranchOverview(MAX_BRANCH_LOOKUP_ROWS);
            }
        } catch (RuntimeException ex) {
            return null;
        }
        if (specific && (resolved == null || resolved.isEmpty())) {
            return new AmenityResolution(type, List.of(), List.of(), true, false);
        }
        if (candidates == null) candidates = List.of();
        List<BranchDetails> matches = new ArrayList<>();
        int totalMatched = 0;
        for (BranchDetails branch : candidates) {
            if (branch == null || branch.source() == null) continue;
            if (matchedAmenityLabels(branch, type).isEmpty()) continue;
            totalMatched++;
            if (matches.size() < 3) matches.add(branch);
        }
        if (matches.isEmpty() && !catalogReachable()) {
            // An outage must not masquerade as an empty catalog: asserting
            // "no branch advertises X" requires the catalog to have
            // actually answered the scan, not failed underneath it.
            return null;
        }
        return new AmenityResolution(
            type, List.copyOf(matches), resolved == null ? List.of() : resolved,
            specific, totalMatched > matches.size());
    }

    /**
     * Cheap liveness probe for the branch catalog.  {@link #branchDetails}
     * and {@link #activeBranchOverview} swallow repository failures into
     * empty lists, so a caller about to assert an absence uses this to
     * distinguish "the catalog answered and nothing matched" from "the
     * catalog could not answer at all".
     */
    private boolean catalogReachable() {
        try {
            return branchRepository.findByActiveTrue(
                PageRequest.of(0, 1)) != null;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    /** Read the branch's amenities JSON into bounded display labels. */
    private List<String> branchAmenities(Branch branch) {
        com.fasterxml.jackson.databind.JsonNode amenities =
            branch == null ? null : branch.getAmenities();
        if (amenities == null || !amenities.isArray()) return List.of();
        List<String> labels = new ArrayList<>();
        for (com.fasterxml.jackson.databind.JsonNode node : amenities) {
            if (node == null || !node.isTextual()) continue;
            String label = cleanBranchField(node.asText(), 120);
            if (label != null && !label.isBlank()) labels.add(label);
        }
        return List.copyOf(labels);
    }

    /**
     * Walk conversation history backwards and return the content of the
     * most recent user turn that carried an explicit branch identity, or
     * {@code null}.  Assistant turns are ignored so an earlier generic
     * navigation reply cannot become the referent.  The caller resolves
     * the returned turn itself so a named-but-unresolvable referent can
     * still fail closed instead of silently picking an older branch.
     */
    public String latestSpecificBranchUserTurn(List<Map<String, String>> turns) {
        if (turns == null || turns.isEmpty()) return null;
        int scanned = 0;
        for (int i = turns.size() - 1; i >= 0 && scanned < 8; i--) {
            Map<String, String> turn = turns.get(i);
            if (turn == null || !"user".equalsIgnoreCase(turn.get("role"))) continue;
            scanned++;
            String content = turn.get("content");
            if (content == null || content.isBlank()) continue;
            try {
                // A bare locality mention ("Tôi ở quận 1") is not a
                // branch question and must not become a referent —
                // but an anchor-bearing question about branch facts
                // ("Quận 7 mở cửa mấy giờ?") is a valid referent even
                // without a branch noun.
                if (isSpecificBranchQuery(content)
                        && (containsBranchNoun(normalizeLookupText(content))
                            || hasBranchAttributeCue(content))) {
                    return content;
                }
            } catch (RuntimeException ignored) {
                return null;
            }
        }
        return null;
    }

    /**
     * Words that only describe the asked attribute (phone, address,
     * hours, contact, schedule) or the question itself — never a branch
     * name.  When every residual identity term is one of these, the
     * question is generic ("Số điện thoại cơ sở là gì?") and must defer
     * instead of hard-failing as a specific-but-unresolvable lookup.
     */
    private static final Set<String> GENERIC_BRANCH_ATTRIBUTE_TERMS = Set.of(
        "dien", "thoai", "dt", "sdt", "hotline", "la", "dia", "chi", "gio",
        "lam", "viec", "mo", "cua", "lien", "he", "nhat", "chu", "tuan",
        "cuoi", "dau", "phong", "may", "thu", "hen", "truc",
        // Amenity/service nouns — "cơ sở có bãi xe/nhà thuốc không" is a
        // generic facilities question, not a specific branch lookup.
        // "bay" is excluded: it only ever appears inside the toponym
        // "sân bay", which is a legitimate branch-name component.
        "bai", "xe", "nha", "thuoc", "wifi", "san", "gan",
        // Connectives and schedule nouns that never name a branch.
        "hay", "phai", "ma", "va", "hoac", "dong", "hoat");

    private boolean matchesBranch(
            Branch branch,
            Set<Integer> requestedNumbers,
            Set<String> locationAnchors,
            Set<String> identityTerms) {
        String identity = normalizeLookupText(
            (branch.getName() == null ? "" : branch.getName()) + " "
                + (branch.getAddress() == null ? "" : branch.getAddress()));
        if (!requestedNumbers.isEmpty() && !branchHasAnyNumber(identity, requestedNumbers)) return false;
        // Multiple anchors are disjunctive ("quận 1 hay quận 7" lists
        // both districts' branches) while a number plus an anchor stays
        // conjunctive across dimensions ("cơ sở 2 ở Quận 3").
        if (!locationAnchors.isEmpty()
                && locationAnchors.stream()
                    .noneMatch(anchor -> identityMatchesAnchor(identity, anchor))) {
            return false;
        }
        if (!requestedNumbers.isEmpty()) {
            // Explicit branch numbers are the identity by themselves —
            // connective/attribute words in the same question ("không
            // phải cơ sở 4 mà cơ sở 17") must not be required inside
            // the branch name.
            return true;
        }
        if (!locationAnchors.isEmpty()) {
            // A locality anchor is the identity; attribute words and
            // copulas are ignored — but a residual NON-attribute token
            // still identifies ("Sài Gòn Xanh" rewrites to a city anchor
            // and keeps "xanh" as its real name term).
            return identityTerms.stream()
                .filter(term -> !GENERIC_BRANCH_ATTRIBUTE_TERMS.contains(term))
                .allMatch(identity::contains);
        }
        // Attribute/amenity vocabulary ("bãi", "xe", "sân") can linger in
        // the residual identity after phrase subtraction ("cơ sở Sân Bay có
        // bãi đậu xe") — those tokens describe the asked facility, never the
        // branch name, so they must not be required inside it.
        return identityTerms.stream()
            .filter(term -> !GENERIC_BRANCH_ATTRIBUTE_TERMS.contains(term))
            .allMatch(identity::contains);
    }

    private boolean branchHasAnyNumber(String normalizedIdentity, Set<Integer> requestedNumbers) {
        var matcher = BRANCH_NUMBER.matcher(normalizedIdentity);
        while (matcher.find()) {
            String group = matcher.group(1);
            if (group.length() <= 9
                    && requestedNumbers.contains(Integer.parseInt(group))) return true;
        }
        return false;
    }

    /**
     * Extract every branch number the question names.  A question that
     * names two different numbers ("cơ sở 4 hay cơ sở 17", "không phải
     * cơ sở 4 mà cơ sở 17") is ambiguous by construction — the caller
     * must see both candidates instead of silently taking the first.
     */
    private Set<Integer> branchNumbers(String normalizedQuery) {
        Set<Integer> numbers = new LinkedHashSet<>();
        var matcher = BRANCH_NUMBER.matcher(normalizedQuery);
        while (matcher.find()) {
            String group = matcher.group(1);
            if (group.length() <= 9) numbers.add(Integer.valueOf(group));
        }
        return numbers;
    }

    /**
     * Word-boundary anchor match so "quan 1" does not substring-match
     * inside "quan 11" or "quan 12".
     */
    private boolean identityMatchesAnchor(String normalizedIdentity, String anchor) {
        return Pattern.compile("\\b" + Pattern.quote(anchor) + "\\b")
            .matcher(normalizedIdentity)
            .find();
    }

    private Set<String> branchLocationAnchors(String normalizedQuery) {
        Set<String> anchors = new LinkedHashSet<>();
        var districtMatcher = DISTRICT_ANCHOR.matcher(normalizedQuery);
        while (districtMatcher.find()) anchors.add(districtMatcher.group());
        for (String locality : List.of("thu duc", "ha noi", "da nang", "can tho", "ho chi minh")) {
            if (normalizedQuery.contains(locality)) anchors.add(locality);
        }
        return Set.copyOf(anchors);
    }

    private Set<String> branchIdentityTerms(
            String normalizedQuery,
            Set<String> locationAnchors,
            Set<Integer> requestedNumbers) {
        Set<String> locationTokens = new HashSet<>();
        for (String anchor : locationAnchors) locationTokens.addAll(List.of(anchor.split(" ")));
        Set<String> terms = new LinkedHashSet<>();
        for (String token : normalizedQuery.split(" ")) {
            if (token.isBlank() || token.length() < 2 || BRANCH_LOOKUP_STOPWORDS.contains(token)
                    || locationTokens.contains(token)
                    || (requestedNumbers != null && token.length() <= 9
                        && token.chars().allMatch(Character::isDigit)
                        && requestedNumbers.contains(Integer.valueOf(token)))) {
                continue;
            }
            terms.add(token);
        }
        return Set.copyOf(terms);
    }

    private String normalizeLookupText(String value) {
        if (value == null) return "";
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .toLowerCase(Locale.ROOT);
        String normalized = decomposed.replaceAll("[^a-z0-9]+", " ").strip().replaceAll("\\s+", " ");
        return normalized
            .replaceAll("\\b(?:tp|thanh pho)\\s+(?:hcm|ho chi minh)\\b", "ho chi minh")
            .replaceAll("\\btphcm\\b", "ho chi minh")
            .replaceAll("\\bhcm\\b", "ho chi minh")
            .replaceAll("\\bsai gon\\b", "ho chi minh")
            .replaceAll("\\s+", " ")
            .strip();
    }

    private String cleanBranchField(String value, int maxLength) {
        if (value == null) return null;
        String clean = value.strip();
        // Bracket/angle markup never legitimately appears in catalog
        // contact fields; without this an admin-entered value like
        // "[Gọi](tel:1900X)" would survive into the composed chat answer
        // and render as a live link in the frontend markdown renderer.
        if (clean.isEmpty() || clean.length() > maxLength
                || clean.chars().anyMatch(Character::isISOControl)
                || clean.matches(".*[\\[\\]<>`].*")) {
            return null;
        }
        return clean;
    }

    private ResolvedSource catalogSource(String type, UUID id, String title, String slug) {
        String cleanTitle = cleanCatalogTitle(title);
        if (id == null || cleanTitle == null) return null;
        return source(type, id.toString(), cleanTitle, slug, true, true);
    }

    private String cleanCatalogTitle(String value) {
        if (value == null) return null;
        String clean = value.strip();
        // The title is embedded verbatim into composed chat answers and
        // rendered as inline markdown, so bracket/angle markup in an
        // admin-entered catalog name would otherwise become a live link.
        if (clean.isEmpty() || clean.length() > 300
                || clean.chars().anyMatch(Character::isISOControl)
                || clean.matches(".*[\\[\\]<>`].*")) {
            return null;
        }
        return clean;
    }

    private int boundedCount(long value) {
        return (int) Math.min(Math.max(0L, value), Integer.MAX_VALUE);
    }

    ResolvedSource resolve(ChatMode mode, String type, String id) {
        if (mode == ChatMode.SYMPTOM_TRIAGE && !"specialty".equals(type)) return null;
        if (mode == ChatMode.HEALTH_EDUCATION && !("article".equals(type) || "faq".equals(type))) return null;
        if (isUuid(id)) {
            boolean clinical = mode == ChatMode.SYMPTOM_TRIAGE || mode == ChatMode.HEALTH_EDUCATION;
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
        // The hospital knowledge plane keys its documents by stable document
        // ids (faq-*, bv-*, br-*), not catalog UUIDs, so catalog lookups cannot
        // see them even though both planes share one database. HOSPITAL_SUPPORT
        // answers may cite those documents; fail closed to rows that are live
        // and published in the knowledge base itself.
        if (mode != ChatMode.HOSPITAL_SUPPORT) return null;
        return resolveKnowledgeDocument(type, id);
    }

    private ResolvedSource resolveKnowledgeDocument(String type, String id) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT title, content_hash, sync_revision"
                    + " FROM healthcare.ai_documents"
                    + " WHERE source_type = ? AND source_id = ?"
                    + " AND active AND published AND deleted_at IS NULL"
                    + " LIMIT 1",
                type, id);
            if (rows.isEmpty()) return null;
            Map<String, Object> row = rows.get(0);
            Object rawTitle = row.get("title");
            if (rawTitle == null || rawTitle.toString().isBlank()) return null;
            Long revision = row.get("sync_revision") instanceof Number number
                ? number.longValue()
                : null;
            String hash = row.get("content_hash") == null ? null : row.get("content_hash").toString();
            return new ResolvedSource(
                type, id, rawTitle.toString(), null, true, true,
                "OPERATIONAL", revision, null, hash, null, null, null);
        } catch (RuntimeException ex) {
            // Knowledge-base availability is a hard deny, mirroring the
            // catalog fail-closed posture.
            return null;
        }
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
                .map(value -> catalogSource(type, uuid, branchDisplayTitle(value), value.getSlug()))
                .orElse(null);
            case "specialty" -> specialtyRepository.findByIdAndActiveTrue(uuid)
                .map(value -> catalogSource(type, uuid, value.getName(), value.getSlug()))
                .orElse(null);
            case "doctor" -> doctorRepository.findById(uuid)
                .filter(Doctor::isActive)
                .map(value -> catalogSource(type, uuid, doctorDisplayTitle(value), value.getSlug()))
                .orElse(null);
            case "service" -> serviceRepository.findById(uuid)
                .filter(MedicalService::isActive)
                .map(value -> catalogSource(type, uuid, value.getName(), value.getSlug()))
                .orElse(null);
            case "package" -> packageRepository.findByIdAndActiveTrue(uuid)
                .map(value -> catalogSource(type, uuid, value.getName(), value.getSlug()))
                .orElse(null);
            case "article" -> articleRepository.findById(uuid)
                .filter(Article::isActive)
                .map(value -> {
                    String cleanTitle = cleanCatalogTitle(value.getTitle());
                    if (cleanTitle == null) return null;
                    return source(type, id, cleanTitle, value.getSlug(), true,
                        value.getPublishedAt() != null);
                })
                .orElse(null);
            case "faq" -> faqRepository.findById(uuid)
                .filter(Faq::isActive)
                .map(value -> catalogSource(type, uuid, value.getQuestion(), null))
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
                             FROM articles a
                              WHERE a.id = h.source_id
                                -- Publication gate: a PENDING or REJECTED
                                -- article must hard-deny here regardless of
                                -- any stale clinical approval head, or the
                                -- anonymous chat could cite withdrawn content.
                                AND a.review_status = 'APPROVED'
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

    private String doctorDisplayTitle(Doctor doctor) {
        String fullName = doctor.getFullName() == null || doctor.getFullName().isBlank()
            ? "Bác sĩ HealthCare" : doctor.getFullName().strip();
        if (doctorBranchRepository == null || doctor.getId() == null) return fullName;

        List<DoctorBranch> assignments = doctorBranchRepository.findByDoctorId(doctor.getId());
        if (assignments == null || assignments.isEmpty()) return fullName;
        List<String> branchNames = assignments.stream()
            .filter(Objects::nonNull)
            .map(DoctorBranch::getBranch)
            .filter(Objects::nonNull)
            .filter(Branch::isActive)
            .map(Branch::getName)
            .filter(Objects::nonNull)
            .map(String::strip)
            .filter(value -> !value.isBlank())
            .distinct()
            .limit(3)
            .toList();
        return branchNames.isEmpty()
            ? fullName
            : fullName + " — " + String.join(" · ", branchNames);
    }

    private String branchDisplayTitle(Branch branch) {
        String name = branch.getName() == null || branch.getName().isBlank()
            ? "Cơ sở HealthCare" : branch.getName().strip();
        String address = branch.getAddress();
        if (address == null || address.isBlank()
                || !name.matches("(?s).*\\bCơ sở\\s+\\d+\\s*$")) {
            return name;
        }
        String locality = Arrays.stream(address.split(","))
            .map(String::strip)
            .filter(part -> {
                String normalized = part.toLowerCase(Locale.ROOT);
                return normalized.startsWith("quận")
                    || normalized.startsWith("huyện")
                    || normalized.startsWith("thành phố")
                    || normalized.startsWith("tp.")
                    || normalized.equals("hà nội")
                    || normalized.contains("thủ đức");
            })
            .findFirst()
            .orElse(null);
        return locality == null ? name : name + " — " + locality;
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

    public record CatalogOverview(
        int specialtyCount,
        int branchCount,
        List<ResolvedSource> specialties,
        List<ResolvedSource> branches
    ) {
        public CatalogOverview {
            specialtyCount = Math.max(0, specialtyCount);
            branchCount = Math.max(0, branchCount);
            specialties = specialties == null ? List.of() : List.copyOf(specialties);
            branches = branches == null ? List.of() : List.copyOf(branches);
        }

        public static CatalogOverview empty() {
            return new CatalogOverview(0, 0, List.of(), List.of());
        }

        public boolean hasData() {
            return specialtyCount > 0 || branchCount > 0
                || !specialties.isEmpty() || !branches.isEmpty();
        }

        public String summary() {
            List<String> facts = new ArrayList<>();
            if (specialtyCount > 0) facts.add(specialtyCount + " chuyên khoa");
            if (branchCount > 0) facts.add(branchCount + " cơ sở đang hoạt động");
            StringBuilder answer = new StringBuilder("Hiện HealthCare có ");
            answer.append(facts.isEmpty()
                ? "các danh mục đang hoạt động"
                : String.join(" và ", facts));
            answer.append(" theo dữ liệu đang hoạt động.");

            List<String> specialtyNames = specialties.stream()
                .map(ResolvedSource::title)
                .filter(value -> value != null && !value.isBlank())
                .toList();
            if (!specialtyNames.isEmpty()) {
                answer.append(" Một số chuyên khoa: ")
                    .append(String.join(", ", specialtyNames)).append(".");
            }
            List<String> branchNames = branches.stream()
                .map(ResolvedSource::title)
                .filter(value -> value != null && !value.isBlank())
                .toList();
            if (!branchNames.isEmpty()) {
                answer.append(" Một số cơ sở: ")
                    .append(String.join(", ", branchNames)).append(".");
            }
            return answer.toString();
        }

        public List<ResolvedSource> sources() {
            List<ResolvedSource> result = new ArrayList<>(specialties.size() + branches.size());
            result.addAll(specialties);
            result.addAll(branches);
            return List.copyOf(result);
        }
    }

    public record BranchDetails(
        ResolvedSource source,
        String address,
        String workingHours,
        String phone,
        List<String> amenities
    ) { }

    /**
     * Result of resolving an amenity question against the live branch
     * catalog: the requested facility type, the branches that actually
     * advertise it, and — for a question that named a branch — the
     * identity-resolved rows regardless of whether they carry the amenity.
     */
    public record AmenityResolution(
        String amenityType,
        List<BranchDetails> matches,
        List<BranchDetails> resolved,
        boolean specific,
        boolean truncated
    ) { }

    private record ReviewHead(
        long contentRevision,
        long eligibilityRevision,
        String contentHash,
        long approvalRound,
        String expiresAt
    ) { }
}
