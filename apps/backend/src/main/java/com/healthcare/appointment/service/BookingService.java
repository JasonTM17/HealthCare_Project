package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.dto.ConfirmAppointmentRequest;
import com.healthcare.appointment.dto.HoldSlotRequest;
import com.healthcare.appointment.dto.HoldSlotResponse;
import com.healthcare.appointment.dto.OtpDeliveryStatus;
import com.healthcare.appointment.dto.RescheduleAppointmentRequest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.auth.mail.NoopEmailSender;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.payment.service.BankTransferPaymentService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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
import java.time.ZoneId;
import java.util.Map;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class BookingService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int HOLD_DURATION_MINUTES = 10;
    private static final int OTP_DURATION_MINUTES = 5;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final String OTP_ATTEMPTS_EXHAUSTED_MESSAGE =
        "Bạn đã nhập sai mã OTP quá " + MAX_OTP_ATTEMPTS + " lần. Vui lòng yêu cầu gửi lại mã OTP.";
    private static final String BOOKING_PRIVACY_CONSENT_VERSION = "booking-privacy-v1";
    /** Live holds one patient may keep open at the same time. */
    static final int MAX_LIVE_HOLDS_PER_PATIENT = 2;
    /**
     * Cancellation reason for a hold that ran out. Shared by the lazy sweeps in
     * this service, the scheduled hold sweeper, and the historical repairs
     * (V8/V10.4) so every expired hold carries the same wording.
     */
    public static final String HOLD_EXPIRED_CANCELLATION_REASON = "Hết thời gian giữ chỗ (Quá 10 phút)";
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Safe, bounded client key: same shape the AI chat surface accepts. */
    private static final java.util.regex.Pattern IDEMPOTENCY_KEY_PATTERN =
        java.util.regex.Pattern.compile("^[A-Za-z0-9._:-]{8,128}$");

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
    private final NotificationService notificationService;
    private final AppointmentSlotLocker slotLocker;
    private final AfterCommitEmailSender emailSender;
    private final Environment environment;
    private final BankTransferPaymentService paymentService;
    private final AppointmentClaimService appointmentClaimService;

    @Value("${app.booking.allow-test-otp:false}")
    private boolean allowTestOtp;

    @Autowired
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
                          PasswordEncoder passwordEncoder,
                          NotificationService notificationService,
                          AppointmentSlotLocker slotLocker,
                          AfterCommitEmailSender emailSender,
                          Environment environment,
                          BankTransferPaymentService paymentService,
                          AppointmentClaimService appointmentClaimService) {
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
        this.notificationService = notificationService;
        this.slotLocker = slotLocker;
        this.emailSender = emailSender;
        this.environment = environment;
        this.paymentService = paymentService;
        this.appointmentClaimService = appointmentClaimService;
    }

    /** Backward-compatible constructor for focused unit tests. */
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
        this(
            appointmentRepository, patientProfileRepository, doctorRepository, doctorBranchRepository,
            doctorSpecialtyRepository, specialtyRepository, branchRepository, packageRepository,
            userRepository, scheduleService, passwordEncoder, null, appointmentRepository::acquireSlotLock,
            new AfterCommitEmailSender(new NoopEmailSender()), null, null, null
        );
    }

    /** Backward-compatible constructor used by lightweight validation tests. */
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
                          NotificationService notificationService) {
        this(
            appointmentRepository, patientProfileRepository, doctorRepository, doctorBranchRepository,
            doctorSpecialtyRepository, specialtyRepository, branchRepository, packageRepository,
            userRepository, scheduleService, new BCryptPasswordEncoder(), notificationService,
            appointmentRepository::acquireSlotLock,
            new AfterCommitEmailSender(new NoopEmailSender()), null, null, null
        );
    }

    /**
     * Atomically holds an appointment slot for 10 minutes to prevent double-booking.
     */
    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request) {
        return holdSlot(request, null, null);
    }

    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request, UserDetails userDetails) {
        return holdSlot(request, userDetails, null);
    }

    /**
     * Holds a slot for 10 minutes.
     *
     * <p>{@code rawIdempotencyKey} is the client's {@code Idempotency-Key}. When
     * present and already used by a live hold, that hold is returned instead of
     * creating a second appointment, so a retry after a lost response is safe.
     */
    @Transactional
    public HoldSlotResponse holdSlot(HoldSlotRequest request, UserDetails userDetails, String rawIdempotencyKey) {
        if (request == null || request.doctorId() == null || request.appointmentDate() == null
                || request.startTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thông tin khung giờ không hợp lệ");
        }
        if (!Boolean.TRUE.equals(request.privacyConsent())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần đồng ý chính sách bảo mật trước khi đặt lịch");
        }
        // A hold without a branch would bypass the V10 composite
        // (doctor, branch) foreign key and reintroduce branchless rows that no
        // schedule can authorize. The branch is therefore mandatory, not
        // optional, before any availability work happens.
        if (request.branchId() == null) {
            throw new BusinessException(
                400,
                ErrorCodes.BRANCH_REQUIRED,
                "Vui lòng chọn cơ sở khám trước khi giữ chỗ."
            );
        }
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        if (idempotencyKey != null) {
            HoldSlotResponse replayed = replayHold(request, idempotencyKey);
            if (replayed != null) {
                return replayed;
            }
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
        if (specialty != null && (!specialty.isActive()
                || !doctorSpecialtyRepository.existsByDoctorIdAndSpecialtyId(doctor.getId(), specialty.getId()))) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Bác sĩ không thuộc chuyên khoa đang được chọn"
            );
        }
        com.healthcare.hospital.entity.Branch branch = branchRepository
            .findByIdAndActiveTrue(request.branchId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cơ sở khám"));
        if (!doctorBranchRepository.existsByDoctorIdAndBranchId(request.doctorId(), branch.getId())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Bác sĩ không làm việc tại cơ sở khám đã chọn"
            );
        }
        if (!branch.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cơ sở khám hiện không nhận lịch");
        }

        com.healthcare.hospital.entity.Package medicalPackage = request.packageId() == null
            ? null
            : packageRepository.findByIdAndActiveTrue(request.packageId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy gói khám"));
        if (medicalPackage != null && !medicalPackage.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Gói khám hiện không nhận đặt lịch");
        }

        ScheduleService.BookableSlot bookableSlot = scheduleService.findBookableSlot(
                request.doctorId(), request.branchId(), request.appointmentDate(), request.startTime())
            .orElse(null);
        if (bookableSlot == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Khung giờ không nằm trong lịch làm việc hoặc đã qua. Vui lòng chọn một slot đang mở."
            );
        }

        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);

        // Serialize the slot key even when no appointment row exists yet. A row lock
        // alone cannot prevent two first writers from both observing an empty slot.
        // The key is doctor+date (not branch+date) so a physician with the same
        // hours at two branches is serialized across branches as well.
        String slotLockKey = request.doctorId() + ":" + request.appointmentDate();
        slotLocker.acquire(slotLockKey);

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
            expiredAppointment.setCancellationReason(HOLD_EXPIRED_CANCELLATION_REASON);
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

        // 2. Doctor-level overlap across branches. The V11/V13 exclusion
        // constraint is branch-scoped, so without this check one physician could
        // be booked twice at the same clock time in two different branches.
        List<Appointment> doctorOverlaps = appointmentRepository.findDoctorOverlapsForUpdate(
            request.doctorId(),
            request.appointmentDate(),
            request.startTime(),
            bookableSlot.endTime(),
            now,
            null
        );
        if (!doctorOverlaps.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Bác sĩ đã có lịch khám hoặc đang giữ chỗ ở cơ sở khác trong khung giờ này. "
                    + "Vui lòng chọn khung giờ khác."
            );
        }

        // 3. Find or Create Patient Profile (Hybrid Onboarding)
        String cleanPhone = request.phone().replaceAll("[^0-9+]", "");
        PatientResolution patientResolution = resolvePatient(request, cleanPhone, userDetails);
        PatientProfile patient = patientResolution.patient();
        String otpRecipient = patientResolution.otpRecipient();
        if (!emailSender.isDeliveryAvailable()) {
            throw emailDeliveryUnavailable();
        }

        // 4. Bound how many slots one patient can park at the same time. Holds
        // expire on their own, but nothing else stops a patient from parking an
        // entire clinic day and starving other patients.
        long liveHolds = appointmentRepository.countLiveHoldsForPatient(patient.getId(), now);
        if (liveHolds >= MAX_LIVE_HOLDS_PER_PATIENT) {
            throw new BusinessException(
                429,
                ErrorCodes.TOO_MANY_ACTIVE_HOLDS,
                "Bạn đang giữ " + liveHolds + " chỗ khám chưa xác nhận. "
                    + "Vui lòng xác nhận hoặc hủy bớt trước khi giữ chỗ mới."
            );
        }

        // 5. Create Appointment with Hold Lock
        String bookingCode = generateBookingCode(request.appointmentDate());
        OffsetDateTime holdExpiry = now.plusMinutes(HOLD_DURATION_MINUTES);
        OffsetDateTime otpExpiry = now.plusMinutes(OTP_DURATION_MINUTES);

        String otpCode = useFixedTestOtp()
            ? "123456"
            : String.format("%06d", RANDOM.nextInt(1000000));

        Appointment appointment = new Appointment();
        appointment.setBookingCode(bookingCode);
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(request.appointmentDate());
        appointment.setStartTime(request.startTime());
        appointment.setEndTime(bookableSlot.endTime());
        appointment.setAppointmentTime(
            OffsetDateTime.of(request.appointmentDate(), request.startTime(), BUSINESS_ZONE.getRules().getOffset(now.toInstant()))
        );
        appointment.setStatus(AppointmentStatus.PENDING_CONFIRMATION);
        appointment.setHoldExpiresAt(holdExpiry);
        appointment.setHoldIdempotencyKey(idempotencyKey);
        appointment.setOtpCode(passwordEncoder.encode(otpCode));
        appointment.setOtpExpiresAt(otpExpiry);
        appointment.setOtpIssuedAt(now);
        appointment.setOtpAttempts(0);
        appointment.setReasonForVisit(request.reasonForVisit());
        appointment.setHasInsurance(Boolean.TRUE.equals(request.hasInsurance()));
        appointment.setPrivacyConsentAt(now);
        appointment.setPrivacyConsentVersion(BOOKING_PRIVACY_CONSENT_VERSION);

        appointment.setSpecialty(specialty);
        appointment.setBranch(branch);
        appointment.setMedicalPackage(medicalPackage);

        try {
            appointmentRepository.saveAndFlush(appointment);
        } catch (DataIntegrityViolationException exception) {
            if (idempotencyKey != null) {
                // The unique hold-key index rejected a racing retry. The
                // transaction is aborted so the winner cannot be read here; the
                // client retries and the fast path above replays it.
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Yêu cầu giữ chỗ với cùng Idempotency-Key đang được xử lý. Vui lòng thử lại.",
                    exception
                );
            }
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Khung giờ khám này vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác.",
                exception
            );
        }
        if (paymentService != null && paymentService.isAvailable()) {
            paymentService.initialize(appointment);
        }
        notifyPatient(
            appointment,
            EventType.APPOINTMENT_CREATED,
            "Đã tạo yêu cầu đặt lịch",
            "Lịch khám " + appointment.getBookingCode() + " đang được giữ trong "
                + HOLD_DURATION_MINUTES + " phút để chờ xác nhận."
        );
        emailSender.sendBookingOtp(
            otpRecipient,
            Map.of(
                "code", otpCode,
                "minutes", String.valueOf(OTP_DURATION_MINUTES),
                "bookingCode", appointment.getBookingCode()
            ),
            "booking-otp-" + appointment.getId(),
            patient.getUserId(),
            appointment.getId(),
            OTP_DURATION_MINUTES * 60L
        );

        // Hold creation runs inside a transaction and the non-outbox sender
        // is deferred until after commit. We therefore cannot truthfully say
        // SENT in this response; the durable outbox and the SMTP worker are
        // the authority for delivery acknowledgement.
        OtpDeliveryStatus otpDeliveryStatus = OtpDeliveryStatus.QUEUED;

        return new HoldSlotResponse(
            bookingCode,
            holdExpiry,
            otpExpiry,
            "Đã giữ chỗ thành công trong " + HOLD_DURATION_MINUTES + " phút. Mã OTP có hiệu lực trong " + OTP_DURATION_MINUTES + " phút.",
            true,
            otpDeliveryStatus
        );
    }

    /**
     * Re-issues the OTP for the existing pending hold. This operation never
     * creates another appointment or extends the hold window. Ownership is
     * checked before any state is disclosed and the database row is locked so
     * concurrent retries cannot create competing codes.
     */
    @Transactional
    public com.healthcare.appointment.dto.ResendOtpResponse resendBookingOtp(
            String bookingCode,
            String phone,
            UserDetails principal) {
        String normalizedBookingCode = bookingCode == null ? "" : bookingCode.trim();
        if (normalizedBookingCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch");
        }

        Appointment appointment = appointmentRepository.findByBookingCodeWithDetailsForUpdate(normalizedBookingCode)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch"));
        authorizeOtpResend(appointment, phone, principal);

        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);
        if (appointment.getStatus() != AppointmentStatus.PENDING_CONFIRMATION) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lịch hẹn không còn chờ xác nhận");
        }
        if (appointment.getHoldExpiresAt() == null || !now.isBefore(appointment.getHoldExpiresAt())) {
            appointment.setStatus(AppointmentStatus.CANCELLED);
            appointment.setCancellationReason(HOLD_EXPIRED_CANCELLATION_REASON);
            appointment.setOtpCode(null);
            appointment.setOtpExpiresAt(null);
            appointment.setOtpIssuedAt(null);
            appointment.setHoldExpiresAt(null);
            appointmentRepository.saveAndFlush(appointment);
            throw new ResponseStatusException(HttpStatus.GONE, "Thời gian giữ chỗ đã hết hạn. Vui lòng thực hiện đặt lại.");
        }

        long cooldownSeconds = configuredOtpResendCooldownSeconds();
        OffsetDateTime lastIssuedAt = appointment.getOtpIssuedAt();
        if (lastIssuedAt != null && now.isBefore(lastIssuedAt.plusSeconds(cooldownSeconds))) {
            long retryAfter = Math.max(1L,
                java.time.Duration.between(now, lastIssuedAt.plusSeconds(cooldownSeconds)).toSeconds() + 1L);
            throw new BusinessException(
                429,
                ErrorCodes.OTP_RESEND_THROTTLED,
                "Mã xác thực vừa được yêu cầu. Vui lòng thử lại sau " + retryAfter + " giây."
            );
        }
        if (!emailSender.isDeliveryAvailable()) {
            throw emailDeliveryUnavailable();
        }

        String otpCode = useFixedTestOtp()
            ? "123456"
            : String.format("%06d", RANDOM.nextInt(1_000_000));
        OffsetDateTime otpExpiry = now.plusMinutes(OTP_DURATION_MINUTES);
        if (appointment.getHoldExpiresAt().isBefore(otpExpiry)) {
            otpExpiry = appointment.getHoldExpiresAt();
        }
        appointment.setOtpCode(passwordEncoder.encode(otpCode));
        appointment.setOtpExpiresAt(otpExpiry);
        appointment.setOtpIssuedAt(now);
        appointment.setOtpAttempts(0);
        appointmentRepository.saveAndFlush(appointment);

        String otpRecipient = storedVerifiedDestination(appointment.getPatient());
        if (otpRecipient == null) {
            throw emailDeliveryUnavailable();
        }
        emailSender.sendBookingOtp(
            otpRecipient,
            Map.of(
                "code", otpCode,
                "minutes", String.valueOf(OTP_DURATION_MINUTES),
                "bookingCode", appointment.getBookingCode()
            ),
            "booking-otp-resend-" + appointment.getId() + "-" + otpExpiry.toEpochSecond(),
            appointment.getPatient().getUserId(),
            appointment.getId(),
            OTP_DURATION_MINUTES * 60L
        );

        return new com.healthcare.appointment.dto.ResendOtpResponse(
            appointment.getBookingCode(),
            appointment.getHoldExpiresAt(),
            appointment.getOtpExpiresAt(),
            true,
            OtpDeliveryStatus.QUEUED,
            "Mã xác thực đang được gửi đến email đã xác minh của bạn.",
            0L
        );
    }

    /**
     * Replays the hold created by an earlier request that carried this key.
     *
     * @return the original hold response, or {@code null} when the key has never
     *         been used. A key reused for a different slot, or one whose hold is
     *         no longer live, is a conflict rather than a silent replay.
     */
    private HoldSlotResponse replayHold(HoldSlotRequest request, String idempotencyKey) {
        Appointment existing = appointmentRepository.findByHoldIdempotencyKey(idempotencyKey).orElse(null);
        if (existing == null) {
            return null;
        }
        UUID existingBranchId = existing.getBranch() == null ? null : existing.getBranch().getId();
        boolean sameRequest = Objects.equals(existing.getDoctor().getId(), request.doctorId())
            && Objects.equals(existing.getAppointmentDate(), request.appointmentDate())
            && Objects.equals(existing.getStartTime(), request.startTime())
            && Objects.equals(existingBranchId, request.branchId());
        if (!sameRequest) {
            throw new BusinessException(
                409,
                ErrorCodes.CONFLICT,
                "Idempotency-Key này đã được dùng cho một yêu cầu giữ chỗ khác. Vui lòng dùng khoá mới."
            );
        }
        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);
        boolean live = existing.getStatus() == AppointmentStatus.PENDING_CONFIRMATION
            && existing.getHoldExpiresAt() != null
            && now.isBefore(existing.getHoldExpiresAt());
        if (!live) {
            throw new BusinessException(
                409,
                ErrorCodes.CONFLICT,
                "Yêu cầu giữ chỗ trước đó đã hết hiệu lực. Vui lòng đặt lại với khoá Idempotency-Key mới."
            );
        }
        return new HoldSlotResponse(
            existing.getBookingCode(),
            existing.getHoldExpiresAt(),
            existing.getOtpExpiresAt(),
            "Yêu cầu giữ chỗ này đã được xử lý trước đó. Mã OTP của lần giữ chỗ đầu tiên vẫn còn hiệu lực.",
            true,
            OtpDeliveryStatus.QUEUED
        );
    }

    private String normalizeIdempotencyKey(String rawIdempotencyKey) {
        if (rawIdempotencyKey == null || rawIdempotencyKey.isBlank()) {
            return null;
        }
        String key = rawIdempotencyKey.trim();
        if (!IDEMPOTENCY_KEY_PATTERN.matcher(key).matches()) {
            throw new BusinessException(
                400,
                ErrorCodes.IDEMPOTENCY_KEY_INVALID,
                "Idempotency-Key không hợp lệ: cần 8-128 ký tự chữ, số hoặc các ký tự . _ : -"
            );
        }
        return key;
    }

    private void authorizeOtpResend(Appointment appointment, String phone, UserDetails principal) {
        if (principal == null) {
            String suppliedPhone = normalizePhone(phone == null ? "" : phone);
            String storedPhone = normalizePhone(appointment.getPatient().getPhone());
            if (suppliedPhone.isBlank() || !suppliedPhone.equals(storedPhone)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch");
            }
            return;
        }
        if (!hasRole(principal, "PATIENT")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch");
        }
        UUID userId = resolveUserId(principal);
        PatientProfile patient = patientProfileRepository.findByUserId(userId).orElse(null);
        if (patient == null || !patient.getId().equals(appointment.getPatient().getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch");
        }
    }

    private long configuredOtpResendCooldownSeconds() {
        long configured = environment == null
            ? 60L
            : environment.getProperty("app.security.auth-otp.resend-cooldown-seconds", Long.class, 60L);
        return Math.max(10L, Math.min(configured, 900L));
    }

    private PatientResolution resolvePatient(
            HoldSlotRequest request,
            String cleanPhone,
            UserDetails userDetails) {
        if (userDetails != null && hasRole(userDetails, "PATIENT")) {
            User authenticatedUser = userRepository.findByEmail(userDetails.getUsername())
                .filter(user -> user.isEmailVerified() && "ACTIVE".equals(user.getStatus()))
                .orElseThrow(this::patientIdentityMismatch);
            UUID userId = authenticatedUser.getId();
            String verifiedDestination = normalizeEmail(authenticatedUser.getEmail());
            PatientProfile linked = patientProfileRepository.findByUserId(userId).orElse(null);
            if (linked != null) {
                if (!normalizePhone(linked.getPhone()).equals(cleanPhone)) {
                    throw patientIdentityMismatch();
                }
                return new PatientResolution(linked, verifiedDestination);
            }

            PatientProfile byPhone = patientProfileRepository.findByPhone(cleanPhone).orElse(null);
            if (byPhone != null) {
                throw patientIdentityMismatch();
            }

            PatientProfile created = new PatientProfile();
            created.setUserId(userId);
            created.setFullName(request.fullName().trim());
            created.setPhone(cleanPhone);
            created.setEmail(verifiedDestination);
            return new PatientResolution(
                patientProfileRepository.save(created),
                verifiedDestination
            );
        }

        String requestedDestination = normalizeEmail(request.email());
        if (requestedDestination == null) {
            throw patientIdentityMismatch();
        }

        PatientProfile existing = patientProfileRepository.findByPhone(cleanPhone).orElse(null);
        if (existing != null) {
            String storedDestination = storedVerifiedDestination(existing);
            if (storedDestination == null || !storedDestination.equals(requestedDestination)) {
                throw patientIdentityMismatch();
            }
            return new PatientResolution(existing, storedDestination);
        }

        PatientProfile created = new PatientProfile();
        created.setFullName(request.fullName().trim());
        created.setPhone(cleanPhone);
        created.setEmail(requestedDestination);
        return new PatientResolution(patientProfileRepository.save(created), requestedDestination);
    }

    /**
     * Verifies OTP and permanently confirms the booking.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AppointmentResponse confirmAppointment(ConfirmAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findByBookingCodeWithDetailsForUpdate(request.bookingCode().trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã đặt lịch"));

        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);

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
            appointment.setCancellationReason(HOLD_EXPIRED_CANCELLATION_REASON);
            appointmentRepository.save(appointment);
            throw new ResponseStatusException(HttpStatus.GONE, "Thời gian giữ chỗ đã hết hạn. Vui lòng thực hiện đặt lại.");
        }

        if (appointment.getOtpExpiresAt() != null && !now.isBefore(appointment.getOtpExpiresAt())) {
            // The hold remains valid until its own expiry. The patient can
            // request a replacement OTP without creating another appointment.
            throw new BusinessException(
                410,
                ErrorCodes.OTP_EXPIRED,
                "Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã trong thời gian giữ chỗ."
            );
        }

        String inputOtp = request.otpCode().trim();
        // Exhausting the attempts locks the OTP challenge; it never cancels the
        // booking. The hold and its remaining window survive, so a resend (which
        // resets the counter) is the only way back to a usable code.
        if (appointment.getOtpAttempts() >= MAX_OTP_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, OTP_ATTEMPTS_EXHAUSTED_MESSAGE);
        }
        if (!matchesOtp(inputOtp, appointment.getOtpCode())) {
            int attempts = appointment.getOtpAttempts() + 1;
            appointment.setOtpAttempts(attempts);
            appointmentRepository.saveAndFlush(appointment);
            if (attempts >= MAX_OTP_ATTEMPTS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, OTP_ATTEMPTS_EXHAUSTED_MESSAGE);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã xác thực OTP không chính xác");
        }

        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setHoldExpiresAt(null);
        appointment.setOtpCode(null);
        appointment.setOtpExpiresAt(null);
        appointment.setOtpIssuedAt(null);
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
        if (appointmentClaimService != null) {
            appointmentClaimService.claimAfterBookingOtp(appointment);
        }
        notifyPatient(
            appointment,
            EventType.APPOINTMENT_CONFIRMED,
            "Lịch khám đã được xác nhận",
            "Lịch khám " + appointment.getBookingCode() + " đã được xác nhận."
        );
        notifyDoctorOfBooking(appointment);
        // OTP proves control of this booking, but this public endpoint must not
        // turn an authenticated caller into a full appointment-detail reader.
        return toPublicResponse(appointment);
    }

    /**
     * Heads-up to the assigned physician that a confirmed booking arrived.
     * The copy mirrors the patient notification style: booking code, slot and
     * branch only — the patient display name never travels with a diagnosis
     * and no clinical content is included.
     */
    private void notifyDoctorOfBooking(Appointment appointment) {
        if (notificationService == null
                || appointment.getDoctor() == null
                || appointment.getDoctor().getUserId() == null) {
            return;
        }
        String branch = appointment.getBranch() != null ? appointment.getBranch().getName() : null;
        String patientName = appointment.getPatient() != null ? appointment.getPatient().getFullName() : null;
        String message = "Lịch khám mới " + appointment.getBookingCode()
            + " lúc " + appointment.getStartTime()
            + " ngày " + appointment.getAppointmentDate()
            + (patientName != null && !patientName.isBlank() ? " — bệnh nhân " + patientName : "")
            + (branch != null ? " tại " + branch + "." : ".");
        notificationService.create(
            appointment.getDoctor().getUserId(),
            EventType.APPOINTMENT_CONFIRMED,
            "Có lịch khám mới được xác nhận",
            message,
            appointment.getId()
        );
    }

    /**
     * Heads-up to the assigned physician that a confirmed booking moved to
     * another slot. Same recipient guard and copy discipline as
     * {@link #notifyDoctorOfBooking}: booking code, new slot and branch, with
     * no clinical content.
     */
    private void notifyDoctorOfReschedule(Appointment appointment) {
        if (notificationService == null
                || appointment.getDoctor() == null
                || appointment.getDoctor().getUserId() == null) {
            return;
        }
        String branch = appointment.getBranch() != null ? appointment.getBranch().getName() : null;
        String message = "Lịch khám " + appointment.getBookingCode()
            + " đã chuyển sang " + appointment.getAppointmentDate()
            + " lúc " + appointment.getStartTime()
            + (branch != null ? " tại " + branch + "." : ".");
        notificationService.create(
            appointment.getDoctor().getUserId(),
            EventType.APPOINTMENT_RESCHEDULED,
            "Lịch khám đã thay đổi",
            message,
            appointment.getId()
        );
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

        if (appointment.getStatus() != AppointmentStatus.PENDING_CONFIRMATION
                && appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Chỉ có thể hủy lịch khám đang chờ xác nhận hoặc đã xác nhận"
            );
        }

        // A slot that has already started cannot be self-cancelled: the visit
        // window is open and the clinic (via the admin cancel path) is the
        // authority for calling it off. PENDING_CONFIRMATION holds are future
        // by construction, so this keys on the scheduled start itself.
        OffsetDateTime cancelCheckNow = OffsetDateTime.now(BUSINESS_ZONE);
        OffsetDateTime slotStart = OffsetDateTime.of(
            appointment.getAppointmentDate(),
            appointment.getStartTime(),
            BUSINESS_ZONE.getRules().getOffset(cancelCheckNow.toInstant()));
        if (!cancelCheckNow.isBefore(slotStart)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Không thể hủy lịch khám đã qua giờ hẹn. Vui lòng liên hệ bệnh viện."
            );
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(reason != null ? reason.trim() : "Bệnh nhân yêu cầu hủy");
        appointment.setHoldExpiresAt(null);
        appointment.setOtpCode(null);
        appointment.setOtpExpiresAt(null);
        appointment.setOtpIssuedAt(null);
        if (paymentService != null) {
            paymentService.markAppointmentCancelled(appointment);
        }
        appointmentRepository.save(appointment);
        notifyPatient(
            appointment,
            EventType.APPOINTMENT_CANCELLED,
            "Lịch khám đã được hủy",
            "Lịch khám " + appointment.getBookingCode() + " đã được hủy."
        );
        return principal == null ? toPublicResponse(appointment) : toResponse(appointment);
    }

    /**
     * Atomically moves a confirmed appointment to another configured, free slot.
     * Validation happens before mutating the existing appointment.
     */
    @Transactional
    public AppointmentResponse rescheduleAppointment(
            String bookingCode,
            RescheduleAppointmentRequest request,
            UserDetails principal) {
        Appointment appointment = appointmentRepository.findByBookingCodeWithDetailsForUpdate(bookingCode.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch khám"));

        authorizeAppointment(appointment, request.phone(), principal);

        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Chỉ có thể đổi lịch khám đang ở trạng thái đã xác nhận"
            );
        }
        doctorRepository.findActiveByIdForUpdate(appointment.getDoctor().getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Bác sĩ hiện không nhận lịch khám"));

        UUID currentBranchId = appointment.getBranch() == null ? null : appointment.getBranch().getId();
        // Omitting the branch keeps the appointment where it already is. It must
        // never null the branch out: a branchless row bypasses the V10 composite
        // (doctor, branch) FK and no schedule can authorize it.
        UUID branchId = request.branchId() != null ? request.branchId() : currentBranchId;
        if (branchId != null) {
            branchRepository.findByIdAndActiveTrue(branchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cơ sở khám"));
            if (!doctorBranchRepository.existsByDoctorIdAndBranchId(appointment.getDoctor().getId(), branchId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bác sĩ không làm việc tại cơ sở khám đã chọn");
            }
        }

        if (appointment.getAppointmentDate().equals(request.appointmentDate())
                && appointment.getStartTime().equals(request.startTime())
                && java.util.Objects.equals(currentBranchId, branchId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khung giờ mới trùng với lịch khám hiện tại");
        }

        ScheduleService.BookableSlot targetSlot = scheduleService.findBookableSlot(
                appointment.getDoctor().getId(), branchId, request.appointmentDate(), request.startTime())
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Khung giờ mới không nằm trong lịch làm việc hoặc đã qua"
            ));

        // Serialize on the physician and the date, not the branch: the V11/V13
        // exclusion constraint is branch-scoped, so cross-branch moves of the
        // same doctor at the same time need this shared key to serialize.
        String slotLockKey = appointment.getDoctor().getId() + ":" + request.appointmentDate();
        slotLocker.acquire(slotLockKey);

        OffsetDateTime now = OffsetDateTime.now(BUSINESS_ZONE);
        List<Appointment> expired = appointmentRepository.findExpiredPendingConflictsForUpdate(
            appointment.getDoctor().getId(),
            branchId,
            request.appointmentDate(),
            request.startTime(),
            targetSlot.endTime(),
            now
        );
        for (Appointment expiredAppointment : expired) {
            expiredAppointment.setStatus(AppointmentStatus.CANCELLED);
            expiredAppointment.setCancellationReason(HOLD_EXPIRED_CANCELLATION_REASON);
        }
        if (!expired.isEmpty()) {
            appointmentRepository.saveAll(expired);
            appointmentRepository.flush();
        }

        boolean occupied = appointmentRepository.findActiveConflictsForUpdate(
                appointment.getDoctor().getId(),
                branchId,
                request.appointmentDate(),
                request.startTime(),
                targetSlot.endTime(),
                now
            ).stream()
            .anyMatch(conflict -> !conflict.getId().equals(appointment.getId()));
        if (occupied) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Khung giờ mới vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác."
            );
        }

        // The branch-scoped query above cannot see a booking at another branch.
        // The row being moved is excluded so a move never conflicts with itself.
        boolean doctorOccupiedElsewhere = appointmentRepository.findDoctorOverlapsForUpdate(
                appointment.getDoctor().getId(),
                request.appointmentDate(),
                request.startTime(),
                targetSlot.endTime(),
                now,
                appointment.getId()
            ).stream()
            .anyMatch(conflict -> !conflict.getId().equals(appointment.getId()));
        if (doctorOccupiedElsewhere) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Bác sĩ đã có lịch khám hoặc đang giữ chỗ ở cơ sở khác trong khung giờ này. "
                    + "Vui lòng chọn khung giờ khác."
            );
        }

        appointment.setBranch(branchId == null ? null : branchRepository.getReferenceById(branchId));
        appointment.setAppointmentDate(request.appointmentDate());
        appointment.setStartTime(request.startTime());
        appointment.setEndTime(targetSlot.endTime());
        appointment.setAppointmentTime(OffsetDateTime.of(
            request.appointmentDate(),
            request.startTime(),
            BUSINESS_ZONE.getRules().getOffset(now.toInstant())
        ));
        appointment.setReminderSentAt(null);

        try {
            appointmentRepository.saveAndFlush(appointment);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Khung giờ mới vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác.",
                exception
            );
        }

        notifyPatient(
            appointment,
            EventType.APPOINTMENT_RESCHEDULED,
            "Lịch khám đã được thay đổi",
            "Lịch khám " + appointment.getBookingCode() + " đã chuyển sang "
                + appointment.getAppointmentDate() + " lúc " + appointment.getStartTime() + "."
        );
        notifyDoctorOfReschedule(appointment);
        return principal == null ? toPublicResponse(appointment) : toResponse(appointment);
    }

    private void notifyPatient(
            Appointment appointment,
            EventType eventType,
            String title,
            String message) {
        if (notificationService != null && appointment.getPatient().getUserId() != null) {
            notificationService.create(
                appointment.getPatient().getUserId(),
                eventType,
                title,
                message,
                appointment.getId()
            );
        }
        if (notificationService != null && appointmentClaimService != null) {
            for (UUID userId : appointmentClaimService.claimedUserIds(appointment.getId())) {
                if (!userId.equals(appointment.getPatient().getUserId())) {
                    notificationService.create(userId, eventType, title, message, appointment.getId());
                }
            }
        }
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
            PatientProfile patient = patientProfileRepository.findByUserId(userId).orElse(null);
            if ((patient != null && patient.getId().equals(appointment.getPatient().getId()))
                    || (appointmentClaimService != null && appointmentClaimService.isOwned(appointment.getId(), userId))) {
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

    private String storedVerifiedDestination(PatientProfile patient) {
        if (patient.getUserId() != null) {
            return userRepository.findById(patient.getUserId())
                .filter(user -> user.isEmailVerified() && "ACTIVE".equals(user.getStatus()))
                .map(User::getEmail)
                .map(this::normalizeEmail)
                .orElse(null);
        }
        return normalizeEmail(patient.getEmail());
    }

    private String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim().toLowerCase();
    }

    private ResponseStatusException patientIdentityMismatch() {
        return new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Không thể xác minh thông tin bệnh nhân"
        );
    }

    private boolean useFixedTestOtp() {
        return allowTestOtp
            && environment != null
            && environment.acceptsProfiles(Profiles.of("test"));
    }

    private BusinessException emailDeliveryUnavailable() {
        return new BusinessException(
            503,
            ErrorCodes.EMAIL_DELIVERY_UNAVAILABLE,
            "Email delivery is temporarily unavailable"
        );
    }

    private record PatientResolution(PatientProfile patient, String otpRecipient) {
    }

    private AppointmentResponse responseForViewer(Appointment appointment, UserDetails principal) {
        return principal == null ? toPublicResponse(appointment) : toResponse(appointment);
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
            a.getCancellationReason(),
            a.isHasInsurance(),
            a.getPrivacyConsentAt(),
            a.getPrivacyConsentVersion(),
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
            a.getCancellationReason(),
            a.isHasInsurance(),
            a.getPrivacyConsentAt(),
            a.getPrivacyConsentVersion(),
            a.getCreatedAt()
        );
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return "***";
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 3);
    }
}
