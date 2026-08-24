package com.healthcare.ai.service;

import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Periodically mirrors bounded, public catalog text into the protected AI index. */
@Service
public class AiCatalogIndexService {

    private static final Logger log = LoggerFactory.getLogger(AiCatalogIndexService.class);
    private final AiService aiService;
    private final BranchRepository branchRepository;
    private final SpecialtyRepository specialtyRepository;
    private final DoctorRepository doctorRepository;
    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;
    private final ArticleRepository articleRepository;
    private final FaqRepository faqRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${ai.rag-ingest.max-catalog-items:5000}")
    private int maxCatalogItems;

    /**
     * Runtime constructor.  The synchronization watermark is allocated by
     * PostgreSQL; a process-local clock/counter cannot provide ordering after
     * a restart or across multiple Spring instances.
     */
    @Autowired
    public AiCatalogIndexService(
            AiService aiService,
            BranchRepository branchRepository,
            SpecialtyRepository specialtyRepository,
            DoctorRepository doctorRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository,
            JdbcTemplate jdbcTemplate) {
        this.aiService = aiService;
        this.branchRepository = branchRepository;
        this.specialtyRepository = specialtyRepository;
        this.doctorRepository = doctorRepository;
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
        this.articleRepository = articleRepository;
        this.faqRepository = faqRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Test/source compatibility constructor; production always uses the
     * database-backed constructor above. */
    public AiCatalogIndexService(
            AiService aiService,
            SpecialtyRepository specialtyRepository,
            DoctorRepository doctorRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository) {
        this(aiService, null, specialtyRepository, doctorRepository, serviceRepository,
            packageRepository, articleRepository, faqRepository, null);
    }

    /** Compatibility constructor for callers that provide a database cursor
     * but predate the branch repository parameter. */
    public AiCatalogIndexService(
            AiService aiService,
            SpecialtyRepository specialtyRepository,
            DoctorRepository doctorRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository,
            JdbcTemplate jdbcTemplate) {
        this(aiService, null, specialtyRepository, doctorRepository, serviceRepository,
            packageRepository, articleRepository, faqRepository, jdbcTemplate);
    }

    @Scheduled(
        initialDelayString = "${ai.rag-ingest.initial-delay-ms:15000}",
        fixedDelayString = "${ai.rag-ingest.sync-delay-ms:300000}"
    )
    public void synchronizeCatalog() {
        if (!aiService.isRagIngestConfigured()) return;
        try {
            int indexed = synchronizeCatalogNow();
            log.info("AI catalog synchronization completed: {} documents processed", indexed);
        } catch (RuntimeException exception) {
            log.warn("AI catalog synchronization deferred: {}", exception.getClass().getSimpleName());
        }
    }

    /** Runs a bounded synchronization and propagates failures to an authorized operator. */
    public int synchronizeCatalogNow() {
        if (!aiService.isRagIngestConfigured()) {
            throw new IllegalStateException("AI RAG ingestion is not configured");
        }
        int pageSize = Math.max(1, Math.min(maxCatalogItems, 10_000));
        long syncRevision = nextSyncRevision();
        int indexed = 0;
        Set<String> currentSources = new HashSet<>();
        Map<String, Boolean> completeTypes = new LinkedHashMap<>();

        if (branchRepository != null) {
            Page<Branch> branches = branchRepository.findAll(PageRequest.of(0, pageSize));
            completeTypes.put("branch", !branches.hasNext());
            for (Branch item : branches) {
                currentSources.add(index(
                    "branch",
                    item.getId().toString(),
                    item.getName(),
                    text(item.getName(), item.getAddress(), item.getPhone(),
                        item.getWorkingHours(), item.getEmergencyHotline(),
                        item.getMapUrl(),
                        item.getAmenities() == null ? null : item.getAmenities().toString()),
                    item.isActive(),
                    true,
                    item.getSlug(),
                    syncRevision));
                indexed++;
            }
        } else {
            // The legacy unit-test constructor has no branch repository. Do
            // not claim a complete branch snapshot or tombstone branch rows.
            completeTypes.put("branch", false);
        }

        Page<Specialty> specialties = specialtyRepository.findAll(PageRequest.of(0, pageSize));
        completeTypes.put("specialty", !specialties.hasNext());
        for (Specialty item : specialties) {
            currentSources.add(index("specialty", item.getId().toString(), item.getName(), text(item.getName(), item.getDescription()), item.isActive(), true, item.getSlug(), syncRevision)); indexed++;
        }
        Page<Doctor> doctors = doctorRepository.findAll(PageRequest.of(0, pageSize));
        completeTypes.put("doctor", !doctors.hasNext());
        for (Doctor item : doctors) {
            currentSources.add(index("doctor", item.getId().toString(), item.getFullName(), text(item.getFullName(), item.getBio()), item.isActive(), true, item.getSlug(), syncRevision)); indexed++;
        }
        Page<MedicalService> services = serviceRepository.findAll(PageRequest.of(0, pageSize));
        completeTypes.put("service", !services.hasNext());
        for (MedicalService item : services) {
            currentSources.add(index("service", item.getId().toString(), item.getName(), text(item.getName(), item.getDescription()), item.isActive(), true, item.getSlug(), syncRevision)); indexed++;
        }
        Page<com.healthcare.hospital.entity.Package> packages = packageRepository.findAll(PageRequest.of(0, pageSize));
        completeTypes.put("package", !packages.hasNext());
        for (com.healthcare.hospital.entity.Package item : packages) {
            currentSources.add(index("package", item.getId().toString(), item.getName(), text(item.getName(), item.getDescription()), item.isActive(), true, item.getSlug(), syncRevision)); indexed++;
        }
        // ARTICLE and FAQ are governed clinical projections.  The old
        // periodic writer must never index them because it has no approval
        // revision/hash metadata.  Their dedicated revision/outbox flow is
        // the only source for HEALTH_EDUCATION.
        completeTypes.put("article", false);
        completeTypes.put("faq", false);
        articleRepository.findAll(PageRequest.of(0, pageSize));
        faqRepository.findAll(PageRequest.of(0, pageSize));

        for (Map<String, Object> source : aiService.listIndexedDocuments()) {
            String sourceType = source.get("source_type") instanceof String value ? value : null;
            String sourceId = source.get("source_id") instanceof String value ? value : null;
            if (sourceType == null || sourceId == null || !Boolean.TRUE.equals(completeTypes.get(sourceType))) {
                continue;
            }
            Object metadata = source.get("metadata");
            if (metadata instanceof Map<?, ?> values
                    && "CLINICAL".equalsIgnoreCase(String.valueOf(values.get("projection_kind")))) {
                // Never let an operational reconciliation delete or mutate a
                // separately governed clinical projection.
                continue;
            }
            String key = sourceType + ":" + sourceId;
            if (!currentSources.contains(key)) {
                aiService.removeIndexedDocument(sourceType, sourceId, syncRevision, "OPERATIONAL");
                indexed++;
            }
        }
        return indexed;
    }

    private String index(String type, String id, String title, String content,
            boolean active, boolean published, String slug, long syncRevision) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("source_type", type);
        payload.put("source_id", id);
        payload.put("title", title);
        payload.put("content", content);
        payload.put("active", active);
        payload.put("published", published);
        Map<String, String> metadata = new LinkedHashMap<>();
        if (slug != null) metadata.put("slug", slug);
        metadata.put("_sync_revision", Long.toString(syncRevision));
        metadata.put("projection_kind", "OPERATIONAL");
        payload.put("metadata", metadata);
        aiService.indexDocument(payload);
        return type + ":" + id;
    }

    private long nextSyncRevision() {
        if (jdbcTemplate == null) {
            // Only the legacy unit-test constructor can reach this branch. It
            // is deliberately constant rather than a process-local clock.
            return 1L;
        }
        Long revision = jdbcTemplate.queryForObject(
            "SELECT nextval('ai_catalog_sync_revision_seq')", Long.class);
        if (revision == null || revision <= 0L) {
            throw new IllegalStateException("database returned an invalid catalog sync revision");
        }
        return revision;
    }

    private String text(String... values) {
        StringBuilder result = new StringBuilder();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                if (!result.isEmpty()) result.append("\n");
                result.append(value.trim());
            }
        }
        return result.toString();
    }
}
