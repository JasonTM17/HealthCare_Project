package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

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
    private DoctorBranchRepository doctorBranchRepository;
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
        doctorBranchRepository = mock(DoctorBranchRepository.class);

        scheduleService = new ScheduleService(
            doctorScheduleRepository,
            exceptionRepository,
            appointmentRepository,
            doctorRepository,
            doctorBranchRepository
        );

        doctorId = UUID.randomUUID();
        branchId = UUID.randomUUID();

        activeDoctor = new Doctor();
        activeDoctor.setId(doctorId);
        activeDoctor.setActive(true);

        when(doctorRepository.findById(doctorId)).thenReturn(Optional.of(activeDoctor));
        when(doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);
        when(appointmentRepository.findAllOccupiedSlots(any(), any(), any(), any()))
            .thenReturn(Collections.emptyList());
    }

    /**
     * Only the explicit local-demo combination may fabricate clinic hours.
     */
    private ScheduleService demoEnabledService() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("local");
        environment.setProperty(ScheduleService.DEMO_DEFAULT_WINDOWS_PROPERTY, "true");
        return new ScheduleService(
            doctorScheduleRepository,
            exceptionRepository,
            appointmentRepository,
            doctorRepository,
            doctorBranchRepository,
            null,
            environment
        );
    }

    private void stubEmptySchedules(LocalDate date) {
        int dayOfWeek = date.getDayOfWeek().getValue();
        when(doctorScheduleRepository.findActiveForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(date), eq(dayOfWeek)))
            .thenReturn(Collections.emptyList());
        when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(date)))
            .thenReturn(Collections.emptyList());
    }

    @Test
    void returnsNoSlotsWhenSchedulesAreEmptyForActiveDoctor() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        stubEmptySchedules(futureDate);

        List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, futureDate);

        // No persisted schedule means the day is closed, not "standard clinic
        // hours". Nothing may be bookable from an invented window.
        assertThat(slots).isEmpty();
        assertThat(scheduleService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(9, 0))).isEmpty();
        assertThat(scheduleService.isBookableSlot(doctorId, branchId, futureDate, LocalTime.of(9, 0))).isFalse();
    }

    @Test
    void demoFlagWithLocalProfileOpensTheDemoWindows() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        stubEmptySchedules(futureDate);

        ScheduleService demoService = demoEnabledService();
        List<TimeSlotDto> slots = demoService.getAvailableSlots(doctorId, branchId, futureDate);

        assertThat(slots).isNotEmpty();
        // 8 morning slots (08:00 - 12:00) + 8 afternoon slots (13:30 - 17:30) = 16 slots
        assertThat(slots).hasSize(16);
        assertThat(slots).allMatch(slot -> slot.branchId().equals(branchId));

        assertThat(slots.get(0).startTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(slots.get(0).endTime()).isEqualTo(LocalTime.of(8, 30));
        assertThat(slots.get(0).available()).isTrue();

        assertThat(slots.get(7).startTime()).isEqualTo(LocalTime.of(11, 30));
        assertThat(slots.get(7).endTime()).isEqualTo(LocalTime.of(12, 0));

        assertThat(slots.get(8).startTime()).isEqualTo(LocalTime.of(13, 30));
        assertThat(slots.get(8).endTime()).isEqualTo(LocalTime.of(14, 0));

        assertThat(slots.get(15).startTime()).isEqualTo(LocalTime.of(17, 0));
        assertThat(slots.get(15).endTime()).isEqualTo(LocalTime.of(17, 30));
    }

    @Test
    void demoFlagOutsideTheLocalProfileStaysClosed() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        stubEmptySchedules(futureDate);

        MockEnvironment productionLike = new MockEnvironment();
        productionLike.setActiveProfiles("standalone");
        productionLike.setProperty(ScheduleService.DEMO_DEFAULT_WINDOWS_PROPERTY, "true");

        ScheduleService service = new ScheduleService(
            doctorScheduleRepository,
            exceptionRepository,
            appointmentRepository,
            doctorRepository,
            doctorBranchRepository,
            null,
            productionLike
        );

        // Fail closed: a flag enabled outside local must never open clinic hours.
        assertThat(service.getAvailableSlots(doctorId, branchId, futureDate)).isEmpty();
        assertThat(service.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(8, 0))).isEmpty();
    }

    @Test
    void boundarySlotsAreBookableAndLunchOrAfterHoursAreNot() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        stubEmptySchedules(futureDate);

        ScheduleService demoService = demoEnabledService();

        // Valid morning boundary slot 11:30 - 12:00
        Optional<ScheduleService.BookableSlot> morningBoundary =
            demoService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(11, 30));
        assertThat(morningBoundary).isPresent();
        assertThat(morningBoundary.get().startTime()).isEqualTo(LocalTime.of(11, 30));
        assertThat(morningBoundary.get().endTime()).isEqualTo(LocalTime.of(12, 0));

        // Valid afternoon boundary slot 17:00 - 17:30
        Optional<ScheduleService.BookableSlot> afternoonBoundary =
            demoService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(17, 0));
        assertThat(afternoonBoundary).isPresent();
        assertThat(afternoonBoundary.get().startTime()).isEqualTo(LocalTime.of(17, 0));
        assertThat(afternoonBoundary.get().endTime()).isEqualTo(LocalTime.of(17, 30));

        // Lunch break interval (12:00 - 13:30) must NOT be bookable
        assertThat(demoService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(12, 0))).isEmpty();
        assertThat(demoService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(12, 30))).isEmpty();
        assertThat(demoService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(13, 0))).isEmpty();

        // After clinic closing time (17:30) must NOT be bookable
        assertThat(demoService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(17, 30))).isEmpty();
        assertThat(demoService.findBookableSlot(doctorId, branchId, futureDate, LocalTime.of(18, 0))).isEmpty();
    }

    @Test
    void safeFallbackRespectsDoctorBranchAssociation() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        UUID unassignedBranchId = UUID.randomUUID();

        when(doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, unassignedBranchId))
            .thenReturn(false);

        List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, unassignedBranchId, futureDate);
        assertThat(slots).isEmpty();

        Optional<ScheduleService.BookableSlot> slot =
            scheduleService.findBookableSlot(doctorId, unassignedBranchId, futureDate, LocalTime.of(8, 0));
        assertThat(slot).isEmpty();
    }

    @Test
    void branchlessRequestIsClosedWithoutTheDemoFlag() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        int dayOfWeek = futureDate.getDayOfWeek().getValue();

        when(doctorScheduleRepository.findActiveForDoctorOnDate(eq(doctorId), eq(futureDate), eq(dayOfWeek)))
            .thenReturn(Collections.emptyList());

        Branch branch1 = new Branch();
        branch1.setId(UUID.randomUUID());
        branch1.setActive(true);

        DoctorBranch assignment = new DoctorBranch();
        assignment.setId(UUID.randomUUID());
        assignment.setDoctor(activeDoctor);
        assignment.setBranch(branch1);

        when(doctorBranchRepository.findByDoctorId(doctorId)).thenReturn(List.of(assignment));
        when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), any(), eq(futureDate)))
            .thenReturn(Collections.emptyList());

        // The branchless path used to expand the fabricated standard hours for
        // every assigned branch. Without the local demo flag it is closed too.
        assertThat(scheduleService.getAvailableSlots(doctorId, null, futureDate)).isEmpty();
    }

    @Test
    void demoFlagExpandsBranchlessRequestAcrossAllActiveBranches() {
        LocalDate futureDate = LocalDate.now().plusDays(5);
        int dayOfWeek = futureDate.getDayOfWeek().getValue();

        when(doctorScheduleRepository.findActiveForDoctorOnDate(eq(doctorId), eq(futureDate), eq(dayOfWeek)))
            .thenReturn(Collections.emptyList());

        UUID branch1Id = UUID.randomUUID();
        Branch branch1 = new Branch();
        branch1.setId(branch1Id);
        branch1.setActive(true);

        UUID branch2Id = UUID.randomUUID();
        Branch branch2 = new Branch();
        branch2.setId(branch2Id);
        branch2.setActive(true);

        DoctorBranch db1 = new DoctorBranch();
        db1.setId(UUID.randomUUID());
        db1.setDoctor(activeDoctor);
        db1.setBranch(branch1);

        DoctorBranch db2 = new DoctorBranch();
        db2.setId(UUID.randomUUID());
        db2.setDoctor(activeDoctor);
        db2.setBranch(branch2);

        when(doctorBranchRepository.findByDoctorId(doctorId)).thenReturn(List.of(db1, db2));
        when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), any(), eq(futureDate)))
            .thenReturn(Collections.emptyList());

        List<TimeSlotDto> slots = demoEnabledService().getAvailableSlots(doctorId, null, futureDate);

        // 16 slots per branch * 2 branches = 32 slots total
        assertThat(slots).hasSize(32);
        long branch1Slots = slots.stream().filter(s -> branch1Id.equals(s.branchId())).count();
        long branch2Slots = slots.stream().filter(s -> branch2Id.equals(s.branchId())).count();
        assertThat(branch1Slots).isEqualTo(16);
        assertThat(branch2Slots).isEqualTo(16);
    }

    @Test
    void legacyConstructorWithoutEnvironmentStaysClosed() {
        // Constructor without DoctorBranchRepository/Environment (used by legacy tests):
        // with no environment the demo flag cannot be read, so availability is closed.
        ScheduleService legacyService = new ScheduleService(
            doctorScheduleRepository,
            exceptionRepository,
            appointmentRepository,
            doctorRepository
        );

        LocalDate futureDate = LocalDate.now().plusDays(5);
        stubEmptySchedules(futureDate);

        List<TimeSlotDto> slots = legacyService.getAvailableSlots(doctorId, branchId, futureDate);
        assertThat(slots).isEmpty();
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

        // A blocking exception closes the day even when the local demo flag would
        // otherwise fabricate hours.
        assertThat(demoEnabledService().getAvailableSlots(doctorId, branchId, futureDate)).isEmpty();
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
