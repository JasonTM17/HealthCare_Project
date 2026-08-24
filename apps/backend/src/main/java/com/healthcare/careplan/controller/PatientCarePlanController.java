package com.healthcare.careplan.controller;

import com.healthcare.careplan.dto.CarePlanContracts;
import com.healthcare.careplan.service.CarePlanService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient/care-plans")
@PreAuthorize("hasRole('PATIENT')")
public class PatientCarePlanController {
    private final CarePlanService service;
    public PatientCarePlanController(CarePlanService service) { this.service = service; }

    @GetMapping
    public List<CarePlanContracts.Plan> list(@AuthenticationPrincipal UserDetails principal) { return service.patientPlans(principal); }

    @PostMapping("/items/{itemId}/complete")
    public CarePlanContracts.Item complete(@PathVariable UUID itemId, @AuthenticationPrincipal UserDetails principal) {
        return service.complete(itemId, principal);
    }
}
