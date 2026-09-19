package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/hospital/health-questions")
@Tag(name = "Health Q&A", description = "Diễn đàn hỏi đáp y khoa cộng đồng được bác sĩ chuyên khoa kiểm duyệt")
public class PublicHealthQuestionController {
    private final HealthQuestionService service;
    public PublicHealthQuestionController(HealthQuestionService service) { this.service = service; }

    @Operation(summary = "Danh sách câu hỏi y tế công khai", description = "Tra cứu các câu hỏi sức khỏe cộng đồng đã được bác sĩ chuyên khoa trả lời và phê duyệt")
    @GetMapping
    public List<HealthQuestionContracts.Summary> list(
        @Parameter(description = "Lọc theo chủ đề sức khỏe (ví dụ: tim-mach, tieu-duong, da-day)")
        @RequestParam(required = false) String topic
    ) {
        return service.publicList(topic);
    }
}
