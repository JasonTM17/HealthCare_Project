package com.healthcare.consultation.controller;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/consultations")
@PreAuthorize("hasRole('ADMIN')")
public class AdminConsultationController {
    private final PatientConsultationService service;
    public AdminConsultationController(PatientConsultationService service) { this.service = service; }

    @Operation(summary = "Hàng đợi tư vấn từ xa", description = "Truy xuất danh sách các phiên tư vấn trực tuyến đang chờ điều phối hoặc đang diễn ra")
    @GetMapping("/queue")
    public ResponseEntity<List<ConsultationContracts.AdminQueueItem>> queue(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        List<ConsultationContracts.AdminQueueItem> result = service.listForAdmin(page, size);
        int safePage = com.healthcare.common.SafePageRequests.safePage(page);
        int safeSize = com.healthcare.common.SafePageRequests.safeSize(size, 20, 100);
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Page", Integer.toString(safePage));
        headers.set("X-Page-Size", Integer.toString(safeSize));
        headers.set("X-Has-More", Boolean.toString(result.size() == safeSize));
        return ResponseEntity.ok().headers(headers).body(result);
    }

    @Operation(summary = "Điều phối phiên tư vấn cho bác sĩ", description = "Phân công hoặc chuyển giao phiên tư vấn từ xa cho một bác sĩ chuyên khoa khác")
    @PutMapping("/{id}/assignment")
    public void assign(@PathVariable UUID id, @Valid @RequestBody ConsultationContracts.HandoffRequest request,
                       @AuthenticationPrincipal UserDetails principal) { service.assign(id, request, principal); }
}
