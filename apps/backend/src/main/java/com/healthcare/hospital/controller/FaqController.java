package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.FaqResponse;
import com.healthcare.hospital.service.FaqService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hospital/faqs")
@Tag(name = "Public Catalog", description = "Danh mục y tế công khai (Cơ sở bệnh viện, chuyên khoa, bác sĩ, gói khám, dịch vụ)")
public class FaqController {

    private final FaqService faqService;

    public FaqController(FaqService faqService) {
        this.faqService = faqService;
    }

    @Operation(summary = "Danh sách câu hỏi thường gặp (FAQ)", description = "Lấy danh sách các câu hỏi thường gặp về thủ tục khám chữa bệnh, bảo hiểm y tế và đặt lịch")
    @GetMapping
    public Page<FaqResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return faqService.listActive(pageable);
    }
}
