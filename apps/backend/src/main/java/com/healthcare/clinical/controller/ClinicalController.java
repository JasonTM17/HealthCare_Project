package com.healthcare.clinical.controller;

import com.healthcare.clinical.dto.CreateMedicalRecordRequest;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.dto.PrescriptionResponse;
import com.healthcare.clinical.service.ClinicalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/clinical")
@Tag(name = "Clinical Records & Prescriptions", description = "Authenticated clinical records and prescription APIs")
public class ClinicalController {

    private final ClinicalService clinicalService;

    public ClinicalController(ClinicalService clinicalService) {
        this.clinicalService = clinicalService;
    }

    @PostMapping("/records")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    @Operation(summary = "Doctor creates a clinical medical record and prescription")
    public ResponseEntity<MedicalRecordResponse> createRecord(
            @Valid @RequestBody CreateMedicalRecordRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(clinicalService.createMedicalRecord(request, userDetails));
    }

    @GetMapping("/records/{id}")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    @Operation(summary = "Get a clinical medical record owned by the current user or role")
    public ResponseEntity<MedicalRecordResponse> getRecord(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getMedicalRecord(id, userDetails));
    }

    @GetMapping("/patients/{patientId}/records")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    @Operation(summary = "Get an authorized patient's medical history")
    public ResponseEntity<Page<MedicalRecordResponse>> getPatientRecords(
            @PathVariable UUID patientId,
            @PageableDefault(size = 10) Pageable pageable,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientRecords(patientId, pageable, userDetails));
    }

    @GetMapping("/prescriptions/{code}")
    @PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
    @Operation(summary = "Get a prescription visible to the current user or role")
    public ResponseEntity<PrescriptionResponse> getPrescription(
            @PathVariable String code,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPrescriptionByCode(code, userDetails));
    }
}
