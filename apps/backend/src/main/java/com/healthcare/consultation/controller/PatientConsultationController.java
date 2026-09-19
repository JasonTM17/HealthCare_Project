package com.healthcare.consultation.controller;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Tele-Consultation", description = "Tư vấn sức khỏe trực tuyến từ xa giữa bác sĩ và người bệnh")
@RestController
@RequestMapping("/api/v1/patient/consultations")
@PreAuthorize("hasRole('PATIENT')")
@SecurityRequirement(name = "bearerAuth")
public class PatientConsultationController {

    private final PatientConsultationService service;
    private final com.healthcare.consultation.service.PatientConsultationRetentionService retention;

    public PatientConsultationController(
            PatientConsultationService service,
            com.healthcare.consultation.service.PatientConsultationRetentionService retention) {
        this.service = service;
        this.retention = retention;
    }

    @Operation(summary = "Khởi tạo luồng tư vấn từ xa", description = "Tạo phiên tư vấn y tế trực tuyến gắn với lịch hẹn đã xác nhận")
    @PostMapping
    public ResponseEntity<ConsultationContracts.ConsultationSummary> create(
            @Valid @RequestBody ConsultationContracts.CreateRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, principal));
    }

    @Operation(summary = "Danh sách phiên tư vấn của tôi", description = "Xem lịch sử và danh sách các phiên tư vấn trực tuyến của người bệnh")
    @GetMapping
    public List<ConsultationContracts.ConsultationSummary> list(@AuthenticationPrincipal UserDetails principal) {
        return service.listForPatient(principal);
    }

    @Operation(summary = "Xem chi tiết ca tư vấn của người bệnh", description = "Xem thông tin ca tư vấn, bác sĩ phụ trách và trạng thái phiên")
    @GetMapping("/{id}")
    public ConsultationContracts.Detail detail(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return service.detail(id, principal);
    }

    @Operation(summary = "Lấy lịch sử tin nhắn trong phiên tư vấn", description = "Tải tin nhắn trao đổi giữa bệnh nhân và bác sĩ với phân trang con trỏ")
    @GetMapping("/{id}/messages")
    public ConsultationContracts.MessagePage messages(@PathVariable UUID id,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal UserDetails principal) {
        return service.messages(id, principal, cursor, limit);
    }

    @Operation(summary = "Người bệnh gửi tin nhắn cho bác sĩ", description = "Gửi mô tả triệu chứng hoặc câu hỏi sức khỏe trong phiên tư vấn trực tuyến")
    @PostMapping("/{id}/messages")
    public ResponseEntity<ConsultationContracts.Message> send(@PathVariable UUID id,
            @Valid @RequestBody ConsultationContracts.MessageRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.send(id, request, idempotencyKey, principal));
    }

    @Operation(summary = "Đánh dấu đã đọc tin nhắn phản hồi", description = "Cập nhật trạng thái đã xem các tin nhắn phản hồi từ bác sĩ")
    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@PathVariable UUID id, @RequestBody(required = false) ConsultationContracts.ReadRequest request,
                     @AuthenticationPrincipal UserDetails principal) {
        service.markRead(id, request, principal);
    }

    @Operation(summary = "Người bệnh kết thúc phiên tư vấn", description = "Đóng ca tư vấn sau khi đã được bác sĩ giải đáp đầy đủ")
    @PostMapping("/{id}/close")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void close(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        service.close(id, principal);
    }

    @Operation(summary = "Người bệnh mở lại phiên tư vấn", description = "Yêu cầu mở lại ca tư vấn nếu cần hỏi thêm các vấn đề liên quan")
    @PostMapping("/{id}/reopen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reopen(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        service.reopen(id, principal);
    }

    @Operation(summary = "Xóa dữ liệu phiên tư vấn vì lý do riêng tư", description = "Xóa nội dung tin nhắn và tệp đính kèm theo quyền riêng tư của người bệnh (lưu vết kiểm toán)")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        retention.deleteForPatient(id, principal);
    }

    @Operation(summary = "Đăng ký tải lên tệp đính kèm phiên tư vấn", description = "Khởi tạo yêu cầu tải lên kết quả xét nghiệm, hình ảnh lâm sàng kèm presigned URL")
    @PostMapping("/{id}/attachments/intents")
    public ResponseEntity<ConsultationContracts.Attachment> intent(@PathVariable UUID id,
            @Valid @RequestBody ConsultationContracts.AttachmentIntentRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.attachmentIntent(id, request, principal));
    }

    @Operation(summary = "Xác nhận hoàn tất tải lên tệp đính kèm", description = "Kích hoạt quét mã độc/PII và xác thực tệp đã tải lên thành công")
    @PostMapping("/{id}/attachments/{attachmentId}/complete")
    public ConsultationContracts.Attachment complete(@PathVariable UUID id, @PathVariable UUID attachmentId,
            @RequestBody(required = false) ConsultationContracts.AttachmentCompleteRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return service.completeAttachment(id, attachmentId, request, principal);
    }

    @Operation(summary = "Người bệnh tải xuống tệp đính kèm", description = "Lấy đường dẫn có chữ ký để tải về tài liệu hoặc hình ảnh đã gửi")
    @GetMapping("/{id}/attachments/{attachmentId}/download")
    public ConsultationContracts.Attachment download(@PathVariable UUID id, @PathVariable UUID attachmentId,
                                                     @AuthenticationPrincipal UserDetails principal) {
        return service.downloadIntent(id, attachmentId, principal);
    }

    @Operation(summary = "Kiểm tra trạng thái quét bảo mật của tệp đính kèm", description = "Kiểm tra kết quả quét an toàn (CLEAN/INFECTED/PENDING)")
    @GetMapping("/{id}/attachments/{attachmentId}")
    public ConsultationContracts.Attachment attachmentStatus(@PathVariable UUID id, @PathVariable UUID attachmentId,
            @AuthenticationPrincipal UserDetails principal) {
        return service.attachmentStatus(id, attachmentId, principal);
    }
}
