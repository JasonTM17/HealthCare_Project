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
@RequestMapping("/api/v1/doctor/consultations")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorConsultationController {
    private final PatientConsultationService service;
    public DoctorConsultationController(PatientConsultationService service) { this.service = service; }

    @GetMapping
    public List<ConsultationContracts.ConsultationSummary> list(@AuthenticationPrincipal UserDetails principal) {
        return service.listForDoctor(principal);
    }

    @GetMapping("/{id}")
    public ConsultationContracts.Detail detail(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return service.detail(id, principal);
    }

    @PostMapping("/{id}/messages")
    public ConsultationContracts.Message send(@PathVariable UUID id,
            @Valid @RequestBody ConsultationContracts.MessageRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal UserDetails principal) {
        return service.send(id, request, idempotencyKey, principal);
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void read(@PathVariable UUID id,
                     @RequestBody(required = false) ConsultationContracts.ReadRequest request,
                     @AuthenticationPrincipal UserDetails principal) {
        service.markRead(id, request, principal);
    }

    @PutMapping("/{id}/handoff")
    public void handoff(@PathVariable UUID id, @Valid @RequestBody ConsultationContracts.HandoffRequest request,
                        @AuthenticationPrincipal UserDetails principal) { service.handoff(id, request, principal); }
}
