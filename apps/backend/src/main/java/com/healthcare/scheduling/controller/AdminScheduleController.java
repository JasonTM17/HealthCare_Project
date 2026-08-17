package com.healthcare.scheduling.controller;

import com.healthcare.scheduling.entity.DoctorSchedule;
import com.healthcare.scheduling.service.DoctorScheduleService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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

    public AdminScheduleController(DoctorScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }

    @PostMapping("/doctors/{doctorId}/branches/{branchId}")
    public ResponseEntity<DoctorSchedule> create(@PathVariable UUID doctorId, @PathVariable UUID branchId, @RequestBody DoctorSchedule schedule) {
        return ResponseEntity.ok(scheduleService.createSchedule(doctorId, branchId, schedule));
    }

    @PutMapping("/{scheduleId}")
    public ResponseEntity<DoctorSchedule> update(@PathVariable UUID scheduleId, @RequestBody DoctorSchedule schedule) {
        return ResponseEntity.ok(scheduleService.updateSchedule(scheduleId, schedule));
    }

    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> delete(@PathVariable UUID scheduleId) {
        scheduleService.deleteSchedule(scheduleId);
        return ResponseEntity.noContent().build();
    }
}
