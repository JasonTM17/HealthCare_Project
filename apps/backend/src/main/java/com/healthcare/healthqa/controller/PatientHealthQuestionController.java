package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient/health-questions")
@PreAuthorize("hasRole('PATIENT')")
@Tag(name = "Health Q&A", description = "Hỏi đáp y khoa cộng đồng được bác sĩ chuyên khoa kiểm duyệt")
@SecurityRequirement(name = "bearerAuth")
public class PatientHealthQuestionController {
    private final HealthQuestionService service;
    public PatientHealthQuestionController(HealthQuestionService service) { this.service = service; }

    @Operation(summary = "Đặt câu hỏi sức khỏe mới", description = "Người bệnh gửi câu hỏi sức khỏe để được bác sĩ chuyên khoa tư vấn và giải đáp")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HealthQuestionContracts.Summary create(@Valid @RequestBody HealthQuestionContracts.CreateRequest request,
                                                   @AuthenticationPrincipal UserDetails principal) { return service.create(request, principal); }

    @Operation(summary = "Câu hỏi của tôi", description = "Xem danh sách các câu hỏi và câu trả lời của cá nhân người bệnh")
    @GetMapping
    public List<HealthQuestionContracts.Summary> list(@AuthenticationPrincipal UserDetails principal) { return service.patientList(principal); }

    @Operation(summary = "Báo cáo nội dung không phù hợp", description = "Báo cáo câu hỏi hoặc câu trả lời vi phạm quy chuẩn y đức hoặc thông tin sai lệch")
    @PostMapping("/{id}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public HealthQuestionContracts.ReportSummary report(
            @PathVariable UUID id,
            @Valid @RequestBody HealthQuestionContracts.ReportRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return service.report(id, request, principal);
    }
}
