package com.healthcare.appointment.dto;

import com.healthcare.appointment.entity.PatientGender;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdatePatientProfileRequest(
    @NotBlank @Size(max = 160) String fullName,
    @Past LocalDate dateOfBirth,
    PatientGender gender,
    @Size(max = 500) String address,
    @Size(max = 160) String emergencyContactName,
    @Size(max = 20)
    @Pattern(regexp = "^[+0-9() .-]*$", message = "Số điện thoại liên hệ không hợp lệ")
    String emergencyContactPhone,
    @Size(max = 500) String avatarUrl,
    String medicalHistory,
    String allergies,
    @Size(max = 10) String bloodType,
    // Optional on update, required only when the account has no profile yet:
    // patient_profiles.phone is NOT NULL + UNIQUE, so a first-time save must
    // supply a real contact number (same canonicalization as booking/auth).
    @Size(max = 20)
    @Pattern(regexp = "^[+0-9() .-]*$", message = "Số điện thoại không hợp lệ")
    String phone
) {
    public UpdatePatientProfileRequest(
        String fullName,
        LocalDate dateOfBirth,
        PatientGender gender,
        String address,
        String emergencyContactName,
        String emergencyContactPhone
    ) {
        this(fullName, dateOfBirth, gender, address, emergencyContactName, emergencyContactPhone, null, null, null, null, null);
    }
}
