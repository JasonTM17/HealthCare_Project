package com.healthcare.consultation.controller;

import com.healthcare.consultation.dto.ConsultationContracts;
import com.healthcare.consultation.service.PatientConsultationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient/consultations")
@PreAuthorize("hasRole('PATIENT')")
public class PatientConsultationController {
    private final PatientConsultationService service;
    private final com.healthcare.consultation.service.PatientConsultationRetentionService retention;

    public PatientConsultationController(
            PatientConsultationService service,
            com.healthcare.consultation.service.PatientConsultationRetentionService retention) {
        this.service = service;
        this.retention = retention;
    }

    @PostMapping
    public ResponseEntity<ConsultationContracts.ConsultationSummary> create(
            @Valid @RequestBody ConsultationContracts.CreateRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, principal));
    }

    @GetMapping
    public List<ConsultationContracts.ConsultationSummary> list(@AuthenticationPrincipal UserDetails principal) {
        return service.listForPatient(principal);
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

    @PostMapping("/{id}/messages")
    public ResponseEntity<ConsultationContracts.Message> send(@PathVariable UUID id,
            @Valid @RequestBody ConsultationContracts.MessageRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.send(id, request, idempotencyKey, principal));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@PathVariable UUID id, @RequestBody(required = false) ConsultationContracts.ReadRequest request,
                     @AuthenticationPrincipal UserDetails principal) { service.markRead(id, request, principal); }

    @PostMapping("/{id}/close")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void close(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) { service.close(id, principal); }

    @PostMapping("/{id}/reopen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reopen(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        service.reopen(id, principal);
    }

    /** Immediate patient privacy deletion; audit evidence is retained. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        retention.deleteForPatient(id, principal);
    }

    @PostMapping("/{id}/attachments/intents")
    public ResponseEntity<ConsultationContracts.Attachment> intent(@PathVariable UUID id,
            @Valid @RequestBody ConsultationContracts.AttachmentIntentRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.attachmentIntent(id, request, principal));
    }

    @PostMapping("/{id}/attachments/{attachmentId}/complete")
    public ConsultationContracts.Attachment complete(@PathVariable UUID id, @PathVariable UUID attachmentId,
            @RequestBody(required = false) ConsultationContracts.AttachmentCompleteRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return service.completeAttachment(id, attachmentId, request, principal);
    }

    @GetMapping("/{id}/attachments/{attachmentId}/download")
    public ConsultationContracts.Attachment download(@PathVariable UUID id, @PathVariable UUID attachmentId,
                                                     @AuthenticationPrincipal UserDetails principal) {
        return service.downloadIntent(id, attachmentId, principal);
    }

    @GetMapping("/{id}/attachments/{attachmentId}")
    public ConsultationContracts.Attachment attachmentStatus(@PathVariable UUID id, @PathVariable UUID attachmentId,
            @AuthenticationPrincipal UserDetails principal) {
        return service.attachmentStatus(id, attachmentId, principal);
    }

}
