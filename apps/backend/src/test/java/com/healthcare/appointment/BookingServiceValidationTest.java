package com.healthcare.appointment;

import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.BookingService;
import com.healthcare.appointment.service.AppointmentSlotLocker;
import com.healthcare.appointment.service.ScheduleService;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BookingServiceValidationTest {

    @Test
    void rejectsSpecialtyThatIsNotAssignedToSelectedDoctor() {
        AppointmentRepository appointments = mock(AppointmentRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        DoctorBranchRepository doctorBranches = mock(DoctorBranchRepository.class);
        DoctorSpecialtyRepository doctorSpecialties = mock(DoctorSpecialtyRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        BranchRepository branches = mock(BranchRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ScheduleService schedules = mock(ScheduleService.class);
        NotificationService notifications = mock(NotificationService.class);
        AppointmentSlotLocker slotLocker = mock(AppointmentSlotLocker.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);

        UUID doctorId = UUID.randomUUID();
        UUID specialtyId = UUID.randomUUID();
        Doctor doctor = new Doctor(); doctor.setId(doctorId); doctor.setActive(true);
        Specialty specialty = new Specialty(); specialty.setId(specialtyId); specialty.setActive(true);
        when(doctors.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(specialties.findByIdAndActiveTrue(specialtyId)).thenReturn(Optional.of(specialty));
        when(doctorSpecialties.existsByDoctorIdAndSpecialtyId(doctorId, specialtyId)).thenReturn(false);

        BookingService service = new BookingService(
            appointments, patients, doctors, doctorBranches, doctorSpecialties, specialties,
            branches, packages, users, schedules, notifications, slotLocker, passwordEncoder);
        HoldSlotRequest request = new HoldSlotRequest(
            doctorId, LocalDate.now().plusDays(1), LocalTime.of(9, 0),
            "Bệnh nhân", "0900000001", null, null, specialtyId, null, null);

        assertThatThrownBy(() -> service.holdSlot(request))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Bác sĩ không thuộc chuyên khoa");
    }
}
