package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.FaqRequest;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.repository.FaqRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AdminFaqService {

    private final FaqRepository faqRepository;

    public AdminFaqService(FaqRepository faqRepository) {
        this.faqRepository = faqRepository;
    }

    @Transactional(readOnly = true)
    public Page<Faq> list(Pageable pageable) {
        return faqRepository.findAll(pageable);
    }

    @Transactional
    public Faq create(FaqRequest request) {
        Faq faq = new Faq();
        faq.setQuestion(request.question());
        faq.setAnswer(request.answer());
        faq.setActive(request.active());
        return faqRepository.save(faq);
    }

    @Transactional
    public Faq update(UUID id, FaqRequest request) {
        Faq faq = faqRepository.findById(id)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("FAQ not found: " + id));
        faq.setQuestion(request.question());
        faq.setAnswer(request.answer());
        faq.setActive(request.active());
        return faqRepository.save(faq);
    }

    @Transactional
    public void delete(UUID id) {
        Faq faq = faqRepository.findById(id)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("FAQ not found: " + id));
        faqRepository.delete(faq);
    }
}
