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
@RequestMapping("/api/v1/doctor/health-questions")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorHealthQuestionController {
    private final HealthQuestionService service;
    public DoctorHealthQuestionController(HealthQuestionService service) { this.service = service; }
    @GetMapping
    public List<HealthQuestionContracts.Summary> queue(@AuthenticationPrincipal UserDetails principal) {
        return service.doctorQueue(principal);
    }
    @PutMapping("/{id}/answer")
    public void answer(@PathVariable UUID id, @Valid @RequestBody HealthQuestionContracts.AnswerRequest request,
                       @AuthenticationPrincipal UserDetails principal) { service.answer(id, request, principal); }
    @PutMapping("/{id}/decision")
    public void decision(@PathVariable UUID id, @Valid @RequestBody HealthQuestionContracts.DecisionRequest request,
                         @AuthenticationPrincipal UserDetails principal) { service.decide(id, request, principal); }
}
