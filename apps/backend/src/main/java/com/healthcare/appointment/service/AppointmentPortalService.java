package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.DoctorAppointmentResponse;
import com.healthcare.appointment.dto.PatientAppointmentResponse;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.DoctorAppointmentRangeRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.scheduling.dto.DoctorRosterEntryResponse;
import com.healthcare.scheduling.dto.DoctorRosterExceptionResponse;
import com.healthcare.scheduling.service.DoctorScheduleReadService;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AppointmentPortalService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    /**
     * Upper bound on a doctor's range query, inclusive of both endpoints.
     * The OpenAPI description on {@code DoctorPortalController#getAppointments}
     * restates this number as a literal because an annotation cannot read a
     * constant, so changing it here means updating that description too.
     */
    static final int MAX_RANGE_DAYS = 31;
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of(
        "appointmentDate", "startTime", "endTime", "createdAt", "status", "bookingCode", "id"
    );
    private static final Sort PATIENT_DEFAULT_SORT = Sort.by(
        Sort.Order.desc("appointmentDate"),
        Sort.Order.desc("startTime"),
        Sort.Order.desc("createdAt"),
        Sort.Order.desc("id")
    );
    private static final Sort DOCTOR_DEFAULT_SORT = Sort.by(
        Sort.Order.asc("startTime"),
        Sort.Order.asc("createdAt"),
        Sort.Order.asc("id")
    );
    /** Range reads are chronological across days, so the date leads the ordering. */
    private static final Sort DOCTOR_RANGE_DEFAULT_SORT = Sort.by(
        Sort.Order.asc("appointmentDate"),
        Sort.Order.asc("startTime"),
        Sort.Order.asc("createdAt"),
        Sort.Order.asc("id")
    );

    private final AppointmentRepository appointmentRepository;
    private final DoctorAppointmentRangeRepository rangeRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final DoctorScheduleReadService doctorScheduleReadService;

    public AppointmentPortalService(
            AppointmentRepository appointmentRepository,
            DoctorAppointmentRangeRepository rangeRepository,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorScheduleReadService doctorScheduleReadService) {
        this.appointmentRepository = appointmentRepository;
        this.rangeRepository = rangeRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.doctorScheduleReadService = doctorScheduleReadService;
    }

    @Transactional(readOnly = true)
    public Page<PatientAppointmentResponse> getPatientAppointments(
            UserDetails principal,
            Pageable pageable) {
        requireRole(principal, "PATIENT");
        UUID userId = resolveUserId(principal);
        UUID patientId = patientProfileRepository.findByUserId(userId).map(PatientProfile::getId).orElse(null);
        return appointmentRepository.findPortalAppointmentsForPatientOrClaim(
                patientId, userId, normalizePageable(pageable, PATIENT_DEFAULT_SORT))
            .map(this::toPatientResponse);
    }

    /**
     * The doctor's own appointment schedule, either for one day or for a bounded
     * date range.
     *
     * <p>Two modes, one response shape:
     * <ul>
     *   <li>{@code date} supplied — the original single-day read, unchanged:
     *       ordered by start time, same filters, same error messages.</li>
     *   <li>{@code date} absent and {@code from}/{@code to} supplied — a range
     *       read ordered by appointment date then start time, so a multi-day
     *       answer reads chronologically rather than interleaving days by hour.</li>
     * </ul>
     *
     * <p>Neither shape is allowed to become unbounded: the range is rejected if
     * it spans more than {@value #MAX_RANGE_DAYS} days (inclusive) or if either
     * endpoint is missing, and the doctor id is always resolved from the
     * principal — the caller cannot name another doctor. A request that names
     * neither a date nor a range fails exactly as it did before this overload
     * existed.
     */
    @Transactional(readOnly = true)
    public Page<DoctorAppointmentResponse> getDoctorAppointments(
            String date,
            String from,
            String to,
            String status,
            UserDetails principal,
            Pageable pageable) {
        Doctor doctor = requireLinkedDoctor(principal);

        if (isPresent(date)) {
            LocalDate appointmentDate = parseDate(date);
            AppointmentStatus appointmentStatus = parseStatus(status);
            Pageable safePageable = normalizePageable(pageable, DOCTOR_DEFAULT_SORT);
            Page<Appointment> appointments = appointmentStatus == null
                ? appointmentRepository.findPortalAppointmentsForDoctor(
                    doctor.getId(), appointmentDate, safePageable)
                : appointmentRepository.findPortalAppointmentsForDoctorByStatus(
                    doctor.getId(), appointmentDate, appointmentStatus, safePageable);
            return appointments.map(this::toDoctorResponse);
        }

        if (!isPresent(from) && !isPresent(to)) {
            throw badRequest("date is required and must use ISO-8601 format yyyy-MM-dd");
        }
        LocalDate fromDate = parseDateBound("from", from);
        LocalDate toDate = parseDateBound("to", to);
        if (fromDate.isAfter(toDate)) {
            throw badRequest("'from' phải nhỏ hơn hoặc bằng 'to'");
        }
        if (ChronoUnit.DAYS.between(fromDate, toDate) + 1 > MAX_RANGE_DAYS) {
            throw badRequest("Khoảng ngày tra cứu tối đa " + MAX_RANGE_DAYS + " ngày");
        }
        AppointmentStatus appointmentStatus = parseStatus(status);
        Pageable safePageable = normalizePageable(pageable, DOCTOR_RANGE_DEFAULT_SORT);
        Page<Appointment> appointments = appointmentStatus == null
            ? rangeRepository.findRangeForDoctor(doctor.getId(), fromDate, toDate, safePageable)
            : rangeRepository.findRangeForDoctorByStatus(
                doctor.getId(), fromDate, toDate, appointmentStatus, safePageable);
        return appointments.map(this::toDoctorResponse);
    }

    /**
     * The doctor's own weekly roster (active and inactive rows).
     *
     * <p>Resolves the doctor from the principal with the same
     * {@code requireLinkedDoctor} gate as the appointment reads, so an account
     * without a doctor profile is refused here too and no caller can request
     * another doctor's roster.
     */
    @Transactional(readOnly = true)
    public List<DoctorRosterEntryResponse> getDoctorRoster(UserDetails principal) {
        return doctorScheduleReadService.listRoster(requireLinkedDoctor(principal).getId());
    }

    /**
     * The doctor's own schedule exceptions, most recent date first.
     *
     * <p>Same principal-derived scoping as {@link #getDoctorRoster(UserDetails)}.
     */
    @Transactional(readOnly = true)
    public List<DoctorRosterExceptionResponse> getDoctorScheduleExceptions(UserDetails principal) {
        return doctorScheduleReadService.listExceptions(requireLinkedDoctor(principal).getId());
    }

    /**
     * Advances one appointment through the same-day clinical workflow on behalf
     * of the doctor it is assigned to.
     *
     * <p>The state machine is deliberately narrow — the doctor can acknowledge a
     * patient, start the visit, or mark a no-show, and nothing else:
     * <pre>
     *   CONFIRMED  -> CHECKED_IN | NO_SHOW
     *   CHECKED_IN -> IN_PROGRESS | NO_SHOW
     *   IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW -> (terminal here)
     * </pre>
     * COMPLETED is unreachable through this method by design: it is written only
     * when a medical record is created for the appointment, so the appointment
     * state and the clinical evidence can never disagree. A repeated request for
     * the current status is a no-op that returns the row rather than an error,
     * which keeps a double-clicked button idempotent.
     *
     * <p>Two time gates protect the record from being written from the wrong
     * day: CHECKED_IN and IN_PROGRESS are accepted only when the appointment
     * date is today in the hospital's business zone (Asia/Ho_Chi_Minh), and
     * NO_SHOW only once the visit window has actually ended — the previous day,
     * or today after {@code endTime} (falling back to {@code startTime + 30min}
     * when no end time was stored). Both gates refuse with 409 rather than
     * silently recording a false one.
     *
     * <p>Ownership is enforced before any mutation: the doctor is resolved from
     * the principal, the row is loaded {@code FOR UPDATE} so a concurrent
     * transition cannot interleave, and an appointment assigned to a different
     * doctor is refused as {@code AccessDeniedException}.
     */
    @Transactional
    public DoctorAppointmentResponse updateDoctorAppointmentStatus(
            UUID appointmentId,
            AppointmentStatus targetStatus,
            UserDetails principal) {
        Doctor doctor = requireLinkedDoctor(principal);
        Appointment appointment = appointmentRepository.findByIdWithDetailsForUpdate(appointmentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch khám"));
        if (!appointment.getDoctor().getId().equals(doctor.getId())) {
            throw new AccessDeniedException("Bác sĩ không được phân công lịch khám này");
        }

        AppointmentStatus currentStatus = appointment.getStatus();
        if (targetStatus == currentStatus) {
            return toDoctorResponse(appointment);
        }
        boolean allowed = switch (currentStatus) {
            case CONFIRMED -> targetStatus == AppointmentStatus.CHECKED_IN
                || targetStatus == AppointmentStatus.NO_SHOW;
            case CHECKED_IN -> targetStatus == AppointmentStatus.IN_PROGRESS
                || targetStatus == AppointmentStatus.NO_SHOW;
            default -> false;
        };
        if (!allowed) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Không thể chuyển trạng thái lịch khám từ " + currentStatus + " sang " + targetStatus
            );
        }

        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        if ((targetStatus == AppointmentStatus.CHECKED_IN || targetStatus == AppointmentStatus.IN_PROGRESS)
                && !appointment.getAppointmentDate().equals(today)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ có thể tiếp nhận lịch khám trong ngày hôm nay");
        }
        if (targetStatus == AppointmentStatus.NO_SHOW) {
            LocalTime endTime = appointment.getEndTime() == null
                ? appointment.getStartTime().plusMinutes(30)
                : appointment.getEndTime();
            boolean visitHasEnded = appointment.getAppointmentDate().isBefore(today)
                || (appointment.getAppointmentDate().equals(today) && !LocalTime.now(BUSINESS_ZONE).isBefore(endTime));
            if (!visitHasEnded) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ có thể đánh dấu vắng mặt sau khi khung giờ khám kết thúc"
                );
            }
        }

        appointment.setStatus(targetStatus);
        return toDoctorResponse(appointmentRepository.saveAndFlush(appointment));
    }

    private PatientProfile requireLinkedPatient(UserDetails principal) {
        requireRole(principal, "PATIENT");
        return patientProfileRepository.findByUserId(resolveUserId(principal))
            .orElseThrow(() -> new AccessDeniedException("No patient profile is linked to this account"));
    }

    private Doctor requireLinkedDoctor(UserDetails principal) {
        requireRole(principal, "DOCTOR");
        return doctorRepository.findByUserId(resolveUserId(principal))
            .orElseThrow(() -> new AccessDeniedException("No doctor profile is linked to this account"));
    }

    private UUID resolveUserId(UserDetails principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication required");
        }
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        return userRepository.findByEmail(principal.getUsername())
            .map(User::getId)
            .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    private void requireRole(UserDetails principal, String role) {
        if (principal == null || principal.getAuthorities().stream()
                .noneMatch(authority -> ("ROLE_" + role).equals(authority.getAuthority()))) {
            throw new AccessDeniedException("Appointment access denied");
        }
    }

    private LocalDate parseDate(String rawDate) {
        if (rawDate == null || rawDate.isBlank()) {
            throw badRequest("date is required and must use ISO-8601 format yyyy-MM-dd");
        }
        try {
            return LocalDate.parse(rawDate, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException ex) {
            throw badRequest("date must use ISO-8601 format yyyy-MM-dd");
        }
    }

    /**
     * Range bounds are named so the client learns which endpoint it got wrong;
     * an empty string counts as absent so a blank query parameter cannot open a
     * range that was never intended.
     */
    private LocalDate parseDateBound(String name, String rawDate) {
        if (!isPresent(rawDate)) {
            throw badRequest("'" + name + "' is required and must use ISO-8601 format yyyy-MM-dd");
        }
        try {
            return LocalDate.parse(rawDate.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException ex) {
            throw badRequest("'" + name + "' must use ISO-8601 format yyyy-MM-dd");
        }
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    private AppointmentStatus parseStatus(String rawStatus) {
        if (rawStatus == null) {
            return null;
        }
        if (rawStatus.isBlank()) {
            throw badRequest("status must be a supported appointment status");
        }
        try {
            return AppointmentStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw badRequest("status must be a supported appointment status");
        }
    }

    private Pageable normalizePageable(Pageable pageable, Sort defaultSort) {
        int page = pageable == null ? 0 : pageable.getPageNumber();
        int size = pageable == null ? DEFAULT_PAGE_SIZE : pageable.getPageSize();
        if (page < 0) {
            throw badRequest("page must be zero or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw badRequest("size must be between 1 and " + MAX_PAGE_SIZE);
        }

        Sort sort = pageable == null || pageable.getSort().isUnsorted()
            ? defaultSort
            : pageable.getSort();
        sort.forEach(order -> {
            if (!ALLOWED_SORT_PROPERTIES.contains(order.getProperty())) {
                throw badRequest("unsupported appointment sort property: " + order.getProperty());
            }
        });
        return PageRequest.of(page, size, sort);
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private PatientAppointmentResponse toPatientResponse(Appointment appointment) {
        return new PatientAppointmentResponse(
            appointment.getId(),
            appointment.getBookingCode(),
            appointment.getDoctor().getId(),
            appointment.getDoctor().getFullName(),
            appointment.getSpecialty() == null ? null : appointment.getSpecialty().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getId(),
            appointment.getBranch() == null ? null : appointment.getBranch().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getAddress(),
            appointment.getMedicalPackage() == null ? null : appointment.getMedicalPackage().getName(),
            appointment.getAppointmentDate(),
            appointment.getStartTime(),
            appointment.getEndTime(),
            appointment.getStatus(),
            appointment.getPaymentStatus(),
            appointment.getReasonForVisit(),
            appointment.getCancellationReason(),
            appointment.getCreatedAt()
        );
    }

    private DoctorAppointmentResponse toDoctorResponse(Appointment appointment) {
        return new DoctorAppointmentResponse(
            appointment.getId(),
            appointment.getBookingCode(),
            appointment.getPatient().getId(),
            appointment.getPatient().getFullName(),
            appointment.getSpecialty() == null ? null : appointment.getSpecialty().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getId(),
            appointment.getBranch() == null ? null : appointment.getBranch().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getAddress(),
            appointment.getMedicalPackage() == null ? null : appointment.getMedicalPackage().getName(),
            appointment.getAppointmentDate(),
            appointment.getStartTime(),
            appointment.getEndTime(),
            appointment.getStatus(),
            appointment.getPaymentStatus(),
            appointment.getReasonForVisit(),
            appointment.getCancellationReason(),
            appointment.getCreatedAt()
        );
    }
}
