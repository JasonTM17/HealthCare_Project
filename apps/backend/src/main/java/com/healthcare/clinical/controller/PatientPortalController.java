package com.healthcare.clinical.controller;

import com.healthcare.appointment.dto.PatientAppointmentResponse;
import com.healthcare.appointment.service.AppointmentPortalService;
import com.healthcare.appointment.service.PatientProfileService;
import com.healthcare.appointment.dto.PatientProfileResponse;
import com.healthcare.appointment.dto.UpdatePatientProfileRequest;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPortalController {

    private final ClinicalService clinicalService;
    private final AppointmentPortalService appointmentPortalService;
    private final PatientProfileService patientProfileService;

    public PatientPortalController(
            ClinicalService clinicalService,
            AppointmentPortalService appointmentPortalService,
            PatientProfileService patientProfileService) {
        this.clinicalService = clinicalService;
        this.appointmentPortalService = appointmentPortalService;
        this.patientProfileService = patientProfileService;
    }

    @GetMapping("/profile")
    public ResponseEntity<PatientProfileResponse> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(patientProfileService.getProfile(userDetails));
    }

    @PutMapping("/profile")
    public ResponseEntity<PatientProfileResponse> updateProfile(
            @Valid @RequestBody UpdatePatientProfileRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(patientProfileService.updateProfile(request, userDetails));
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
