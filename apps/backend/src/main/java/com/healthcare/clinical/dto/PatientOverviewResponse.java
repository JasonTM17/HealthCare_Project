package com.healthcare.clinical.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/** Minimal patient dashboard summary; clinical payloads stay behind portal endpoints. */
public record PatientOverviewResponse(
    LatestAppointment latestAppointment,
    long appointmentCount,
    long diagnosticResultCount,
    long prescriptionCount,
    boolean newDiagnosticResult,
    boolean newPrescription,
    long unreadNotificationCount,
    long unreadConsultationCount,
    long openCarePlanTaskCount
) {
    public record LatestAppointment(
        LocalDate appointmentDate,
        LocalTime startTime,
        String status,
        String paymentStatus
    ) { }
}
