package com.healthcare.ai.service;

import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/** Periodically mirrors bounded, public catalog text into the protected AI index. */
@Service
public class AiCatalogIndexService {

    private static final Logger log = LoggerFactory.getLogger(AiCatalogIndexService.class);
    private final AiService aiService;
    private final SpecialtyRepository specialtyRepository;
    private final DoctorRepository doctorRepository;
    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;
    private final ArticleRepository articleRepository;
    private final FaqRepository faqRepository;

    @Value("${ai.rag-ingest.max-catalog-items:5000}")
    private int maxCatalogItems;

    public AiCatalogIndexService(
            AiService aiService,
            SpecialtyRepository specialtyRepository,
            DoctorRepository doctorRepository,
            ServiceRepository serviceRepository,
            PackageRepository packageRepository,
            ArticleRepository articleRepository,
            FaqRepository faqRepository) {
        this.aiService = aiService;
        this.specialtyRepository = specialtyRepository;
        this.doctorRepository = doctorRepository;
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
        this.articleRepository = articleRepository;
        this.faqRepository = faqRepository;
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
        int indexed = 0;
        for (Specialty item : specialtyRepository.findAll(PageRequest.of(0, pageSize))) {
            index("specialty", item.getId().toString(), item.getName(), text(item.getName(), item.getDescription()), item.isActive(), true, item.getSlug()); indexed++;
        }
        for (Doctor item : doctorRepository.findAll(PageRequest.of(0, pageSize))) {
            index("doctor", item.getId().toString(), item.getFullName(), text(item.getFullName(), item.getBio()), item.isActive(), true, item.getSlug()); indexed++;
        }
        for (MedicalService item : serviceRepository.findAll(PageRequest.of(0, pageSize))) {
            index("service", item.getId().toString(), item.getName(), text(item.getName(), item.getDescription()), item.isActive(), true, item.getSlug()); indexed++;
        }
        for (com.healthcare.hospital.entity.Package item : packageRepository.findAll(PageRequest.of(0, pageSize))) {
            index("package", item.getId().toString(), item.getName(), text(item.getName(), item.getDescription()), item.isActive(), true, item.getSlug()); indexed++;
        }
        for (Article item : articleRepository.findAll(PageRequest.of(0, pageSize))) {
            boolean published = item.getPublishedAt() != null;
            index("article", item.getId().toString(), item.getTitle(), text(item.getTitle(), item.getSummary(), item.getBody()), item.isActive(), published, item.getSlug()); indexed++;
        }
        for (Faq item : faqRepository.findAll(PageRequest.of(0, pageSize))) {
            index("faq", item.getId().toString(), item.getQuestion(), text(item.getQuestion(), item.getAnswer()), item.isActive(), true, null); indexed++;
        }
        return indexed;
    }

    private void index(String type, String id, String title, String content,
            boolean active, boolean published, String slug) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("source_type", type);
        payload.put("source_id", id);
        payload.put("title", title);
        payload.put("content", content);
        payload.put("active", active);
        payload.put("published", published);
        payload.put("metadata", slug == null ? Map.of() : Map.of("slug", slug));
        aiService.indexDocument(payload);
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
