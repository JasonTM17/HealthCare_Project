package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctor/health-questions")
@PreAuthorize("hasRole('DOCTOR')")
@Tag(name = "Health Q&A", description = "Hỏi đáp y khoa cộng đồng - Phân hệ Bác sĩ")
@SecurityRequirement(name = "bearerAuth")
public class DoctorHealthQuestionController {
    private final HealthQuestionService service;
    public DoctorHealthQuestionController(HealthQuestionService service) { this.service = service; }

    @Operation(summary = "Hàng đợi câu hỏi chờ bác sĩ trả lời", description = "Danh sách câu hỏi y khoa chưa có câu trả lời hoặc đang chờ duyệt")
    @GetMapping
    public List<HealthQuestionContracts.Summary> queue(@AuthenticationPrincipal UserDetails principal) {
        return service.doctorQueue(principal);
    }

    @Operation(summary = "Bác sĩ gửi câu trả lời", description = "Bác sĩ soạn và gửi câu trả lời chuyên môn cho người bệnh")
    @PutMapping("/{id}/answer")
    public void answer(@PathVariable UUID id, @Valid @RequestBody HealthQuestionContracts.AnswerRequest request,
                       @AuthenticationPrincipal UserDetails principal) { service.answer(id, request, principal); }

    @Operation(summary = "Duyệt hoặc từ chối câu trả lời", description = "Bác sĩ đồng nghiệp duyệt câu trả lời trước khi công khai")
    @PutMapping("/{id}/decision")
    public void decision(@PathVariable UUID id, @Valid @RequestBody HealthQuestionContracts.DecisionRequest request,
                         @AuthenticationPrincipal UserDetails principal) { service.decide(id, request, principal); }
}
