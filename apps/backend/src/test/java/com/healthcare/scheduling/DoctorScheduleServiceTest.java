package com.healthcare.scheduling;

import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.dto.DoctorScheduleRequest;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.scheduling.repository.DoctorScheduleRepository;
import com.healthcare.scheduling.service.DoctorScheduleService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DoctorScheduleServiceTest {

    @Test
    void inactiveDoctorCanBeScheduledAndMutationsLockBeforeLoadingSchedule() {
        DoctorScheduleRepository schedules = mock(DoctorScheduleRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository assignments = mock(DoctorBranchRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId); doctor.setActive(false);
        Branch branch = new Branch(); branch.setId(branchId);
        when(doctors.findByIdForUpdate(doctorId)).thenReturn(Optional.of(doctor));
        when(branches.findById(branchId)).thenReturn(Optional.of(branch));
        when(assignments.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);
        when(schedules.save(org.mockito.ArgumentMatchers.any())).thenAnswer(call -> call.getArgument(0));
        var service = new DoctorScheduleService(schedules, doctors, assignments, branches, appointments);
        var request = new DoctorScheduleRequest(1, LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
            LocalDate.of(2030, 1, 1), null, true);
        DoctorSchedule schedule = service.createSchedule(doctorId, branchId, request);
        org.assertj.core.api.Assertions.assertThat(schedule.getDoctor().isActive()).isFalse();
        schedule.setId(scheduleId);
        when(schedules.findDoctorIdByScheduleId(scheduleId)).thenReturn(Optional.of(doctorId));
        when(schedules.findById(scheduleId)).thenReturn(Optional.of(schedule));
        org.mockito.Mockito.clearInvocations(schedules, doctors);
        service.updateSchedule(scheduleId, request);
        var updateOrder = org.mockito.Mockito.inOrder(schedules, doctors);
        updateOrder.verify(schedules).findDoctorIdByScheduleId(scheduleId);
        updateOrder.verify(doctors).findByIdForUpdate(doctorId);
        updateOrder.verify(schedules).findById(scheduleId);
        org.mockito.Mockito.clearInvocations(schedules, doctors);
        service.deleteSchedule(scheduleId);
        var deleteOrder = org.mockito.Mockito.inOrder(schedules, doctors);
        deleteOrder.verify(schedules).findDoctorIdByScheduleId(scheduleId);
        deleteOrder.verify(doctors).findByIdForUpdate(doctorId);
        deleteOrder.verify(schedules).findById(scheduleId);
        deleteOrder.verify(schedules).delete(schedule);
    }

    @Test
    void rejectsOverlappingActiveScheduleForTheSameDoctorAcrossBranches() {
        DoctorScheduleRepository schedules = mock(DoctorScheduleRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository assignments = mock(DoctorBranchRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        UUID otherBranchId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId);
        Branch branch = new Branch(); branch.setId(branchId);
        Branch otherBranch = new Branch(); otherBranch.setId(otherBranchId);
        when(doctors.findByIdForUpdate(doctorId)).thenReturn(Optional.of(doctor));
        when(branches.findById(branchId)).thenReturn(Optional.of(branch));
        when(assignments.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);

        // The same physician already works 08:00-12:00 that weekday, at another branch.
        DoctorSchedule existing = new DoctorSchedule();
        existing.setId(UUID.randomUUID()); existing.setDoctor(doctor); existing.setBranch(otherBranch);
        existing.setDayOfWeek(1); existing.setStartTime(LocalTime.of(8, 0)); existing.setEndTime(LocalTime.of(12, 0));
        existing.setEffectiveFrom(LocalDate.of(2026, 1, 1)); existing.setActive(true);
        when(schedules.findActiveForDoctorOnWeekday(doctorId, 1)).thenReturn(List.of(existing));

        DoctorScheduleService service = new DoctorScheduleService(schedules, doctors, assignments, branches, appointments);
        DoctorScheduleRequest request = new DoctorScheduleRequest(
            1, LocalTime.of(11, 30), LocalTime.of(15, 0), 30,
            LocalDate.of(2026, 8, 1), null, true);

        assertThatThrownBy(() -> service.createSchedule(doctorId, branchId, request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("overlaps")
            .extracting("status").isEqualTo(409);
    }

    @Test
    void updateIsRejectedWhenLiveBookingsExistAndAllowedWithForce() {
        DoctorScheduleRepository schedules = mock(DoctorScheduleRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository assignments = mock(DoctorBranchRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId);
        Branch branch = new Branch(); branch.setId(branchId);

        DoctorSchedule schedule = new DoctorSchedule();
        schedule.setId(scheduleId); schedule.setDoctor(doctor); schedule.setBranch(branch);
        schedule.setDayOfWeek(1); schedule.setStartTime(LocalTime.of(8, 0)); schedule.setEndTime(LocalTime.of(12, 0));
        schedule.setSlotDurationMinutes(30);
        schedule.setEffectiveFrom(LocalDate.of(2026, 1, 1)); schedule.setActive(true);

        when(schedules.findDoctorIdByScheduleId(scheduleId)).thenReturn(Optional.of(doctorId));
        when(doctors.findByIdForUpdate(doctorId)).thenReturn(Optional.of(doctor));
        when(schedules.findById(scheduleId)).thenReturn(Optional.of(schedule));
        when(schedules.findActiveForDoctorOnWeekday(eq(doctorId), anyInt())).thenReturn(List.of());
        when(schedules.save(any())).thenAnswer(call -> call.getArgument(0));
        when(appointments.countActiveBookingsForWeekday(eq(doctorId), eq(branchId), any(), any(), anyInt()))
            .thenReturn(3L);

        DoctorScheduleService service = new DoctorScheduleService(schedules, doctors, assignments, branches, appointments);
        DoctorScheduleRequest request = new DoctorScheduleRequest(
            1, LocalTime.of(13, 0), LocalTime.of(17, 0), 30,
            LocalDate.of(2026, 1, 1), null, true);

        // The change would close hours that three live appointments rely on.
        BusinessException guardFailure = (BusinessException) org.assertj.core.api.Assertions
            .catchThrowable(() -> service.updateSchedule(scheduleId, request, false));
        assertThat(guardFailure.getStatus()).isEqualTo(409);
        assertThat(guardFailure.getCode()).isEqualTo(ErrorCodes.SCHEDULE_HAS_ACTIVE_BOOKINGS);
        assertThat(guardFailure.getMessage()).contains("3");

        // force=true is the explicit admin override.
        DoctorSchedule updated = service.updateSchedule(scheduleId, request, true);
        assertThat(updated.getStartTime()).isEqualTo(LocalTime.of(13, 0));
        assertThat(updated.getEndTime()).isEqualTo(LocalTime.of(17, 0));
    }

    @Test
    void deleteIsRejectedWhenLiveBookingsExistAndAllowedWithForce() {
        DoctorScheduleRepository schedules = mock(DoctorScheduleRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository assignments = mock(DoctorBranchRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId);
        Branch branch = new Branch(); branch.setId(branchId);

        DoctorSchedule schedule = new DoctorSchedule();
        schedule.setId(scheduleId); schedule.setDoctor(doctor); schedule.setBranch(branch);
        schedule.setDayOfWeek(2); schedule.setStartTime(LocalTime.of(8, 0)); schedule.setEndTime(LocalTime.of(12, 0));
        schedule.setEffectiveFrom(LocalDate.of(2026, 1, 1)); schedule.setActive(true);

        when(schedules.findDoctorIdByScheduleId(scheduleId)).thenReturn(Optional.of(doctorId));
        when(doctors.findByIdForUpdate(doctorId)).thenReturn(Optional.of(doctor));
        when(schedules.findById(scheduleId)).thenReturn(Optional.of(schedule));
        when(appointments.countActiveBookingsForWeekday(eq(doctorId), eq(branchId), any(), any(), anyInt()))
            .thenReturn(1L);

        DoctorScheduleService service = new DoctorScheduleService(schedules, doctors, assignments, branches, appointments);

        assertThatThrownBy(() -> service.deleteSchedule(scheduleId))
            .isInstanceOf(BusinessException.class)
            .extracting("status").isEqualTo(409);
        verify(schedules, never()).delete(any(DoctorSchedule.class));

        service.deleteSchedule(scheduleId, true);
        verify(schedules).delete(schedule);
    }

    @Test
    void createDoesNotConsultTheBookingGuardBecauseItOnlyAddsHours() {
        DoctorScheduleRepository schedules = mock(DoctorScheduleRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository assignments = mock(DoctorBranchRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        UUID doctorId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId);
        Branch branch = new Branch(); branch.setId(branchId);
        when(doctors.findByIdForUpdate(doctorId)).thenReturn(Optional.of(doctor));
        when(branches.findById(branchId)).thenReturn(Optional.of(branch));
        when(assignments.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);
        when(schedules.findActiveForDoctorOnWeekday(any(), anyInt())).thenReturn(List.of());
        when(schedules.save(any())).thenAnswer(call -> call.getArgument(0));

        DoctorScheduleService service = new DoctorScheduleService(schedules, doctors, assignments, branches, appointments);
        DoctorScheduleRequest request = new DoctorScheduleRequest(
            3, LocalTime.of(8, 0), LocalTime.of(12, 0), 30,
            LocalDate.of(2030, 1, 1), null, true);

        assertThat(service.createSchedule(doctorId, branchId, request)).isNotNull();
        verify(appointments, never()).countActiveBookingsForWeekday(any(), any(), any(), any(), anyInt());
    }
}
