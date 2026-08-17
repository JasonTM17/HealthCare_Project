package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.FaqResponse;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.repository.FaqRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hospital/faqs")
public class FaqController {

    private final FaqRepository faqRepository;

    public FaqController(FaqRepository faqRepository) {
        this.faqRepository = faqRepository;
    }

    @GetMapping
    public Page<FaqResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return faqRepository.findByActiveTrue(pageable).map(this::toResponse);
    }

    private FaqResponse toResponse(Faq faq) {
        return new FaqResponse(faq.getId().toString(), faq.getQuestion(), faq.getAnswer());
    }
}
