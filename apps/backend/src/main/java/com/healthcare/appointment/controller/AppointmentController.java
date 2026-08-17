package com.healthcare.appointment.controller;

import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.dto.CancelAppointmentRequest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.HoldSlotResponse;
import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.appointment.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/appointments")
@Tag(name = "Appointment & Booking", description = "Endpoints for doctor slots, temporary hold, OTP verification, and booking management")
public class AppointmentController {

    private final ScheduleService scheduleService;
    private final BookingService bookingService;

    public AppointmentController(ScheduleService scheduleService, BookingService bookingService) {
        this.scheduleService = scheduleService;
        this.bookingService = bookingService;
    }

    @GetMapping("/doctors/{doctorId}/slots")
    @Operation(summary = "Get available doctor appointment slots for a specific date")
    public ResponseEntity<List<TimeSlotDto>> getDoctorSlots(
            @PathVariable UUID doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(scheduleService.getAvailableSlots(doctorId, date));
    }

    @PostMapping("/hold")
    @Operation(summary = "Hold an appointment slot for 10 minutes (prevents double-booking)")
    public ResponseEntity<HoldSlotResponse> holdSlot(
            @Valid @RequestBody HoldSlotRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        HoldSlotResponse response = bookingService.holdSlot(request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/confirm")
    @Operation(summary = "Confirm an appointment with OTP code")
    public ResponseEntity<AppointmentResponse> confirmAppointment(@Valid @RequestBody ConfirmAppointmentRequest request) {
        return ResponseEntity.ok(bookingService.confirmAppointment(request));
    }

    @GetMapping("/{bookingCode}")
    @Operation(summary = "Look up appointment details by booking code")
    public ResponseEntity<AppointmentResponse> getAppointment(
            @PathVariable String bookingCode,
            @RequestParam(required = false) String phone,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(bookingService.getAppointment(bookingCode, phone, userDetails));
    }

    @PostMapping("/{bookingCode}/cancel")
    @Operation(summary = "Cancel an appointment")
    public ResponseEntity<AppointmentResponse> cancelAppointment(
            @PathVariable String bookingCode,
            @RequestBody(required = false) CancelAppointmentRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        String reason = request != null ? request.reason() : null;
        String phone = request != null ? request.phone() : null;
        return ResponseEntity.ok(bookingService.cancelAppointment(bookingCode, reason, phone, userDetails));
    }
}
