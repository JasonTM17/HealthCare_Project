package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/health-questions")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Health Q&A", description = "Kiểm duyệt câu hỏi y khoa - Ban Quản trị")
@SecurityRequirement(name = "bearerAuth")
public class AdminHealthQuestionController {
    private final HealthQuestionService service;
    public AdminHealthQuestionController(HealthQuestionService service) { this.service = service; }
    /** Body stays a JSON array for the existing admin frontend; optional page/size
     * params expose bounded windows, and metadata is sent in headers. */
    @Operation(summary = "Hàng đợi kiểm duyệt câu hỏi", description = "Quản trị viên xem danh sách các câu hỏi cần kiểm duyệt trạng thái và phân trang")
    @GetMapping
    public ResponseEntity<List<HealthQuestionContracts.Summary>> queue(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        List<HealthQuestionContracts.Summary> result = service.adminQueue(state, page, size);
        int safePage = com.healthcare.common.SafePageRequests.safePage(page);
        int safeSize = com.healthcare.common.SafePageRequests.safeSize(size, 20, 100);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Page", Integer.toString(safePage));
        headers.set("X-Page-Size", Integer.toString(safeSize));
        headers.set("X-Has-More", Boolean.toString(result.size() == safeSize));
        return ResponseEntity.ok().headers(headers).body(result);
    }
    @Operation(summary = "Quản trị viên kiểm duyệt câu hỏi y khoa", description = "Phê duyệt hoặc từ chối câu hỏi cộng đồng, kiểm tra tuân thủ chính sách PII")
    @PutMapping("/{id}/moderation")
    public void moderate(@PathVariable UUID id, @Valid @RequestBody HealthQuestionContracts.ModerationRequest request,
                          @AuthenticationPrincipal UserDetails principal) { service.moderate(id, request, principal); }

    @Operation(summary = "Xem danh sách báo cáo vi phạm câu hỏi", description = "Danh sách các lượt báo cáo vi phạm tiêu chuẩn cộng đồng đối với câu hỏi y khoa")
    @GetMapping("/{id}/reports")
    public List<HealthQuestionContracts.ReportSummary> reports(
            @PathVariable UUID id, @RequestParam(required = false) String status) {
        return service.adminReports(id, status);
    }

    @Operation(summary = "Xử lý báo cáo vi phạm câu hỏi y khoa", description = "Đưa ra quyết định chấp thuận hoặc bác bỏ báo cáo vi phạm của người dùng")
    @PutMapping("/{id}/reports/{reportId}")
    public HealthQuestionContracts.ReportSummary decideReport(
            @PathVariable UUID id,
            @PathVariable UUID reportId,
            @Valid @RequestBody HealthQuestionContracts.ReportDecisionRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return service.decideReport(id, reportId, request, principal);
    }
}
