package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.FaqResponse;
import com.healthcare.hospital.service.FaqService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hospital/faqs")
public class FaqController {

    private final FaqService faqService;

    public FaqController(FaqService faqService) {
        this.faqService = faqService;
    }

    @GetMapping
    public Page<FaqResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return faqService.listActive(pageable);
    }
}
