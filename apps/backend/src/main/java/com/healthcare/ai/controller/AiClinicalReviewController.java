package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiClinicalReviewService;
import com.healthcare.ai.controller.ClinicalReviewContracts.DecisionRequest;
import com.healthcare.ai.controller.ClinicalReviewContracts.SubmissionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@Tag(name = "AI Clinical Review", description = "Quy trình bác sĩ kiểm duyệt nội dung chuyên môn phục vụ chỉ mục RAG AI")
@RestController
@RequestMapping("/api/v1")
public class AiClinicalReviewController {

    private final AiClinicalReviewService service;

    public AiClinicalReviewController(AiClinicalReviewService service) {
        this.service = service;
    }

    @Operation(summary = "Admin gửi yêu cầu thẩm định nội dung y khoa", description = "Đưa bài viết hoặc tài liệu y tế vào hàng đợi thẩm định lâm sàng")
    @PutMapping("/admin/ai-content/{type}/{id}/submission")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> submit(
            @PathVariable String type,
            @PathVariable UUID id,
            @Valid @RequestBody SubmissionRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.submit(type, id, request.revision(), request.contentHash(), principal));
    }

    @Operation(summary = "Admin xem kho nội dung AI và tiến độ thẩm định", description = "Danh sách phân trang toàn bộ tài liệu y tế, trạng thái phê duyệt lâm sàng")
    @GetMapping("/admin/ai-content")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> adminInventory(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "ALL") String state,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.adminQueuePage(type, state, page, size));
    }

    @Operation(summary = "Bác sĩ lấy hàng đợi thẩm định lâm sàng", description = "Danh sách các tài liệu chuyên môn đang chờ bác sĩ thẩm định và phê duyệt")
    @GetMapping("/doctor/ai-content/reviews")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<Map<String, Object>> queue(
            @RequestParam(defaultValue = "SUBMITTED") String state,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.queuePage(state, page, size));
    }

    @Operation(summary = "Xem chi tiết bản sửa đổi nội dung y khoa", description = "Truy xuất nội dung cụ thể của một bản sửa đổi để kiểm tra tính chính xác y khoa")
    @GetMapping("/doctor/ai-content/{type}/{id}/revisions/{revision}")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<Map<String, Object>> revision(
            @PathVariable String type,
            @PathVariable UUID id,
            @PathVariable long revision) {
        return ResponseEntity.ok(service.revision(type, id, revision));
    }

    @Operation(
        summary = "Bác sĩ phê duyệt, yêu cầu sửa hoặc thu hồi nội dung lâm sàng",
        description = """
            Đưa ra quyết định chuyên môn cho một bản sửa đổi đang chờ thẩm định. Ba quyết định \
            hợp lệ: APPROVE (phê duyệt), REQUEST_CHANGES (yêu cầu chỉnh sửa) và REVOKE (thu hồi \
            một bản đã được phê duyệt trước đó). REQUEST_CHANGES và REVOKE bắt buộc phải kèm lý do, \
            nếu thiếu sẽ trả về lỗi AI_CONTENT_REASON_REQUIRED; người thẩm định phải khác người \
            gửi (AI_CONTENT_APPROVER_NOT_INDEPENDENT) và bản sửa đổi phải còn đúng phiên bản \
            (AI_CONTENT_REVISION_STALE)."""
    )
    @PutMapping("/doctor/ai-content/{type}/{id}/revisions/{revision}/decision")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<Map<String, Object>> decision(
            @PathVariable String type,
            @PathVariable UUID id,
            @PathVariable long revision,
            @RequestParam(required = false) Long round,
            @Valid @RequestBody DecisionRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.decide(
            type, id, revision, round == null ? 0L : round, request.decision(), request.reason(), principal));
    }
}
