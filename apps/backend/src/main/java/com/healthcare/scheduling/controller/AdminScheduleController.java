package com.healthcare.scheduling.controller;

import com.healthcare.scheduling.entity.DoctorSchedule;
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

import java.util.UUID;

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

    @GetMapping("/exceptions")
    public ResponseEntity<Page<DoctorScheduleExceptionResponse>> listExceptions(
            @PageableDefault(size = 50, sort = "exceptionDate") Pageable pageable) {
        return ResponseEntity.ok(exceptionService.list(pageable));
    }

    @PostMapping("/exceptions/doctors/{doctorId}/branches/{branchId}")
    public ResponseEntity<DoctorScheduleExceptionResponse> createException(
            @PathVariable UUID doctorId, @PathVariable UUID branchId,
            @Valid @RequestBody DoctorScheduleExceptionRequest request) {
        return ResponseEntity.ok(exceptionService.create(doctorId, branchId, request));
    }

    @PutMapping("/exceptions/{exceptionId}")
    public ResponseEntity<DoctorScheduleExceptionResponse> updateException(
            @PathVariable UUID exceptionId, @Valid @RequestBody DoctorScheduleExceptionRequest request) {
        return ResponseEntity.ok(exceptionService.update(exceptionId, request));
    }

    @DeleteMapping("/exceptions/{exceptionId}")
    public ResponseEntity<Void> deleteException(@PathVariable UUID exceptionId) {
        exceptionService.delete(exceptionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<Page<DoctorScheduleResponse>> list(
            @PageableDefault(size = 50, sort = "effectiveFrom") Pageable pageable) {
        return ResponseEntity.ok(scheduleService.listSchedules(pageable));
    }

    @PostMapping("/doctors/{doctorId}/branches/{branchId}")
    public ResponseEntity<DoctorSchedule> create(
            @PathVariable UUID doctorId,
            @PathVariable UUID branchId,
            @Valid @RequestBody DoctorScheduleRequest request) {
        return ResponseEntity.ok(scheduleService.createSchedule(doctorId, branchId, request));
    }

    @PutMapping("/{scheduleId}")
    public ResponseEntity<DoctorSchedule> update(
            @PathVariable UUID scheduleId,
            @Valid @RequestBody DoctorScheduleRequest request) {
        return ResponseEntity.ok(scheduleService.updateSchedule(scheduleId, request));
    }

    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> delete(@PathVariable UUID scheduleId) {
        scheduleService.deleteSchedule(scheduleId);
        return ResponseEntity.noContent().build();
    }
}
