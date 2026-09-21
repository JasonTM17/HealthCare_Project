package com.healthcare.appointment.controller;

import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.dto.CancelAppointmentRequest;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.HoldSlotResponse;
import com.healthcare.appointment.dto.ResendBookingOtpRequest;
import com.healthcare.appointment.dto.ResendOtpResponse;
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
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Tag(name = "Appointment & Booking", description = "Đặt lịch khám, giữ chỗ tạm thời, xác thực OTP và đổi/hủy lịch")
@RestController
@RequestMapping("/api/v1/appointments")
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

    @Operation(summary = "Lấy danh sách khung giờ khám còn trống của bác sĩ", description = "Tra cứu các khung giờ khả dụng theo bác sĩ, cơ sở và ngày khám")
    @GetMapping("/doctors/{doctorId}/slots")
    public ResponseEntity<List<TimeSlotDto>> getDoctorSlots(
            @PathVariable UUID doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) UUID branchId) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(scheduleService.getAvailableSlots(doctorId, branchId, date));
    }

    @Operation(summary = "Giữ chỗ tạm thời khung giờ khám (10 phút)", description = "Khóa tạm thời khung giờ khám để tránh đặt trùng (double-booking) và gửi mã OTP xác nhận")
    @PostMapping("/hold")
    public ResponseEntity<HoldSlotResponse> holdSlot(
            @Valid @RequestBody HoldSlotRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("hold", httpRequest, request.phone());
        // A retried request that reuses its key returns the original hold, so a
        // lost response cannot turn into a duplicate hold or a slot conflict.
        HoldSlotResponse response = bookingService.holdSlot(request, userDetails, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Gửi lại mã xác thực OTP đặt lịch", description = "Gửi lại mã OTP đặt lịch qua email khi người bệnh chưa nhận được. Hệ thống chỉ gửi OTP qua email (NotificationChannel: EMAIL), không gửi SMS")
    @PostMapping("/{bookingCode}/otp/resend")
    public ResponseEntity<ResendOtpResponse> resendOtp(
            @PathVariable String bookingCode,
            @Valid @RequestBody(required = false) ResendBookingOtpRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("otp-resend", httpRequest, bookingCode);
        String phone = request == null ? null : request.phone();
        return ResponseEntity.accepted().body(
            bookingService.resendBookingOtp(bookingCode, phone, userDetails)
        );
    }

    @Operation(summary = "Xác nhận lịch khám bằng mã OTP", description = "Nhập mã OTP để xác nhận đặt lịch khám chính thức")
    @PostMapping("/confirm")
    public ResponseEntity<AppointmentResponse> confirmAppointment(
            @Valid @RequestBody ConfirmAppointmentRequest request,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("confirm", httpRequest, request.bookingCode());
        return ResponseEntity.ok(bookingService.confirmAppointment(request));
    }

    @Operation(summary = "Tra cứu thông tin lịch hẹn bằng mã đặt lịch", description = "Xem chi tiết lịch hẹn khám, thông tin bác sĩ, cơ sở và trạng thái")
    @GetMapping("/{bookingCode}")
    public ResponseEntity<AppointmentResponse> getAppointment(
            @PathVariable String bookingCode,
            @RequestParam(required = false) String phone,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("lookup", httpRequest, bookingCode);
        return ResponseEntity.ok(bookingService.getAppointment(bookingCode, phone, userDetails));
    }

    @Operation(summary = "Hủy lịch khám đã đặt", description = "Hủy lịch khám theo yêu cầu của bệnh nhân kèm lý do hủy")
    @PostMapping("/{bookingCode}/cancel")
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

    @Operation(summary = "Dời lịch khám sang khung giờ khả dụng khác", description = "Thay đổi ngày giờ hoặc bác sĩ khám cho lịch hẹn đã xác nhận")
    @PostMapping("/{bookingCode}/reschedule")
    public ResponseEntity<AppointmentResponse> rescheduleAppointment(
            @PathVariable String bookingCode,
            @Valid @RequestBody RescheduleAppointmentRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest httpRequest) {
        bookingRateLimiter.check("reschedule", httpRequest, bookingCode);
        return ResponseEntity.ok(bookingService.rescheduleAppointment(bookingCode, request, userDetails));
    }
}
