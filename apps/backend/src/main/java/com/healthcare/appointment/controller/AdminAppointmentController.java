package com.healthcare.appointment.controller;

import com.healthcare.appointment.dto.AdminCancelAppointmentRequest;
import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.service.AdminAppointmentService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/appointments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAppointmentController {

    private final AdminAppointmentService appointmentService;

    public AdminAppointmentController(AdminAppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @Operation(summary = "Danh sách lịch hẹn toàn hệ thống", description = "Lấy danh sách lịch hẹn của toàn bộ các cơ sở và bác sĩ theo ngày và trạng thái")
    @GetMapping
    public ResponseEntity<Page<AppointmentResponse>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(appointmentService.list(date, status, pageable));
    }

    @Operation(
        summary = "Hủy lịch hẹn thay bệnh nhân",
        description = """
            Quản trị viên hủy một lịch hẹn còn hiệu lực (chờ xác nhận, đã xác nhận, đã tiếp nhận \
            hoặc đang khám) khi bệnh nhân yêu cầu qua điện thoại. Chỉ chấp nhận trạng thái đích \
            CANCELLED; lý do hủy là tùy chọn, tối đa 500 ký tự. Lịch hẹn đã hoàn thành, đã hủy \
            hoặc vắng mặt không thể hủy lại và trả về lỗi 409 \
            APPOINTMENT_STATUS_TRANSITION_INVALID. Mọi lần hủy thành công đều được ghi vào \
            nhật ký truy cập lâm sàng (hành động ADMIN_CANCEL_APPOINTMENT)."""
    )
    @PostMapping("/{appointmentId}/status")
    public ResponseEntity<AppointmentResponse> updateStatus(
            @PathVariable UUID appointmentId,
            @Valid @RequestBody AdminCancelAppointmentRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(appointmentService.cancel(appointmentId, request, userDetails));
    }
}
