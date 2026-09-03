package com.healthcare.appointment.dto;

import com.healthcare.appointment.entity.PatientGender;
import com.healthcare.appointment.entity.PatientProfile;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PatientProfileResponse(
    UUID id,
    String fullName,
    String phone,
    String email,
    LocalDate dateOfBirth,
    PatientGender gender,
    String address,
    String emergencyContactName,
    String emergencyContactPhone,
    String avatarUrl,
    String medicalHistory,
    String allergies,
    String bloodType,
    String patientTier,
    Integer aiCredits,
    OffsetDateTime updatedAt
) {
    public PatientProfileResponse(
        UUID id,
        String fullName,
        String phone,
        String email,
        LocalDate dateOfBirth,
        PatientGender gender,
        String address,
        String emergencyContactName,
        String emergencyContactPhone,
        OffsetDateTime updatedAt
    ) {
        this(id, fullName, phone, email, dateOfBirth, gender, address, emergencyContactName, emergencyContactPhone, null, null, null, null, "STANDARD", 20, updatedAt);
    }

    public static PatientProfileResponse from(PatientProfile patient) {
        return new PatientProfileResponse(
            patient.getId(), patient.getFullName(), patient.getPhone(), patient.getEmail(),
            patient.getDateOfBirth(), patient.getGender(), patient.getAddress(),
            patient.getEmergencyContactName(), patient.getEmergencyContactPhone(),
            patient.getAvatarUrl(), patient.getMedicalHistory(), patient.getAllergies(), patient.getBloodType(),
            patient.getPatientTier(), patient.getAiCredits(),
            patient.getUpdatedAt()
        );
    }
}
