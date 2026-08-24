package com.healthcare.hospital.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.dto.FaqRequest;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.repository.FaqRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.time.OffsetDateTime;

@Service
public class AdminFaqService {

    private final FaqRepository faqRepository;
    private final com.healthcare.ai.service.AiClinicalContentRevisionService revisionService;

    public AdminFaqService(FaqRepository faqRepository) {
        this(faqRepository, null);
    }

    @Autowired
    public AdminFaqService(
            FaqRepository faqRepository,
            com.healthcare.ai.service.AiClinicalContentRevisionService revisionService) {
        this.faqRepository = faqRepository;
        this.revisionService = revisionService;
    }

    @Transactional(readOnly = true)
    public Page<Faq> list(Pageable pageable) {
        return faqRepository.findAll(pageable);
    }

    @Transactional
    public Faq create(FaqRequest request) {
        return create(request, null);
    }

    @Transactional
    public Faq create(FaqRequest request, UserDetails actor) {
        Faq faq = new Faq();
        faq.setQuestion(request.question());
        faq.setAnswer(request.answer());
        applyRichFields(faq, request, true);
        faq.setActive(request.active());
        Faq saved = faqRepository.saveAndFlush(faq);
        if (revisionService != null) revisionService.recordFaq(saved, actor);
        return saved;
    }

    @Transactional
    public Faq update(UUID id, FaqRequest request) {
        return update(id, request, null);
    }

    @Transactional
    public Faq update(UUID id, FaqRequest request, UserDetails actor) {
        Faq faq = faqRepository.findById(id)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("FAQ not found: " + id));
        if (request.version() != null && !request.version().equals(faq.getVersion())) {
            throw new BusinessException(409, ErrorCodes.AI_CONTENT_REVISION_STALE,
                "FAQ version is stale; reload before saving");
        }
        faq.setQuestion(request.question());
        faq.setAnswer(request.answer());
        applyRichFields(faq, request, false);
        faq.setActive(request.active());
        Faq saved = faqRepository.saveAndFlush(faq);
        if (revisionService != null) revisionService.recordFaq(saved, actor);
        return saved;
    }

    @Transactional
    public void delete(UUID id) {
        delete(id, null);
    }

    @Transactional
    public void delete(UUID id, UserDetails actor) {
        Faq faq = faqRepository.findById(id)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("FAQ not found: " + id));
        if (revisionService != null) revisionService.recordFaqDeletion(faq, actor);
        faqRepository.delete(faq);
    }

    private void applyRichFields(Faq faq, FaqRequest request, boolean creating) {
        if (request.category() != null) faq.setCategory(trimToNull(request.category()));
        if (request.topicSlug() != null) faq.setTopicSlug(trimToNull(request.topicSlug()));
        if (request.originQuestionId() != null) faq.setOriginQuestionId(request.originQuestionId());
        if (request.relatedSpecialtySlug() != null) {
            faq.setRelatedSpecialtySlug(trimToNull(request.relatedSpecialtySlug()));
        }
        if (request.topicTags() != null) {
            faq.setTopicTags(HospitalJsonMapper.stringArray(request.topicTags()));
        }
        boolean published = request.published() != null
            ? request.published()
            : faq.getPublishedAt() != null;
        if (published && (creating || faq.getPublishedAt() == null)) {
            faq.setPublishedAt(OffsetDateTime.now());
        } else if (!published) {
            faq.setPublishedAt(null);
        }
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
