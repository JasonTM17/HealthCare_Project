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
    String emergencyContactPhone
) {
}
