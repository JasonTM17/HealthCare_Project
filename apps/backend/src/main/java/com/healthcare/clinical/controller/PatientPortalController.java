package com.healthcare.clinical.controller;

import com.healthcare.clinical.dto.DiagnosticResultResponse;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.dto.PrescriptionResponse;
import com.healthcare.clinical.service.ClinicalService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPortalController {

    private final ClinicalService clinicalService;

    public PatientPortalController(ClinicalService clinicalService) {
        this.clinicalService = clinicalService;
    }

    @GetMapping("/medical-records")
    public ResponseEntity<List<MedicalRecordResponse>> getMedicalRecords(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientPortalRecords(userDetails));
    }

    @GetMapping("/prescriptions")
    public ResponseEntity<List<PrescriptionResponse>> getPrescriptions(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientPortalPrescriptions(userDetails));
    }

    @GetMapping("/diagnostic-results")
    public ResponseEntity<List<DiagnosticResultResponse>> getDiagnosticResults(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientPortalDiagnostics(userDetails));
    }
}
