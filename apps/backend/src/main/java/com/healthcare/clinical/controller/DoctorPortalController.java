package com.healthcare.clinical.controller;

import com.healthcare.appointment.dto.DoctorAppointmentResponse;
import com.healthcare.appointment.service.AppointmentPortalService;
import com.healthcare.clinical.dto.DiagnosticResultResponse;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.service.ClinicalService;
import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.service.DoctorService;
import com.healthcare.security.HealthcareUserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctor")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorPortalController {

    private final ClinicalService clinicalService;
    private final AppointmentPortalService appointmentPortalService;
    private final DoctorService doctorService;

    public DoctorPortalController(
            ClinicalService clinicalService,
            AppointmentPortalService appointmentPortalService,
            DoctorService doctorService) {
        this.clinicalService = clinicalService;
        this.appointmentPortalService = appointmentPortalService;
        this.doctorService = doctorService;
    }

    @GetMapping("/profile")
    public ResponseEntity<DoctorResponse> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        if (!(userDetails instanceof HealthcareUserPrincipal principal)) {
            throw new org.springframework.security.access.AccessDeniedException("Authenticated doctor profile is unavailable");
        }
        return ResponseEntity.ok(doctorService.getByUserId(principal.getUserId()));
    }

    @GetMapping("/appointments")
    public ResponseEntity<Page<DoctorAppointmentResponse>> getAppointments(
            @RequestParam String date,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
            appointmentPortalService.getDoctorAppointments(date, status, userDetails, pageable));
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
