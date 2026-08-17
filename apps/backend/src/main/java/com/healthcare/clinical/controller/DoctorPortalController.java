package com.healthcare.clinical.controller;

import com.healthcare.clinical.dto.DiagnosticResultResponse;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.service.ClinicalService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctor")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorPortalController {

    private final ClinicalService clinicalService;

    public DoctorPortalController(ClinicalService clinicalService) {
        this.clinicalService = clinicalService;
    }

    @GetMapping("/patients/{patientId}/medical-records")
    public ResponseEntity<List<MedicalRecordResponse>> getPatientRecords(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getDoctorPatientRecords(patientId, userDetails));
    }

    @GetMapping("/patients/{patientId}/diagnostic-results")
    public ResponseEntity<List<DiagnosticResultResponse>> getPatientDiagnostics(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getDoctorPatientDiagnostics(patientId, userDetails));
    }
}
