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
import java.util.UUID;

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

    @PutMapping("/{planId}")
    public CarePlanContracts.Plan update(@PathVariable UUID planId,
                                         @Valid @RequestBody CarePlanContracts.UpdateRequest request,
                                         @AuthenticationPrincipal UserDetails principal) {
        return service.update(planId, request, principal);
    }

    @DeleteMapping("/{planId}")
    public ResponseEntity<Void> delete(@PathVariable UUID planId,
                                       @AuthenticationPrincipal UserDetails principal) {
        service.delete(planId, principal);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/items/{itemId}/complete")
    public CarePlanContracts.Item completeItem(@PathVariable UUID itemId,
                                               @AuthenticationPrincipal UserDetails principal) {
        return service.doctorComplete(itemId, principal);
    }

    @PostMapping("/items/{itemId}/cancel")
    public CarePlanContracts.Item cancelItem(@PathVariable UUID itemId,
                                             @AuthenticationPrincipal UserDetails principal) {
        return service.doctorCancel(itemId, principal);
    }
}
