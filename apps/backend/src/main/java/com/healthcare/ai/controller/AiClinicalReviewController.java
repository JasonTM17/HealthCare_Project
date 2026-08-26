package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiClinicalReviewService;
import com.healthcare.ai.controller.ClinicalReviewContracts.DecisionRequest;
import com.healthcare.ai.controller.ClinicalReviewContracts.SubmissionRequest;
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

@RestController
@RequestMapping("/api/v1")
public class AiClinicalReviewController {

    private final AiClinicalReviewService service;

    public AiClinicalReviewController(AiClinicalReviewService service) {
        this.service = service;
    }

    @PutMapping("/admin/ai-content/{type}/{id}/submission")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> submit(
            @PathVariable String type,
            @PathVariable UUID id,
            @Valid @RequestBody SubmissionRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.submit(type, id, request.revision(), request.contentHash(), principal));
    }

    @GetMapping("/admin/ai-content")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> adminInventory(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "ALL") String state,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.adminQueuePage(type, state, page, size));
    }

    @GetMapping("/doctor/ai-content/reviews")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<Map<String, Object>> queue(
            @RequestParam(defaultValue = "SUBMITTED") String state,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(service.queuePage(state, page, size));
    }

    @GetMapping("/doctor/ai-content/{type}/{id}/revisions/{revision}")
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<Map<String, Object>> revision(
            @PathVariable String type,
            @PathVariable UUID id,
            @PathVariable long revision) {
        return ResponseEntity.ok(service.revision(type, id, revision));
    }

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
