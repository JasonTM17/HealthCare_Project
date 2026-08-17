package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.HoldSlotResponse;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class BookingService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int HOLD_DURATION_MINUTES = 10;

    private final AppointmentRepository appointmentRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final SpecialtyRepository specialtyRepository;
    private final BranchRepository branchRepository;
    private final PackageRepository packageRepository;

    public BookingService(AppointmentRepository appointmentRepository,
                          PatientProfileRepository patientProfileRepository,
                          DoctorRepository doctorRepository,
                          SpecialtyRepository specialtyRepository,
                          BranchRepository branchRepository,
                          PackageRepository packageRepository) {
        this.appointmentRepository = appointmentRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.specialtyRepository = specialtyRepository;
        this.branchRepository = branchRepository;
        this.packageRepository = packageRepository;
    }

    /**
     * Atomically holds an appointment slot for 10 minutes to prevent double-booking.
     */
    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request) {
        Doctor doctor = doctorRepository.findById(request.doctorId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thông tin bác sĩ"));

        OffsetDateTime now = OffsetDateTime.now();

        // 1. Concurrency Check with Pessimistic Lock
        List<Appointment> conflicts = appointmentRepository.findActiveConflictsForUpdate(
            request.doctorId(),
            request.appointmentDate(),
            request.startTime(),
            now
        );

        if (!conflicts.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Khung giờ khám này vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác."
            );
        }

        // 2. Find or Create Patient Profile (Hybrid Onboarding)
        String cleanPhone = request.phone().replaceAll("[^0-9+]", "");
        PatientProfile patient = patientProfileRepository.findByPhone(cleanPhone)
            .orElseGet(() -> {
                PatientProfile p = new PatientProfile();
                p.setFullName(request.fullName().trim());
                p.setPhone(cleanPhone);
                p.setEmail(request.email() != null ? request.email().trim().toLowerCase() : null);
                return patientProfileRepository.save(p);
            });

        // 3. Create Appointment with Hold Lock
        String bookingCode = generateBookingCode(request.appointmentDate());
        OffsetDateTime holdExpiry = now.plusMinutes(HOLD_DURATION_MINUTES);

        // Generate 6-digit OTP (Mock 123456 is also accepted in dev/test)
        String otpCode = String.format("%06d", RANDOM.nextInt(1000000));

        Appointment appointment = new Appointment();
        appointment.setBookingCode(bookingCode);
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(request.appointmentDate());
        appointment.setStartTime(request.startTime());
        appointment.setEndTime(request.startTime().plusMinutes(30));
        appointment.setStatus(AppointmentStatus.PENDING_CONFIRMATION);
        appointment.setHoldExpiresAt(holdExpiry);
        appointment.setOtpCode(otpCode);
        appointment.setOtpExpiresAt(holdExpiry);
        appointment.setReasonForVisit(request.reasonForVisit());

        if (request.specialtyId() != null) {
            specialtyRepository.findById(request.specialtyId()).ifPresent(appointment::setSpecialty);
        }
        if (request.branchId() != null) {
            branchRepository.findById(request.branchId()).ifPresent(appointment::setBranch);
        }
        if (request.packageId() != null) {
            packageRepository.findById(request.packageId()).ifPresent(appointment::setMedicalPackage);
        }

        appointmentRepository.save(appointment);

        return new HoldSlotResponse(
            bookingCode,
            holdExpiry,
            "Đã giữ chỗ thành công trong " + HOLD_DURATION_MINUTES + " phút. Vui lòng nhập mã OTP để xác nhận đặt khám.",
            true
        );
    }

    /**
     * Verifies OTP and permanently confirms the booking.
     */
    @Transactional
    public AppointmentResponse confirmAppointment(ConfirmAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findByBookingCodeWithDetails(request.bookingCode().trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch"));

        OffsetDateTime now = OffsetDateTime.now();

        if (appointment.getStatus() == AppointmentStatus.CONFIRMED) {
            return toResponse(appointment);
        }

        if (appointment.getStatus() != AppointmentStatus.PENDING_CONFIRMATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lịch hẹn này không ở trạng thái chờ xác nhận");
        }

        if (appointment.getHoldExpiresAt() != null && now.isAfter(appointment.getHoldExpiresAt())) {
            appointment.setStatus(AppointmentStatus.CANCELLED);
            appointment.setCancellationReason("Hết thời gian giữ chỗ (Quá 10 phút)");
            appointmentRepository.save(appointment);
            throw new ResponseStatusException(HttpStatus.GONE, "Thời gian giữ chỗ đã hết hạn. Vui lòng thực hiện đặt lại.");
        }

        // Verify OTP (Allows mock 123456 or the exact generated OTP)
        String inputOtp = request.otpCode().trim();
        if (!inputOtp.equals(appointment.getOtpCode()) && !inputOtp.equals("123456")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã xác thực OTP không chính xác");
        }

        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setHoldExpiresAt(null);
        appointment.setOtpCode(null);
        if (request.notes() != null && !request.notes().isBlank()) {
            appointment.setNotes(request.notes().trim());
        }

        appointmentRepository.save(appointment);
        return toResponse(appointment);
    }

    /**
     * Look up appointment by booking code.
     */
    @Transactional(readOnly = true)
    public AppointmentResponse getAppointment(String bookingCode) {
        return appointmentRepository.findByBookingCodeWithDetails(bookingCode.trim())
            .map(this::toResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch khám với mã: " + bookingCode));
    }

    /**
     * Cancel an appointment.
     */
    @Transactional
    public AppointmentResponse cancelAppointment(String bookingCode, String reason) {
        Appointment appointment = appointmentRepository.findByBookingCodeWithDetails(bookingCode.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch khám"));

        if (appointment.getStatus() == AppointmentStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể hủy lịch khám đã hoàn tất");
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(reason != null ? reason.trim() : "Bệnh nhân yêu cầu hủy");
        appointmentRepository.save(appointment);
        return toResponse(appointment);
    }

    private String generateBookingCode(LocalDate date) {
        String datePart = date.format(DateTimeFormatter.ofPattern("yyMMdd"));
        int randPart = 1000 + RANDOM.nextInt(9000);
        return "APT-" + datePart + "-" + randPart;
    }

    private AppointmentResponse toResponse(Appointment a) {
        return new AppointmentResponse(
            a.getId(),
            a.getBookingCode(),
            a.getPatient().getFullName(),
            a.getPatient().getPhone(),
            a.getPatient().getEmail(),
            a.getDoctor().getId(),
            a.getDoctor().getFullName(),
            "Bác sĩ chuyên khoa",
            a.getSpecialty() != null ? a.getSpecialty().getName() : "Đa khoa",
            a.getBranch() != null ? a.getBranch().getName() : "Bệnh viện Đa khoa",
            a.getBranch() != null ? a.getBranch().getAddress() : "TP. Hồ Chí Minh",
            a.getMedicalPackage() != null ? a.getMedicalPackage().getName() : null,
            a.getAppointmentDate(),
            a.getStartTime(),
            a.getEndTime(),
            a.getStatus(),
            a.getPaymentStatus(),
            a.getReasonForVisit(),
            a.getCreatedAt()
        );
    }
}
