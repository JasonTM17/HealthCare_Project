package com.healthcare.scheduling.controller;

import com.healthcare.scheduling.dto.DoctorScheduleRequest;
import com.healthcare.scheduling.dto.DoctorScheduleResponse;
import com.healthcare.scheduling.dto.DoctorScheduleExceptionRequest;
import com.healthcare.scheduling.dto.DoctorScheduleExceptionResponse;
import com.healthcare.scheduling.service.DoctorScheduleExceptionService;
import com.healthcare.scheduling.service.DoctorScheduleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;

@Tag(name = "Administration", description = "Quản trị hệ thống: Quản lý lịch hẹn, cơ sở, bác sĩ, gói khám, tài chính")
@RestController
@RequestMapping("/api/v1/admin/schedules")
@PreAuthorize("hasRole('ADMIN')")
public class AdminScheduleController {

    private final DoctorScheduleService scheduleService;
    private final DoctorScheduleExceptionService exceptionService;

    public AdminScheduleController(DoctorScheduleService scheduleService, DoctorScheduleExceptionService exceptionService) {
        this.scheduleService = scheduleService;
        this.exceptionService = exceptionService;
    }

    @Operation(summary = "Danh sách ngoại lệ lịch làm việc bác sĩ", description = "Lấy danh sách các ngày nghỉ phép, công tác hoặc điều chỉnh lịch trực")
    @GetMapping("/exceptions")
    public ResponseEntity<Page<DoctorScheduleExceptionResponse>> listExceptions(
            @PageableDefault(size = 50, sort = "exceptionDate") Pageable pageable) {
        return ResponseEntity.ok(exceptionService.list(pageable));
    }

    @Operation(summary = "Tạo ngoại lệ lịch làm việc", description = "Đăng ký ngày nghỉ hoặc đổi ca làm việc của bác sĩ tại cơ sở cụ thể")
    @PostMapping("/exceptions/doctors/{doctorId}/branches/{branchId}")
    public ResponseEntity<DoctorScheduleExceptionResponse> createException(
            @PathVariable UUID doctorId, @PathVariable UUID branchId,
            @Valid @RequestBody DoctorScheduleExceptionRequest request) {
        return ResponseEntity.ok(exceptionService.create(doctorId, branchId, request));
    }

    @Operation(summary = "Cập nhật ngoại lệ lịch làm việc", description = "Chỉnh sửa lý do hoặc thời gian ngoại lệ lịch")
    @PutMapping("/exceptions/{exceptionId}")
    public ResponseEntity<DoctorScheduleExceptionResponse> updateException(
            @PathVariable UUID exceptionId, @Valid @RequestBody DoctorScheduleExceptionRequest request) {
        return ResponseEntity.ok(exceptionService.update(exceptionId, request));
    }

    @Operation(summary = "Xóa ngoại lệ lịch làm việc", description = "Khôi phục lịch làm việc bình thường của bác sĩ")
    @DeleteMapping("/exceptions/{exceptionId}")
    public ResponseEntity<Void> deleteException(@PathVariable UUID exceptionId) {
        exceptionService.delete(exceptionId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Danh sách lịch làm việc cố định", description = "Lấy danh sách phân ca định kỳ trong tuần của bác sĩ tại các cơ sở")
    @GetMapping
    public ResponseEntity<Page<DoctorScheduleResponse>> list(
            @PageableDefault(size = 50, sort = "effectiveFrom") Pageable pageable) {
        return ResponseEntity.ok(scheduleService.listSchedules(pageable));
    }

    @Operation(summary = "Thiết lập lịch làm việc cố định mới", description = "Tạo ca khám định kỳ cho bác sĩ tại cơ sở")
    @PostMapping("/doctors/{doctorId}/branches/{branchId}")
    public ResponseEntity<DoctorScheduleResponse> create(
            @PathVariable UUID doctorId,
            @PathVariable UUID branchId,
            @Valid @RequestBody DoctorScheduleRequest request) {
        return ResponseEntity.ok(DoctorScheduleResponse.from(scheduleService.createSchedule(doctorId, branchId, request)));
    }

    @Operation(summary = "Cập nhật ca khám làm việc", description = "Chỉnh sửa khung giờ làm việc định kỳ")
    @PutMapping("/{scheduleId}")
    public ResponseEntity<DoctorScheduleResponse> update(
            @PathVariable UUID scheduleId,
            @Valid @RequestBody DoctorScheduleRequest request) {
        return ResponseEntity.ok(DoctorScheduleResponse.from(scheduleService.updateSchedule(scheduleId, request)));
    }

    @Operation(summary = "Xóa ca khám làm việc", description = "Hủy bỏ ca khám định kỳ của bác sĩ")
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> delete(@PathVariable UUID scheduleId) {
        scheduleService.deleteSchedule(scheduleId);
        return ResponseEntity.noContent().build();
    }
}
