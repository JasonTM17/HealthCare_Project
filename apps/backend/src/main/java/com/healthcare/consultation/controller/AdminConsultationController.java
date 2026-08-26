package com.healthcare.consultation.controller;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import jakarta.validation.Valid;
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

    @GetMapping("/queue")
    public List<ConsultationContracts.AdminQueueItem> queue() { return service.listForAdmin(); }

    @PutMapping("/{id}/assignment")
    public void assign(@PathVariable UUID id, @Valid @RequestBody ConsultationContracts.HandoffRequest request,
                       @AuthenticationPrincipal UserDetails principal) { service.assign(id, request, principal); }
}
