package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.TimeSlotDto;
import com.healthcare.appointment.entity.DoctorSchedule;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorScheduleRepository;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.entity.DoctorScheduleException;
import com.healthcare.scheduling.repository.DoctorScheduleExceptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

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

@DisplayName("ScheduleService Empirical Adversarial Challenge Suite")
class ScheduleServiceAdversarialChallengeTest {

    private DoctorScheduleRepository doctorScheduleRepository;
    private DoctorScheduleExceptionRepository exceptionRepository;
    private AppointmentRepository appointmentRepository;
    private DoctorRepository doctorRepository;
    private DoctorBranchRepository doctorBranchRepository;
    private ScheduleService scheduleService;

    private UUID doctorId;
    private UUID branchId;
    private Doctor activeDoctor;
    private LocalDate testDate;

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
        testDate = LocalDate.now().plusDays(7);

        activeDoctor = new Doctor();
        activeDoctor.setId(doctorId);
        activeDoctor.setActive(true);

        when(doctorRepository.findById(doctorId)).thenReturn(Optional.of(activeDoctor));
        when(doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, branchId)).thenReturn(true);
        when(appointmentRepository.findAllOccupiedSlots(any(), any(), any(), any()))
            .thenReturn(Collections.emptyList());

        int dayOfWeek = testDate.getDayOfWeek().getValue();
        when(doctorScheduleRepository.findActiveForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(testDate), eq(dayOfWeek)))
            .thenReturn(Collections.emptyList());
        when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), eq(branchId), eq(testDate)))
            .thenReturn(Collections.emptyList());
    }

    @Nested
    @DisplayName("Challenge 1: Boundary Slot Verification")
    class BoundarySlotVerification {

        @Test
        @DisplayName("findBookableSlot succeeds for 11:30 - morning boundary, slot end 12:00")
        void morningBoundary1130Succeeds() {
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, LocalTime.of(11, 30));

            assertThat(slot).isPresent();
            assertThat(slot.get().startTime()).isEqualTo(LocalTime.of(11, 30));
            assertThat(slot.get().endTime()).isEqualTo(LocalTime.of(12, 0));
        }

        @Test
        @DisplayName("findBookableSlot succeeds for 17:00 - afternoon boundary, slot end 17:30")
        void afternoonBoundary1700Succeeds() {
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, LocalTime.of(17, 0));

            assertThat(slot).isPresent();
            assertThat(slot.get().startTime()).isEqualTo(LocalTime.of(17, 0));
            assertThat(slot.get().endTime()).isEqualTo(LocalTime.of(17, 30));
        }

        @Test
        @DisplayName("findBookableSlot succeeds for 08:00 - morning start boundary")
        void morningStart0800Succeeds() {
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, LocalTime.of(8, 0));

            assertThat(slot).isPresent();
            assertThat(slot.get().startTime()).isEqualTo(LocalTime.of(8, 0));
            assertThat(slot.get().endTime()).isEqualTo(LocalTime.of(8, 30));
        }

        @Test
        @DisplayName("findBookableSlot succeeds for 13:30 - afternoon start boundary")
        void afternoonStart1330Succeeds() {
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, LocalTime.of(13, 30));

            assertThat(slot).isPresent();
            assertThat(slot.get().startTime()).isEqualTo(LocalTime.of(13, 30));
            assertThat(slot.get().endTime()).isEqualTo(LocalTime.of(14, 0));
        }
    }

    @Nested
    @DisplayName("Challenge 2: Lunch and After-Hours Strict Rejection")
    class RejectionVerification {

        @ParameterizedTest
        @ValueSource(strings = {"12:00", "12:01", "12:30", "13:00", "13:29"})
        @DisplayName("findBookableSlot strictly rejects lunch intervals 12:00 - 13:29")
        void strictlyRejectsLunchIntervals(String timeStr) {
            LocalTime lunchTime = LocalTime.parse(timeStr);
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, lunchTime);

            assertThat(slot)
                .as("Time %s is within lunch break and MUST NOT be bookable", timeStr)
                .isEmpty();
        }

        @ParameterizedTest
        @ValueSource(strings = {"17:30", "17:31", "18:00", "19:00", "23:30"})
        @DisplayName("findBookableSlot strictly rejects after-hours >= 17:30")
        void strictlyRejectsAfterHours(String timeStr) {
            LocalTime afterHour = LocalTime.parse(timeStr);
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, afterHour);

            assertThat(slot)
                .as("Time %s is after clinic closing and MUST NOT be bookable", timeStr)
                .isEmpty();
        }

        @ParameterizedTest
        @ValueSource(strings = {"00:00", "06:00", "07:30", "07:59"})
        @DisplayName("findBookableSlot strictly rejects before-hours < 08:00")
        void strictlyRejectsBeforeHours(String timeStr) {
            LocalTime beforeHour = LocalTime.parse(timeStr);
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, beforeHour);

            assertThat(slot)
                .as("Time %s is before clinic opening and MUST NOT be bookable", timeStr)
                .isEmpty();
        }

        @ParameterizedTest
        @ValueSource(strings = {"08:15", "08:45", "09:10", "11:45", "14:15", "16:45"})
        @DisplayName("findBookableSlot strictly rejects non-boundary / off-cadence minute slots")
        void strictlyRejectsOffCadenceSlots(String timeStr) {
            LocalTime offCadence = LocalTime.parse(timeStr);
            Optional<ScheduleService.BookableSlot> slot =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, offCadence);

            assertThat(slot)
                .as("Time %s is not aligned with 30-minute slot boundaries and MUST NOT be bookable", timeStr)
                .isEmpty();
        }
    }

    @Nested
    @DisplayName("Challenge 3: Branchless Fallback and Unassigned Branch Isolation")
    class BranchBehaviorVerification {

        @Test
        @DisplayName("Branchless fallback properly expands slots across all branches")
        void branchlessFallbackExpandsAcrossAllBranches() {
            int dayOfWeek = testDate.getDayOfWeek().getValue();
            when(doctorScheduleRepository.findActiveForDoctorOnDate(eq(doctorId), eq(testDate), eq(dayOfWeek)))
                .thenReturn(Collections.emptyList());

            UUID branchA = UUID.randomUUID();
            UUID branchB = UUID.randomUUID();
            UUID branchC = UUID.randomUUID();

            Branch bA = new Branch(); bA.setId(branchA); bA.setActive(true);
            Branch bB = new Branch(); bB.setId(branchB); bB.setActive(true);
            Branch bC = new Branch(); bC.setId(branchC); bC.setActive(false);

            DoctorBranch dbA = new DoctorBranch(); dbA.setId(UUID.randomUUID()); dbA.setDoctor(activeDoctor); dbA.setBranch(bA);
            DoctorBranch dbB = new DoctorBranch(); dbB.setId(UUID.randomUUID()); dbB.setDoctor(activeDoctor); dbB.setBranch(bB);
            DoctorBranch dbC = new DoctorBranch(); dbC.setId(UUID.randomUUID()); dbC.setDoctor(activeDoctor); dbC.setBranch(bC);

            when(doctorBranchRepository.findByDoctorId(doctorId)).thenReturn(List.of(dbA, dbB, dbC));
            when(exceptionRepository.findForDoctorAndBranchOnDate(eq(doctorId), any(), eq(testDate)))
                .thenReturn(Collections.emptyList());

            List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, null, testDate);

            assertThat(slots).hasSize(32);
            long branchACount = slots.stream().filter(s -> branchA.equals(s.branchId())).count();
            long branchBCount = slots.stream().filter(s -> branchB.equals(s.branchId())).count();
            long branchCCount = slots.stream().filter(s -> branchC.equals(s.branchId())).count();

            assertThat(branchACount).isEqualTo(16);
            assertThat(branchBCount).isEqualTo(16);
            assertThat(branchCCount).isEqualTo(0);
        }

        @Test
        @DisplayName("Unassigned branch properly returns empty list")
        void unassignedBranchReturnsEmptyList() {
            UUID unassignedBranchId = UUID.randomUUID();
            when(doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, unassignedBranchId)).thenReturn(false);

            List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, unassignedBranchId, testDate);
            assertThat(slots).isEmpty();

            Optional<ScheduleService.BookableSlot> bookable =
                scheduleService.findBookableSlot(doctorId, unassignedBranchId, testDate, LocalTime.of(8, 0));
            assertThat(bookable).isEmpty();
        }

        @Test
        @DisplayName("Past dates return empty list")
        void pastDateReturnsEmptyList() {
            LocalDate pastDate = LocalDate.now().minusDays(1);
            List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, pastDate);
            assertThat(slots).isEmpty();

            Optional<ScheduleService.BookableSlot> bookable =
                scheduleService.findBookableSlot(doctorId, branchId, pastDate, LocalTime.of(8, 0));
            assertThat(bookable).isEmpty();
        }

        @Test
        @DisplayName("Total slot breakdown confirms 8 morning and 8 afternoon slots = 16")
        void slotBreakdownConfirms8Morning8Afternoon() {
            List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, testDate);
            assertThat(slots).hasSize(16);

            long morningCount = slots.stream()
                .filter(s -> !s.startTime().isBefore(LocalTime.of(8, 0)) && !s.endTime().isAfter(LocalTime.of(12, 0)))
                .count();

            long afternoonCount = slots.stream()
                .filter(s -> !s.startTime().isBefore(LocalTime.of(13, 30)) && !s.endTime().isAfter(LocalTime.of(17, 30)))
                .count();

            long lunchCount = slots.stream()
                .filter(s -> s.startTime().isBefore(LocalTime.of(13, 30)) && s.endTime().isAfter(LocalTime.of(12, 0)))
                .count();

            assertThat(morningCount).isEqualTo(8);
            assertThat(afternoonCount).isEqualTo(8);
            assertThat(lunchCount).isEqualTo(0);
        }

        @Test
        @DisplayName("Inactive doctor strictly fails closed across findBookableSlot, isBookableSlot, and getAvailableSlots")
        void inactiveDoctorFailsClosedAcrossAllMethods() {
            activeDoctor.setActive(false);

            List<TimeSlotDto> slots = scheduleService.getAvailableSlots(doctorId, branchId, testDate);
            assertThat(slots).isEmpty();

            Optional<ScheduleService.BookableSlot> bookable =
                scheduleService.findBookableSlot(doctorId, branchId, testDate, LocalTime.of(8, 0));
            assertThat(bookable).isEmpty();

            boolean isBookable = scheduleService.isBookableSlot(doctorId, branchId, testDate, LocalTime.of(8, 0));
            assertThat(isBookable).isFalse();
        }

        @Test
        @DisplayName("Inactive branch strictly fails closed in findBookableSlot and isBookableSlot when branch repository is wired")
        void inactiveBranchFailsClosedAcrossAllMethods() {
            BranchRepository branchRepository = mock(BranchRepository.class);
            ScheduleService strictService = new ScheduleService(
                doctorScheduleRepository,
                exceptionRepository,
                appointmentRepository,
                doctorRepository,
                doctorBranchRepository,
                branchRepository
            );

            UUID inactiveBranchId = UUID.randomUUID();
            Branch inactiveBranch = new Branch();
            inactiveBranch.setId(inactiveBranchId);
            inactiveBranch.setActive(false);

            when(branchRepository.findById(inactiveBranchId)).thenReturn(Optional.of(inactiveBranch));
            when(doctorBranchRepository.existsByDoctorIdAndBranchId(doctorId, inactiveBranchId)).thenReturn(true);

            List<TimeSlotDto> slots = strictService.getAvailableSlots(doctorId, inactiveBranchId, testDate);
            assertThat(slots).isEmpty();

            Optional<ScheduleService.BookableSlot> bookable =
                strictService.findBookableSlot(doctorId, inactiveBranchId, testDate, LocalTime.of(8, 0));
            assertThat(bookable).isEmpty();

            boolean isBookable = strictService.isBookableSlot(doctorId, inactiveBranchId, testDate, LocalTime.of(8, 0));
            assertThat(isBookable).isFalse();
        }
    }
}
