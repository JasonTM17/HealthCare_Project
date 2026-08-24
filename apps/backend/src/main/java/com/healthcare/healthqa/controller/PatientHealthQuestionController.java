package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient/health-questions")
@PreAuthorize("hasRole('PATIENT')")
public class PatientHealthQuestionController {
    private final HealthQuestionService service;
    public PatientHealthQuestionController(HealthQuestionService service) { this.service = service; }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HealthQuestionContracts.Summary create(@Valid @RequestBody HealthQuestionContracts.CreateRequest request,
                                                   @AuthenticationPrincipal UserDetails principal) { return service.create(request, principal); }
    @GetMapping
    public List<HealthQuestionContracts.Summary> list(@AuthenticationPrincipal UserDetails principal) { return service.patientList(principal); }

    @PostMapping("/{id}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public HealthQuestionContracts.ReportSummary report(
            @PathVariable UUID id,
            @Valid @RequestBody HealthQuestionContracts.ReportRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        return service.report(id, request, principal);
    }
}
