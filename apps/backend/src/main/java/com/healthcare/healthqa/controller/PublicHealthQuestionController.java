package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/hospital/health-questions")
@Tag(name = "Health Q&A", description = "Diễn đàn hỏi đáp y khoa cộng đồng được bác sĩ chuyên khoa kiểm duyệt")
public class PublicHealthQuestionController {
    private final HealthQuestionService service;
    public PublicHealthQuestionController(HealthQuestionService service) { this.service = service; }

    /** Body stays a JSON array for the existing public frontend; optional page/size
     * params expose bounded windows, and metadata is sent in headers. */
    @Operation(summary = "Danh sách câu hỏi y tế công khai", description = "Tra cứu các câu hỏi sức khỏe cộng đồng đã được bác sĩ chuyên khoa trả lời và phê duyệt")
    @GetMapping
    public ResponseEntity<List<HealthQuestionContracts.Summary>> list(
        @Parameter(description = "Lọc theo chủ đề sức khỏe (ví dụ: tim-mach, tieu-duong, da-day)")
        @RequestParam(required = false) String topic,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        List<HealthQuestionContracts.Summary> result = service.publicList(topic, page, size);
        int safePage = com.healthcare.common.SafePageRequests.safePage(page);
        int safeSize = com.healthcare.common.SafePageRequests.safeSize(
            size, HealthQuestionService.LISTING_DEFAULT_SIZE, HealthQuestionService.LISTING_MAX_SIZE);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Page", Integer.toString(safePage));
        headers.set("X-Page-Size", Integer.toString(safeSize));
        headers.set("X-Has-More", Boolean.toString(result.size() == safeSize));
        return ResponseEntity.ok().headers(headers).body(result);
    }
}
