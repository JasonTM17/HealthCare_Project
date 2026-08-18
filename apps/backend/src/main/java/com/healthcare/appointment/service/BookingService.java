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
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class BookingService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int HOLD_DURATION_MINUTES = 10;
    private static final int OTP_DURATION_MINUTES = 5;
    private static final int MAX_OTP_ATTEMPTS = 5;

    private final AppointmentRepository appointmentRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorBranchRepository doctorBranchRepository;
    private final DoctorSpecialtyRepository doctorSpecialtyRepository;
    private final SpecialtyRepository specialtyRepository;
    private final BranchRepository branchRepository;
    private final PackageRepository packageRepository;
    private final UserRepository userRepository;
    private final ScheduleService scheduleService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.booking.allow-test-otp:false}")
    private boolean allowTestOtp;

    public BookingService(AppointmentRepository appointmentRepository,
                          PatientProfileRepository patientProfileRepository,
                          DoctorRepository doctorRepository,
                          DoctorBranchRepository doctorBranchRepository,
                          DoctorSpecialtyRepository doctorSpecialtyRepository,
                          SpecialtyRepository specialtyRepository,
                          BranchRepository branchRepository,
                          PackageRepository packageRepository,
                          UserRepository userRepository,
                          ScheduleService scheduleService,
                          PasswordEncoder passwordEncoder) {
        this.appointmentRepository = appointmentRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.doctorBranchRepository = doctorBranchRepository;
        this.doctorSpecialtyRepository = doctorSpecialtyRepository;
        this.specialtyRepository = specialtyRepository;
        this.branchRepository = branchRepository;
        this.packageRepository = packageRepository;
        this.userRepository = userRepository;
        this.scheduleService = scheduleService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Atomically holds an appointment slot for 10 minutes to prevent double-booking.
     */
    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request) {
        return holdSlot(request, null);
    }

    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request, UserDetails userDetails) {
        if (request == null || request.doctorId() == null || request.appointmentDate() == null
                || request.startTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thông tin khung giờ không hợp lệ");
        }

        Doctor doctor = doctorRepository.findById(request.doctorId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thông tin bác sĩ"));
        if (!doctor.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bác sĩ hiện không nhận lịch khám");
        }

        com.healthcare.hospital.entity.Specialty specialty = request.specialtyId() == null
            ? null
            : specialtyRepository.findByIdAndActiveTrue(request.specialtyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy chuyên khoa"));
        com.healthcare.hospital.entity.Branch branch = request.branchId() == null
            ? null
            : branchRepository.findByIdAndActiveTrue(request.branchId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cơ sở khám"));
        if (specialty != null && !doctorSpecialtyRepository.existsByDoctorIdAndSpecialtyId(
            request.doctorId(),
            specialty.getId()
        )) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Bác sĩ không thuộc chuyên khoa đã chọn"
            );
        }
        if (branch != null && !doctorBranchRepository.existsByDoctorIdAndBranchId(request.doctorId(), branch.getId())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Bác sĩ không làm việc tại cơ sở khám đã chọn"
            );
        }

        com.healthcare.hospital.entity.Package medicalPackage = request.packageId() == null
            ? null
            : packageRepository.findByIdAndActiveTrue(request.packageId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy gói khám"));

        ScheduleService.BookableSlot bookableSlot = scheduleService.findBookableSlot(
                request.doctorId(), request.branchId(), request.appointmentDate(), request.startTime())
            .orElse(null);
        if (bookableSlot == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Khung giờ không nằm trong lịch làm việc hoặc đã qua. Vui lòng chọn một slot đang mở."
            );
        }

        OffsetDateTime now = OffsetDateTime.now();

        // Serialize the slot key even when no appointment row exists yet. A row lock
        // alone cannot prevent two first writers from both observing an empty slot.
        String branchLockKey = request.branchId() == null
            ? "branchless"
            : request.branchId().toString();
        String slotLockKey = request.doctorId() + ":" + branchLockKey + ":" + request.appointmentDate();
        appointmentRepository.acquireSlotLock(slotLockKey);

        List<Appointment> expired = appointmentRepository.findExpiredPendingConflictsForUpdate(
            request.doctorId(),
            request.branchId(),
            request.appointmentDate(),
            request.startTime(),
            bookableSlot.endTime(),
            now
        );
        for (Appointment expiredAppointment : expired) {
            expiredAppointment.setStatus(AppointmentStatus.CANCELLED);
            expiredAppointment.setCancellationReason("Hết thời gian giữ chỗ (Quá 10 phút)");
        }
        if (!expired.isEmpty()) {
            appointmentRepository.saveAll(expired);
            appointmentRepository.flush();
        }

        // 1. Concurrency Check with Pessimistic Lock
        List<Appointment> conflicts = appointmentRepository.findActiveConflictsForUpdate(
            request.doctorId(),
            request.branchId(),
            request.appointmentDate(),
            request.startTime(),
            bookableSlot.endTime(),
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
        PatientProfile patient = resolvePatient(request, cleanPhone, userDetails);

        // 3. Create Appointment with Hold Lock
        String bookingCode = generateBookingCode(request.appointmentDate());
        OffsetDateTime holdExpiry = now.plusMinutes(HOLD_DURATION_MINUTES);
        OffsetDateTime otpExpiry = now.plusMinutes(OTP_DURATION_MINUTES);

        // Generate 6-digit OTP (Mock 123456 is also accepted in dev/test)
        String otpCode = String.format("%06d", RANDOM.nextInt(1000000));

        Appointment appointment = new Appointment();
        appointment.setBookingCode(bookingCode);
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(request.appointmentDate());
        appointment.setStartTime(request.startTime());
        appointment.setEndTime(bookableSlot.endTime());
        appointment.setAppointmentTime(
            OffsetDateTime.of(request.appointmentDate(), request.startTime(), now.getOffset())
        );
        appointment.setStatus(AppointmentStatus.PENDING_CONFIRMATION);
        appointment.setHoldExpiresAt(holdExpiry);
        appointment.setOtpCode(passwordEncoder.encode(otpCode));
        appointment.setOtpExpiresAt(otpExpiry);
        appointment.setOtpAttempts(0);
        appointment.setReasonForVisit(request.reasonForVisit());

        appointment.setSpecialty(specialty);
        appointment.setBranch(branch);
        appointment.setMedicalPackage(medicalPackage);

        try {
            appointmentRepository.saveAndFlush(appointment);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Khung giờ khám này vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác.",
                exception
            );
        }

        return new HoldSlotResponse(
            bookingCode,
            holdExpiry,
            otpExpiry,
            "Đã giữ chỗ thành công trong " + HOLD_DURATION_MINUTES + " phút. Mã OTP có hiệu lực trong " + OTP_DURATION_MINUTES + " phút.",
            true
        );
    }

    private PatientProfile resolvePatient(HoldSlotRequest request, String cleanPhone, UserDetails userDetails) {
        UUID authenticatedUserId = null;
        if (userDetails != null) {
            User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không hợp lệ"));
            authenticatedUserId = user.getId();
        }

        if (authenticatedUserId != null && hasRole(userDetails, "PATIENT")) {
            UUID userId = authenticatedUserId;
            PatientProfile linked = patientProfileRepository.findByUserId(userId).orElse(null);
            if (linked != null) {
                if (!normalizePhone(linked.getPhone()).equals(cleanPhone)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Số điện thoại không khớp hồ sơ bệnh nhân");
                }
                return linked;
            }

            PatientProfile byPhone = patientProfileRepository.findByPhone(cleanPhone).orElse(null);
            if (byPhone != null) {
                throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Số điện thoại đã có hồ sơ; cần xác minh trước khi liên kết tài khoản"
                );
            }

            PatientProfile created = new PatientProfile();
            created.setUserId(userId);
            created.setFullName(request.fullName().trim());
            created.setPhone(cleanPhone);
            created.setEmail(request.email() != null ? request.email().trim().toLowerCase() : null);
            return patientProfileRepository.save(created);
        }

        return patientProfileRepository.findByPhone(cleanPhone)
            .orElseGet(() -> {
                PatientProfile p = new PatientProfile();
                p.setFullName(request.fullName().trim());
                p.setPhone(cleanPhone);
                p.setEmail(request.email() != null ? request.email().trim().toLowerCase() : null);
                return patientProfileRepository.save(p);
            });
    }

    /**
     * Verifies OTP and permanently confirms the booking.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AppointmentResponse confirmAppointment(ConfirmAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findByBookingCodeWithDetailsForUpdate(request.bookingCode().trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch"));

        OffsetDateTime now = OffsetDateTime.now();

        if (appointment.getStatus() == AppointmentStatus.CONFIRMED) {
            // The OTP is cleared after confirmation. Never make this public
            // endpoint an appointment-detail oracle for a booking code.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lịch hẹn này đã được xác nhận");
        }

        if (appointment.getStatus() != AppointmentStatus.PENDING_CONFIRMATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lịch hẹn này không ở trạng thái chờ xác nhận");
        }

        if (appointment.getHoldExpiresAt() != null && !now.isBefore(appointment.getHoldExpiresAt())) {
            appointment.setStatus(AppointmentStatus.CANCELLED);
            appointment.setCancellationReason("Hết thời gian giữ chỗ (Quá 10 phút)");
            appointmentRepository.save(appointment);
            throw new ResponseStatusException(HttpStatus.GONE, "Thời gian giữ chỗ đã hết hạn. Vui lòng thực hiện đặt lại.");
        }

        if (appointment.getOtpExpiresAt() != null && !now.isBefore(appointment.getOtpExpiresAt())) {
            appointment.setStatus(AppointmentStatus.CANCELLED);
            appointment.setCancellationReason("Mã OTP đã hết hạn");
            appointment.setHoldExpiresAt(null);
            appointment.setOtpCode(null);
            appointment.setOtpExpiresAt(null);
            appointmentRepository.saveAndFlush(appointment);
            throw new ResponseStatusException(HttpStatus.GONE, "Mã OTP đã hết hạn. Vui lòng thực hiện đặt lại lịch.");
        }

        // Verify OTP. The fixed test code is available only in the test profile.
        String inputOtp = request.otpCode().trim();
        if (!matchesOtp(inputOtp, appointment.getOtpCode()) && !(allowTestOtp && inputOtp.equals("123456"))) {
            int attempts = appointment.getOtpAttempts() + 1;
            appointment.setOtpAttempts(attempts);
            if (attempts >= MAX_OTP_ATTEMPTS) {
                appointment.setStatus(AppointmentStatus.CANCELLED);
                appointment.setCancellationReason("Quá số lần nhập OTP không hợp lệ");
                appointment.setHoldExpiresAt(null);
                appointment.setOtpCode(null);
                appointment.setOtpExpiresAt(null);
                appointmentRepository.saveAndFlush(appointment);
                throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Đã vượt quá số lần nhập OTP. Vui lòng đặt lại lịch hẹn."
                );
            }
            appointmentRepository.saveAndFlush(appointment);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã xác thực OTP không chính xác");
        }

        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setHoldExpiresAt(null);
        appointment.setOtpCode(null);
        appointment.setOtpExpiresAt(null);
        if (request.notes() != null && !request.notes().isBlank()) {
            appointment.setNotes(request.notes().trim());
        }

        try {
            appointmentRepository.saveAndFlush(appointment);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Khung giờ khám này vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác.",
                exception
            );
        }
        return toResponse(appointment);
    }

    /**
     * Look up appointment by booking code.
     */
    @Transactional(readOnly = true)
    public AppointmentResponse getAppointment(String bookingCode, String phone, UserDetails principal) {
        Appointment appointment = appointmentRepository.findByBookingCodeWithDetails(bookingCode.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch khám với mã: " + bookingCode));
        authorizeAppointment(appointment, phone, principal);
        return principal == null ? toPublicResponse(appointment) : toResponse(appointment);
    }

    /**
     * Cancel an appointment.
     */
    @Transactional
    public AppointmentResponse cancelAppointment(
            String bookingCode,
            String reason,
            String phone,
            UserDetails principal) {
        Appointment appointment = appointmentRepository.findByBookingCodeWithDetailsForUpdate(bookingCode.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch khám"));

        authorizeAppointment(appointment, phone, principal);

        if (appointment.getStatus() == AppointmentStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể hủy lịch khám đã hoàn tất");
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(reason != null ? reason.trim() : "Bệnh nhân yêu cầu hủy");
        appointment.setHoldExpiresAt(null);
        appointment.setOtpCode(null);
        appointment.setOtpExpiresAt(null);
        appointmentRepository.save(appointment);
        return principal == null ? toPublicResponse(appointment) : toResponse(appointment);
    }

    private String generateBookingCode(LocalDate date) {
        String token = UUID.randomUUID().toString().replace("-", "").substring(0, 24).toUpperCase();
        return "APT-" + token;
    }

    private void authorizeAppointment(Appointment appointment, String phone, UserDetails principal) {
        if (principal == null) {
            if (phone == null || !normalizePhone(phone).equals(normalizePhone(appointment.getPatient().getPhone()))) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Cần xác thực số điện thoại để xem lịch hẹn");
            }
            return;
        }

        UUID userId = resolveUserId(principal);
        if (hasRole(principal, "ADMIN")) {
            return;
        }
        if (hasRole(principal, "PATIENT")) {
            PatientProfile patient = patientProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new AccessDeniedException("Tài khoản chưa liên kết hồ sơ bệnh nhân"));
            if (patient.getId().equals(appointment.getPatient().getId())) {
                return;
            }
        }
        if (hasRole(principal, "DOCTOR")) {
            Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new AccessDeniedException("Tài khoản chưa liên kết hồ sơ bác sĩ"));
            if (doctor.getId().equals(appointment.getDoctor().getId())) {
                return;
            }
        }
        throw new AccessDeniedException("Bạn không có quyền truy cập lịch hẹn này");
    }

    private UUID resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
            .map(User::getId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không hợp lệ"));
    }

    private boolean hasRole(UserDetails principal, String role) {
        return principal.getAuthorities().stream()
            .anyMatch(authority -> ("ROLE_" + role).equals(authority.getAuthority()));
    }

    private String normalizePhone(String phone) {
        return phone.replaceAll("[^0-9+]", "");
    }

    private boolean matchesOtp(String inputOtp, String storedOtp) {
        if (storedOtp == null || storedOtp.isBlank()) return false;
        if (storedOtp.startsWith("$2a$") || storedOtp.startsWith("$2b$") || storedOtp.startsWith("$2y$")) {
            return passwordEncoder.matches(inputOtp, storedOtp);
        }
        // One-release compatibility for pending rows created before V18. New
        // holds always store a BCrypt hash and never write this legacy form.
        return MessageDigest.isEqual(
            inputOtp.getBytes(StandardCharsets.UTF_8),
            storedOtp.getBytes(StandardCharsets.UTF_8)
        );
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

    private AppointmentResponse toPublicResponse(Appointment a) {
        return new AppointmentResponse(
            a.getId(),
            a.getBookingCode(),
            a.getPatient().getFullName(),
            maskPhone(a.getPatient().getPhone()),
            null,
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
            null,
            a.getCreatedAt()
        );
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return "***";
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 3);
    }
}
