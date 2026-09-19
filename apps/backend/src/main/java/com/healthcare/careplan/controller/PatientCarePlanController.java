package com.healthcare.careplan.controller;

import com.healthcare.careplan.dto.CarePlanContracts;
import com.healthcare.careplan.service.CarePlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient/care-plans")
@PreAuthorize("hasRole('PATIENT')")
@Tag(name = "Patient Care Plans", description = "Kế hoạch chăm sóc và lộ trình điều trị của người bệnh")
@SecurityRequirement(name = "bearerAuth")
public class PatientCarePlanController {
    private final CarePlanService service;
    public PatientCarePlanController(CarePlanService service) { this.service = service; }

    @Operation(summary = "Kế hoạch chăm sóc của tôi", description = "Người bệnh xem danh sách kế hoạch chăm sóc và mục tiêu điều trị được bác sĩ thiết lập")
    @GetMapping
    public List<CarePlanContracts.Plan> list(@AuthenticationPrincipal UserDetails principal) { return service.patientPlans(principal); }

    @Operation(summary = "Cập nhật tiến độ hoàn thành", description = "Người bệnh đánh dấu hoàn thành một nhiệm vụ trong kế hoạch chăm sóc (uống thuốc, tập luyện, đo chỉ số)")
    @PostMapping("/items/{itemId}/complete")
    public CarePlanContracts.Item complete(@PathVariable UUID itemId, @AuthenticationPrincipal UserDetails principal) {
        return service.complete(itemId, principal);
    }
}
