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

@RestController
@RequestMapping("/api/v1/admin/consultations")
@PreAuthorize("hasRole('ADMIN')")
public class AdminConsultationController {
    private final PatientConsultationService service;
    public AdminConsultationController(PatientConsultationService service) { this.service = service; }

    /** Body stays a JSON array for the existing admin frontend; optional page/size
     * params expose bounded windows, and metadata is sent in headers. */
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

    @PutMapping("/{id}/assignment")
    public void assign(@PathVariable UUID id, @Valid @RequestBody ConsultationContracts.HandoffRequest request,
                       @AuthenticationPrincipal UserDetails principal) { service.assign(id, request, principal); }
}
