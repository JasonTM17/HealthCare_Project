package com.healthcare.appointment.dto;

import com.healthcare.appointment.entity.AppointmentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/v1/admin/appointments/{id}/status}.
 *
 * <p>The endpoint has exactly one legal target: moving a live appointment
 * (PENDING_CONFIRMATION / CONFIRMED / CHECKED_IN / IN_PROGRESS) to
 * {@code CANCELLED}. The status field is therefore required and typed as the
 * enum rather than a free string, so an unknown value is rejected by Jackson
 * during deserialization instead of reaching the state machine.
 *
 * <p>{@code reason} is the operator's note for a cancellation phoned in by the
 * patient. It is optional, trimmed, and bounded by 500 characters because it is
 * persisted verbatim into {@code appointments.cancellation_reason VARCHAR(500)}.
 */
public record AdminCancelAppointmentRequest(
    @NotNull(message = "Trạng thái không được để trống")
    AppointmentStatus status,

    @Size(max = 500, message = "Lý do hủy tối đa 500 ký tự")
    String reason
) {
    public AdminCancelAppointmentRequest {
        if (reason != null) {
            String trimmed = reason.trim();
            reason = trimmed.isEmpty() ? null : trimmed;
        }
    }
}
