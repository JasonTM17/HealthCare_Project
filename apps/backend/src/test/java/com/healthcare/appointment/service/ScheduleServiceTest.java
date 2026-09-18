package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScheduleServiceTest {

    private DoctorScheduleRepository doctorScheduleRepository;
    private DoctorScheduleExceptionRepository exceptionRepository;
    private AppointmentRepository appointmentRepository;
    private DoctorRepository doctorRepository;
    private ScheduleService scheduleService;

    private UUID doctorId;
    private UUID branchId;
    private Doctor activeDoctor;

    @BeforeEach
    void setUp() {
        doctorScheduleRepository = mock(DoctorScheduleRepository.class);
        exceptionRepository = mock(DoctorScheduleExceptionRepository.class);
        appointmentRepository = mock(AppointmentRepository.class);
        doctorRepository = mock(DoctorRepository.class);

        scheduleService = new ScheduleService(
            doctorScheduleRepository,
            exceptionRepository,
            appointmentRepository,
            doctorRepository
        );

        doctorId = UUID.randomUUID();
        branchId = UUID.randomUUID();

        activeDoctor = new Doctor();
        activeDoctor.setId(doctorId);
        activeDoctor.setActive(true);

        when(doctorRepository.findById(doctorId)).thenReturn(Optional.of(activeDoctor));
        when(appointmentRepository.findAllOccupiedSlots(any(), any(), any(), any()))
            .thenReturn(Collections.emptyList());
    }

    @Test
    void returnsDefaultWindowsWhenSchedulesAreEmptyForActiveDoctor() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        int dayOfWeek = futureDate.getDayOfWeek().getValue();

        when(doctorScheduleRepository.findActiveForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(futureDate), eq(dayOfWeek)))
            .thenReturn(Collections.emptyList());
        when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(futureDate)))
            .thenReturn(Collections.emptyList());

        List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, futureDate);

        assertThat(slots).isNotEmpty();
        assertThat(slots).hasSize(16);
        assertThat(slots).allMatch(slot -> slot.branchId().equals(branchId));
        assertThat(slots.get(0).startTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(slots.get(0).available()).isTrue();
    }

    @Test
    void respectsLeaveOrBlockedException() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        int dayOfWeek = futureDate.getDayOfWeek().getValue();

        when(doctorScheduleRepository.findActiveForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(futureDate), eq(dayOfWeek)))
            .thenReturn(Collections.emptyList());

        DoctorScheduleException leave = new DoctorScheduleException();
        leave.setType("LEAVE");
        leave.setExceptionDate(futureDate);

        when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(futureDate)))
            .thenReturn(List.of(leave));

        List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, futureDate);
        assertThat(slots).isEmpty();
    }

    @Test
    void returnsPersistedSchedulesWhenAvailable() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        int dayOfWeek = futureDate.getDayOfWeek().getValue();

        Branch branch = new Branch();
        branch.setId(branchId);

        DoctorSchedule persisted = new DoctorSchedule();
        persisted.setId(UUID.randomUUID());
        persisted.setDoctor(activeDoctor);
        persisted.setBranch(branch);
        persisted.setDayOfWeek(dayOfWeek);
        persisted.setStartTime(LocalTime.of(9, 0));
        persisted.setEndTime(LocalTime.of(11, 0));
        persisted.setSlotDurationMinutes(30);
        persisted.setActive(true);

        when(doctorScheduleRepository.findActiveForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(futureDate), eq(dayOfWeek)))
            .thenReturn(List.of(persisted));
        when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(futureDate)))
            .thenReturn(Collections.emptyList());

        List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, futureDate);

        assertThat(slots).hasSize(4); // 09:00, 09:30, 10:00, 10:30
        assertThat(slots.get(0).startTime()).isEqualTo(LocalTime.of(9, 0));
        assertThat(slots.get(3).startTime()).isEqualTo(LocalTime.of(10, 30));
    }

    @Test
    void returnsEmptyListForInactiveDoctor() {
        activeDoctor.setActive(false);
        LocalDate futureDate = LocalDate.now().plusDays(3);

        List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, futureDate);
        assertThat(slots).isEmpty();
    }
}
