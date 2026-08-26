package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.FaqResponse;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.repository.FaqRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class FaqService {

    private final FaqRepository faqRepository;

    public FaqService(FaqRepository faqRepository) {
        this.faqRepository = faqRepository;
    }

    public Page<FaqResponse> listActive(Pageable pageable) {
        return faqRepository.findClinicallyEligibleActive(pageable).map(this::toResponse);
    }

    private FaqResponse toResponse(Faq faq) {
        return new FaqResponse(
            faq.getId().toString(),
            faq.getQuestion(),
            faq.getAnswer()
        );
    }
}
