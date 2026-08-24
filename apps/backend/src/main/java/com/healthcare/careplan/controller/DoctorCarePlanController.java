package com.healthcare.careplan.controller;

import com.healthcare.careplan.dto.CarePlanContracts;
import com.healthcare.careplan.service.CarePlanService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/doctor/care-plans")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorCarePlanController {
    private final CarePlanService service;
    public DoctorCarePlanController(CarePlanService service) { this.service = service; }

    @GetMapping
    public List<CarePlanContracts.Plan> list(@AuthenticationPrincipal UserDetails principal) { return service.doctorPlans(principal); }

    @PostMapping
    public ResponseEntity<CarePlanContracts.Plan> create(@Valid @RequestBody CarePlanContracts.CreateRequest request,
                                                          @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, principal));
    }
}
