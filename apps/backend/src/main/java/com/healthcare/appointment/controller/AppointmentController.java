package com.healthcare.appointment.controller;

import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.dto.CancelAppointmentRequest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.HoldSlotResponse;
import com.healthcare.appointment.dto.RescheduleAppointmentRequest;
import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.security.BookingRateLimiter;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.appointment.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
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
    private final BookingRateLimiter bookingRateLimiter;

    public AppointmentController(ScheduleService scheduleService,
                                 BookingService bookingService,
                                 BookingRateLimiter bookingRateLimiter) {
        this.scheduleService = scheduleService;
        this.bookingService = bookingService;
        this.bookingRateLimiter = bookingRateLimiter;
    }

    @GetMapping("/doctors/{doctorId}/slots")
    @Operation(summary = "Get available doctor appointment slots for a specific date")
    public ResponseEntity<List<TimeSlotDto>> getDoctorSlots(
            @PathVariable UUID doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) UUID branchId) {
        return ResponseEntity.ok(scheduleService.getAvailableSlots(doctorId, branchId, date));
    }

    @PostMapping("/hold")
    @Operation(summary = "Hold an appointment slot for 10 minutes (prevents double-booking)")
    public ResponseEntity<HoldSlotResponse> holdSlot(
            @Valid @RequestBody HoldSlotRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("hold", httpRequest, request.phone());
        HoldSlotResponse response = bookingService.holdSlot(request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/confirm")
    @Operation(summary = "Confirm an appointment with OTP code")
    public ResponseEntity<AppointmentResponse> confirmAppointment(
            @Valid @RequestBody ConfirmAppointmentRequest request,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("confirm", httpRequest, request.bookingCode());
        return ResponseEntity.ok(bookingService.confirmAppointment(request));
    }

    @GetMapping("/{bookingCode}")
    @Operation(summary = "Look up appointment details by booking code")
    public ResponseEntity<AppointmentResponse> getAppointment(
            @PathVariable String bookingCode,
            @RequestParam(required = false) String phone,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("lookup", httpRequest, bookingCode);
        return ResponseEntity.ok(bookingService.getAppointment(bookingCode, phone, userDetails));
    }

    @PostMapping("/{bookingCode}/cancel")
    @Operation(summary = "Cancel an appointment")
    public ResponseEntity<AppointmentResponse> cancelAppointment(
            @PathVariable String bookingCode,
            @Valid @RequestBody(required = false) CancelAppointmentRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        String reason = request != null ? request.reason() : null;
        String phone = request != null ? request.phone() : null;
        bookingRateLimiter.check("cancel", httpRequest, bookingCode);
        return ResponseEntity.ok(bookingService.cancelAppointment(bookingCode, reason, phone, userDetails));
    }

    @PostMapping("/{bookingCode}/reschedule")
    @Operation(summary = "Reschedule a confirmed appointment to another available slot")
    public ResponseEntity<AppointmentResponse> rescheduleAppointment(
            @PathVariable String bookingCode,
            @Valid @RequestBody RescheduleAppointmentRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("reschedule", httpRequest, bookingCode);
        return ResponseEntity.ok(bookingService.rescheduleAppointment(bookingCode, request, userDetails));
    }
}
