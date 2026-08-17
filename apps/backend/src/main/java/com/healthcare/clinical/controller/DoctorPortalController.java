package com.healthcare.clinical.controller;

import com.healthcare.clinical.entity.DiagnosticResult;
import com.healthcare.clinical.entity.MedicalRecord;
import com.healthcare.clinical.entity.Prescription;
import com.healthcare.clinical.repository.DiagnosticResultRepository;
import com.healthcare.clinical.repository.MedicalRecordRepository;
import com.healthcare.clinical.repository.PrescriptionRepository;
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

    private final MedicalRecordRepository medicalRecordRepository;
    private final DiagnosticResultRepository diagnosticResultRepository;

    public DoctorPortalController(MedicalRecordRepository medicalRecordRepository, DiagnosticResultRepository diagnosticResultRepository) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.diagnosticResultRepository = diagnosticResultRepository;
    }

    @GetMapping("/patients/{patientId}/medical-records")
    public ResponseEntity<List<MedicalRecord>> getPatientRecords(@PathVariable UUID patientId) {
        return ResponseEntity.ok(medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientId));
    }

    @GetMapping("/patients/{patientId}/diagnostic-results")
    public ResponseEntity<List<DiagnosticResult>> getPatientDiagnostics(@PathVariable UUID patientId) {
        return ResponseEntity.ok(diagnosticResultRepository.findByPatientIdOrderByTestDateDesc(patientId));
    }
}
