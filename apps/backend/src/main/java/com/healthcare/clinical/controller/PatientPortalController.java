package com.healthcare.clinical.controller;

import com.healthcare.appointment.dto.PatientAppointmentResponse;
import com.healthcare.appointment.service.AppointmentPortalService;
import com.healthcare.clinical.dto.DiagnosticResultResponse;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.dto.PrescriptionResponse;
import com.healthcare.clinical.service.ClinicalService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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
    private final AppointmentPortalService appointmentPortalService;

    public PatientPortalController(
            ClinicalService clinicalService,
            AppointmentPortalService appointmentPortalService) {
        this.clinicalService = clinicalService;
        this.appointmentPortalService = appointmentPortalService;
    }

    @GetMapping("/appointments")
    public ResponseEntity<Page<PatientAppointmentResponse>> getAppointments(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(appointmentPortalService.getPatientAppointments(userDetails, pageable));
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
