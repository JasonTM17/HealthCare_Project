package com.healthcare.consultation.controller;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
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

@Tag(name = "Tele-Consultation", description = "Tư vấn sức khỏe trực tuyến từ xa giữa bác sĩ và người bệnh")
@RestController
@RequestMapping("/api/v1/doctor/consultations")
@PreAuthorize("hasRole('DOCTOR')")
@SecurityRequirement(name = "bearerAuth")
public class DoctorConsultationController {

    private final PatientConsultationService service;

    public DoctorConsultationController(PatientConsultationService service) {
        this.service = service;
    }

    @Operation(summary = "Danh sách phiên tư vấn của bác sĩ", description = "Xem danh sách các ca tư vấn từ xa mà bác sĩ được phân công")
    @GetMapping
    public List<ConsultationContracts.ConsultationSummary> list(@AuthenticationPrincipal UserDetails principal) {
        return service.listForDoctor(principal);
    }

    @Operation(summary = "Xem chi tiết phiên tư vấn của bác sĩ", description = "Truy xuất thông tin chi tiết cuộc tư vấn, người bệnh tham gia và trạng thái phiên")
    @GetMapping("/{id}")
    public ConsultationContracts.Detail detail(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return service.detail(id, principal);
    }

    @Operation(summary = "Lấy lịch sử tin nhắn trong phiên tư vấn", description = "Lấy danh sách tin nhắn kèm phân trang con trỏ (cursor) trong cuộc tư vấn")
    @GetMapping("/{id}/messages")
    public ConsultationContracts.MessagePage messages(
            @PathVariable UUID id,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal UserDetails principal) {
        return service.messages(id, principal, cursor, limit);
    }

    @Operation(summary = "Danh mục bác sĩ có thể chuyển tiếp ca tư vấn", description = "Danh sách đồng nghiệp cùng chuyên khoa khả dụng để bàn giao ca khám trực tuyến")
    @GetMapping("/{id}/handoff-directory")
    public List<ConsultationContracts.HandoffDoctor> handoffDirectory(
            @PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return service.handoffDirectory(id, principal);
    }

    @Operation(summary = "Bác sĩ gửi tin nhắn phản hồi cho người bệnh", description = "Gửi lời khuyên y tế, giải thích kết quả cận lâm sàng cho bệnh nhân trong ca tư vấn")
    @PostMapping("/{id}/messages")
    public ConsultationContracts.Message send(
            @PathVariable UUID id,
            @Valid @RequestBody ConsultationContracts.MessageRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal UserDetails principal) {
        return service.send(id, request, idempotencyKey, principal);
    }

    @Operation(summary = "Bác sĩ hoàn tất ca tư vấn trực tuyến", description = "Đóng phiên tư vấn sau khi đã hoàn thành giải đáp và hướng dẫn điều trị")
    @PostMapping("/{id}/resolve")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void resolve(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        service.resolve(id, principal);
    }

    @Operation(summary = "Bác sĩ mở lại phiên tư vấn", description = "Mở lại cuộc trò chuyện nếu người bệnh có câu hỏi phát sinh liên quan")
    @PostMapping("/{id}/reopen")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void reopen(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        service.reopen(id, principal);
    }

    @Operation(summary = "Bác sĩ đánh dấu đã đọc tin nhắn", description = "Cập nhật trạng thái đã xem tin nhắn mới nhất từ người bệnh")
    @PostMapping("/{id}/read")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void read(@PathVariable UUID id,
                     @RequestBody(required = false) ConsultationContracts.ReadRequest request,
                     @AuthenticationPrincipal UserDetails principal) {
        service.markRead(id, request, principal);
    }

    @Operation(summary = "Kiểm tra trạng thái tệp đính kèm phiên tư vấn", description = "Kiểm tra kết quả quét virus và tính toàn vẹn của tệp tài liệu cận lâm sàng")
    @GetMapping("/{id}/attachments/{attachmentId}")
    public ConsultationContracts.Attachment attachmentStatus(
            @PathVariable UUID id, @PathVariable UUID attachmentId,
            @AuthenticationPrincipal UserDetails principal) {
        return service.attachmentStatus(id, attachmentId, principal);
    }

    @Operation(summary = "Tải xuống tệp đính kèm ca tư vấn an toàn", description = "Tạo đường dẫn có chữ ký (presigned URL) tải tệp đã qua kiểm duyệt bảo mật")
    @GetMapping("/{id}/attachments/{attachmentId}/download")
    public ConsultationContracts.Attachment downloadAttachment(
            @PathVariable UUID id, @PathVariable UUID attachmentId,
            @AuthenticationPrincipal UserDetails principal) {
        return service.downloadIntent(id, attachmentId, principal);
    }

    @Operation(summary = "Bàn giao ca tư vấn cho bác sĩ khác", description = "Chuyển giao quyền phụ trách phiên tư vấn sang bác sĩ chuyên khoa phù hợp")
    @PutMapping("/{id}/handoff")
    public void handoff(@PathVariable UUID id, @Valid @RequestBody ConsultationContracts.HandoffRequest request,
                        @AuthenticationPrincipal UserDetails principal) {
        service.handoff(id, request, principal);
    }
}
