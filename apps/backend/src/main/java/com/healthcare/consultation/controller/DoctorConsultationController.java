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

    @GetMapping("/{id}/messages")
    public ConsultationContracts.MessagePage messages(@PathVariable UUID id,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal UserDetails principal) {
        return service.messages(id, principal, cursor, limit);
    }

    @GetMapping("/{id}/handoff-directory")
    public List<ConsultationContracts.HandoffDoctor> handoffDirectory(
            @PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return service.handoffDirectory(id, principal);
    }

    @PostMapping("/{id}/messages")
    public ConsultationContracts.Message send(@PathVariable UUID id,
            @Valid @RequestBody ConsultationContracts.MessageRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal UserDetails principal) {
        return service.send(id, request, idempotencyKey, principal);
    }

    @PostMapping("/{id}/resolve")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void resolve(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        service.resolve(id, principal);
    }

    @PostMapping("/{id}/reopen")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void reopen(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        service.reopen(id, principal);
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void read(@PathVariable UUID id,
                     @RequestBody(required = false) ConsultationContracts.ReadRequest request,
                     @AuthenticationPrincipal UserDetails principal) {
        service.markRead(id, request, principal);
    }

    /** Only a participating doctor may obtain a short-lived URL for a CLEAN attachment. */
    @GetMapping("/{id}/attachments/{attachmentId}")
    public ConsultationContracts.Attachment attachmentStatus(
            @PathVariable UUID id, @PathVariable UUID attachmentId,
            @AuthenticationPrincipal UserDetails principal) {
        return service.attachmentStatus(id, attachmentId, principal);
    }

    /** Only a participating doctor may obtain a short-lived URL for a CLEAN attachment. */
    @GetMapping("/{id}/attachments/{attachmentId}/download")
    public ConsultationContracts.Attachment downloadAttachment(
            @PathVariable UUID id, @PathVariable UUID attachmentId,
            @AuthenticationPrincipal UserDetails principal) {
        return service.downloadIntent(id, attachmentId, principal);
    }

    @PutMapping("/{id}/handoff")
    public void handoff(@PathVariable UUID id, @Valid @RequestBody ConsultationContracts.HandoffRequest request,
                        @AuthenticationPrincipal UserDetails principal) { service.handoff(id, request, principal); }
}
