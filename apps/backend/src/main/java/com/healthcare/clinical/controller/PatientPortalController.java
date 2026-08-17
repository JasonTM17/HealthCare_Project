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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPortalController {

    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final DiagnosticResultRepository diagnosticResultRepository;

    public PatientPortalController(MedicalRecordRepository medicalRecordRepository, PrescriptionRepository prescriptionRepository, DiagnosticResultRepository diagnosticResultRepository) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.diagnosticResultRepository = diagnosticResultRepository;
    }

    @GetMapping("/medical-records")
    public ResponseEntity<List<MedicalRecord>> getMedicalRecords(@AuthenticationPrincipal UserDetails userDetails) {
        UUID patientId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientId));
    }

    @GetMapping("/prescriptions")
    public ResponseEntity<List<Prescription>> getPrescriptions(@AuthenticationPrincipal UserDetails userDetails) {
        UUID patientId = UUID.fromString(userDetails.getUsername());
        List<MedicalRecord> records = medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        List<Prescription> prescriptions = records.stream()
            .flatMap(record -> prescriptionRepository.findByMedicalRecordId(record.getId()).stream())
            .toList();
        return ResponseEntity.ok(prescriptions);
    }

    @GetMapping("/diagnostic-results")
    public ResponseEntity<List<DiagnosticResult>> getDiagnosticResults(@AuthenticationPrincipal UserDetails userDetails) {
        UUID patientId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(diagnosticResultRepository.findByPatientIdOrderByTestDateDesc(patientId));
    }
}
