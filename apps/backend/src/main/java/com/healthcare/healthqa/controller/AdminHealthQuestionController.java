package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/health-questions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminHealthQuestionController {
    private final HealthQuestionService service;
    public AdminHealthQuestionController(HealthQuestionService service) { this.service = service; }
    @GetMapping
    public List<HealthQuestionContracts.Summary> queue(@RequestParam(required = false) String state) { return service.adminQueue(state); }
    @PutMapping("/{id}/moderation")
    public void moderate(@PathVariable UUID id, @Valid @RequestBody HealthQuestionContracts.ModerationRequest request,
                          @AuthenticationPrincipal UserDetails principal) { service.moderate(id, request, principal); }

    @GetMapping("/{id}/reports")
    public List<HealthQuestionContracts.ReportSummary> reports(
            @PathVariable UUID id, @RequestParam(required = false) String status) {
        return service.adminReports(id, status);
    }

    @PutMapping("/{id}/reports/{reportId}")
    public HealthQuestionContracts.ReportSummary decideReport(
            @PathVariable UUID id,
            @PathVariable UUID reportId,
            @Valid @RequestBody HealthQuestionContracts.ReportDecisionRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return service.decideReport(id, reportId, request, principal);
    }
}
