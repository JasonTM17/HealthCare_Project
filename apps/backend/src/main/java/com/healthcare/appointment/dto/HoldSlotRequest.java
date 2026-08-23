package com.healthcare.appointment.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record HoldSlotRequest(
    @NotNull UUID doctorId,
    @NotNull LocalDate appointmentDate,
    @NotNull LocalTime startTime,
    @NotBlank @Size(max = 160) String fullName,
    @NotBlank @Size(min = 7, max = 20)
    @Pattern(regexp = "^[+0-9() .-]+$", message = "Số điện thoại không hợp lệ") String phone,
    @NotBlank @Email @Size(max = 320) String email,
    @Size(max = 1000) String reasonForVisit,
    UUID specialtyId,
    UUID branchId,
    UUID packageId,
    Boolean hasInsurance,
    @NotNull @AssertTrue(message = "Cần đồng ý chính sách bảo mật trước khi đặt lịch") Boolean privacyConsent
) {
    public HoldSlotRequest(
            UUID doctorId,
            LocalDate appointmentDate,
            LocalTime startTime,
            String fullName,
            String phone,
            String email,
            String reasonForVisit,
            UUID specialtyId,
            UUID branchId,
            UUID packageId) {
        this(
            doctorId,
            appointmentDate,
            startTime,
            fullName,
            phone,
            email,
            reasonForVisit,
            specialtyId,
            branchId,
            packageId,
            false,
            true
        );
    }
}
