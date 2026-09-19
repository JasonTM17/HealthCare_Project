package com.healthcare.document.controller;

import com.healthcare.document.dto.DocumentResponse;
import com.healthcare.document.dto.GenerateDocumentRequest;
import com.healthcare.document.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;

/**
 * Patient synthetic document center (ADR-005). All routes require
 * authentication; ownership is enforced in the service layer on top of the
 * SecurityConfig catch-all rule.
 */
@RestController
@RequestMapping("/api/v1/patients/{patientId}/documents")
@Tag(name = "Synthetic Documents", description = "Xuất tệp tóm tắt bệnh án và đơn thuốc định dạng PDF")
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @Operation(summary = "Lấy danh sách tài liệu y khoa tổng hợp của bệnh nhân", description = "Danh sách các bản tóm tắt ca khám hoặc đơn thuốc PDF được kết xuất")
    @GetMapping
    public ResponseEntity<List<DocumentResponse>> listDocuments(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(documentService.listDocuments(patientId, userDetails));
    }

    @Operation(summary = "Tạo tệp tài liệu y khoa PDF tổng hợp", description = "Khởi tạo kết xuất tệp tóm tắt bệnh án hoặc đơn thuốc dạng PDF có mã xác thực")
    @PostMapping
    public ResponseEntity<DocumentResponse> generateDocument(
            @PathVariable UUID patientId,
            @Valid @RequestBody GenerateDocumentRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(documentService.generateDocument(patientId, request, userDetails));
    }

    @Operation(summary = "Thu hồi tài liệu y khoa đã xuất", description = "Đánh dấu thu hồi tệp tài liệu (lưu vết kiểm toán bất biến)")
    @PostMapping("/{documentId}/revoke")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    public ResponseEntity<DocumentResponse> revokeDocument(
            @PathVariable UUID patientId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(documentService.revokeDocument(patientId, documentId, userDetails));
    }

    @Operation(summary = "Tải xuống luồng tệp tài liệu PDF", description = "Truy xuất luồng nhị phân (binary stream) của tệp PDF tóm tắt bệnh án hoặc đơn thuốc")
    @GetMapping("/{documentId}/download")
    public ResponseEntity<InputStreamResource> downloadDocument(
            @PathVariable UUID patientId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        DocumentService.DocumentDownload download =
                documentService.downloadDocument(patientId, documentId, userDetails);
        InputStream stream = download.stream();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.set(HttpHeaders.CACHE_CONTROL, "no-store");
            headers.set(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(download));
            return ResponseEntity.ok()
                    .headers(headers)
                    .contentLength(download.document().getByteSize() == null ? 0L : download.document().getByteSize())
                    .body(new InputStreamResource(stream));
        } catch (RuntimeException exception) {
            closeQuietly(stream);
            throw exception;
        }
    }

    private String contentDisposition(DocumentService.DocumentDownload download) {
        String documentId = download.document().getId().toString();
        String filename = "tai-lieu-tong-hop-demo-"
            + download.document().getSourceType().name().toLowerCase(java.util.Locale.ROOT)
            + "-" + documentId.substring(0, Math.min(8, documentId.length())) + ".pdf";
        return "attachment; filename=\"" + filename + "\"";
    }

    private void closeQuietly(InputStream stream) {
        try {
            stream.close();
        } catch (Exception ignored) {
            // Best-effort cleanup on an error path.
        }
    }
}
