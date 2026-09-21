package com.healthcare.appointment.service;

import com.healthcare.appointment.dto.AdminCancelAppointmentRequest;
import com.healthcare.appointment.dto.AppointmentResponse;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminAppointmentService {

    private static final int MAX_PAGE_SIZE = 100;
    /**
     * Statuses an administrator may cancel from. A booking that has not yet been
     * confirmed, has been confirmed, or is already under way is still live and
     * can legitimately be called off; COMPLETED, CANCELLED and NO_SHOW are
     * terminal and cancelling them would rewrite history.
     */
    private static final Set<AppointmentStatus> CANCELLABLE = EnumSet.of(
        AppointmentStatus.PENDING_CONFIRMATION,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.IN_PROGRESS
    );
    private static final int MAX_CANCEL_REASON_LENGTH = 500;
    /**
     * Neutral, clinic-authored copy used when an administrator cancels without
     * recording a reason. It exists so the patient-facing notice never quotes a
     * stale machine-written string left on a live appointment (an expired hold
     * or an exhausted OTP attempt) as if the clinic had justified this
     * cancellation with it.
     */
    private static final String CANCELLED_WITHOUT_RECORDED_REASON = "Hủy theo quyết định của cơ sở";
    private static final Set<String> ALLOWED_SORTS = Set.of(
        "appointmentDate", "startTime", "createdAt", "status", "bookingCode", "id"
    );
    private static final Sort DEFAULT_SORT = Sort.by(
        Sort.Order.desc("appointmentDate"),
        Sort.Order.desc("startTime"),
        Sort.Order.desc("createdAt")
    );

    private final AppointmentRepository appointmentRepository;
    private final ClinicalAccessAuditService clinicalAccessAuditService;
    private final NotificationService notificationService;

    @org.springframework.beans.factory.annotation.Autowired
    public AdminAppointmentService(
            AppointmentRepository appointmentRepository,
            ClinicalAccessAuditService clinicalAccessAuditService,
            NotificationService notificationService) {
        this.appointmentRepository = appointmentRepository;
        this.clinicalAccessAuditService = clinicalAccessAuditService;
        this.notificationService = notificationService;
    }

    /** Backward-compatible constructor for focused unit tests. */
    public AdminAppointmentService(
            AppointmentRepository appointmentRepository,
            ClinicalAccessAuditService clinicalAccessAuditService) {
        this(appointmentRepository, clinicalAccessAuditService, null);
    }

    @Transactional(readOnly = true)
    public Page<AppointmentResponse> list(LocalDate date, String rawStatus, Pageable pageable) {
        AppointmentStatus status = parseStatus(rawStatus);
        Pageable safePageable = normalize(pageable);
        Page<Appointment> appointments;
        if (date == null && status == null) {
            appointments = appointmentRepository.findAllForAdmin(safePageable);
        } else if (date == null) {
            appointments = appointmentRepository.findByStatus(status, safePageable);
        } else if (status == null) {
            appointments = appointmentRepository.findByAppointmentDate(date, safePageable);
        } else {
            appointments = appointmentRepository.findByAppointmentDateAndStatus(date, status, safePageable);
        }
        return appointments.map(this::toResponse);
    }

    /**
     * Cancels a live appointment on behalf of the clinic (for example when the
     * patient telephones the front desk) and records the decision as
     * append-only evidence.
     *
     * <p>Only {@code CANCELLED} is reachable through this entry point, and only
     * from PENDING_CONFIRMATION, CONFIRMED, CHECKED_IN or IN_PROGRESS. Every
     * other combination — including a second cancellation and any attempt to
     * reach COMPLETED or NO_SHOW, which require clinical evidence (a medical
     * record or an elapsed visit) — is refused with 409
     * {@code APPOINTMENT_STATUS_TRANSITION_INVALID} before the row is touched.
     * The appointment is loaded {@code FOR UPDATE} so two administrators
     * cancelling the same booking cannot interleave with a doctor's same-day
     * transition; the loser re-reads the already-CANCELLED row and is refused.
     *
     * <p>The audit row is written after the status change has been flushed, so
     * it never claims a cancellation the database refused. It carries the
     * acting administrator, the appointment as target and the patient id, but
     * never the reason text: the free-text note stays on the appointment row
     * where the clinic's own retention applies, and the evidence table stays
     * free of clinical narrative.
     */
    @Transactional
    public AppointmentResponse cancel(
            UUID appointmentId,
            AdminCancelAppointmentRequest request,
            UserDetails principal) {
        if (appointmentId == null) {
            throw new BusinessException(400, ErrorCodes.VALIDATION_ERROR, "Thiếu mã lịch hẹn");
        }
        if (request == null || request.status() == null) {
            throw new BusinessException(400, ErrorCodes.VALIDATION_ERROR, "Trạng thái không được để trống");
        }
        if (request.status() != AppointmentStatus.CANCELLED) {
            throw invalidTransition(null, request.status());
        }
        String reason = request.reason();
        if (reason != null && reason.length() > MAX_CANCEL_REASON_LENGTH) {
            throw new BusinessException(400, ErrorCodes.VALIDATION_ERROR, "Lý do hủy tối đa 500 ký tự");
        }

        Appointment appointment = appointmentRepository.findByIdWithDetailsForUpdate(appointmentId)
            .orElseThrow(() -> new BusinessException(
                404, ErrorCodes.APPOINTMENT_NOT_FOUND, "Không tìm thấy lịch hẹn"));
        AppointmentStatus currentStatus = appointment.getStatus();
        if (!CANCELLABLE.contains(currentStatus)) {
            throw invalidTransition(currentStatus, request.status());
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        // The reason column describes THIS cancellation. The appointment was
        // proven live above, so any string already stored was written by an
        // earlier machine step of the booking lifecycle (an expired hold or an
        // exhausted OTP attempt in {@link BookingService}, the hold sweeper),
        // never by the person cancelling now. Keeping it would tell the patient
        // a reason nobody gave, so the value is rewritten unconditionally: an
        // explicit admin reason wins, and an omitted one stays absent rather
        // than inheriting a stale system string.
        appointment.setCancellationReason(reason);
        // A cancelled booking must not stay confirmable through a still-valid
        // OTP or keep a slot hold alive; the same cleanup the patient cancel
        // path performs applies here.
        appointment.setHoldExpiresAt(null);
        appointment.setOtpCode(null);
        appointment.setOtpExpiresAt(null);
        appointment.setOtpIssuedAt(null);
        Appointment saved = appointmentRepository.saveAndFlush(appointment);

        clinicalAccessAuditService.record(
            principal,
            saved.getPatient() == null ? null : saved.getPatient().getId(),
            ClinicalAccessAuditService.TARGET_APPOINTMENT,
            saved.getId() == null ? "unknown" : saved.getId().toString(),
            ClinicalAccessAuditService.ACTION_ADMIN_CANCEL_APPOINTMENT,
            ClinicalAccessAuditService.DECISION_ALLOW
        );
        notifyPatientOfCancellation(saved);
        return toResponse(saved);
    }

    /**
     * In-app notice to the patient that the clinic cancelled their booking.
     *
     * <p>After {@link #cancel} has run, {@code cancellationReason} only ever
     * holds the text written by this cancellation, so it is quoted verbatim —
     * the patient learns the same fact the front desk recorded. When no reason
     * was recorded, the copy falls back to the neutral clinic-authored reason
     * instead of a stale system string, and stays free of any clinical
     * narrative, mirroring the patient-cancel wording in {@link BookingService}.
     */
    private void notifyPatientOfCancellation(Appointment appointment) {
        if (notificationService == null
                || appointment.getPatient() == null
                || appointment.getPatient().getUserId() == null) {
            return;
        }
        String reason = appointment.getCancellationReason();
        String effectiveReason = reason == null || reason.isBlank()
            ? CANCELLED_WITHOUT_RECORDED_REASON
            : reason.trim();
        String message = "Lịch khám " + appointment.getBookingCode()
            + " đã được cơ sở hủy. Lý do: " + effectiveReason;
        notificationService.create(
            appointment.getPatient().getUserId(),
            EventType.APPOINTMENT_CANCELLED,
            "Lịch khám đã được hủy",
            message,
            appointment.getId()
        );
    }

    private BusinessException invalidTransition(AppointmentStatus current, AppointmentStatus target) {
        String message = current == null
            ? "Quản trị viên chỉ có thể hủy lịch hẹn (CANCELLED)"
            : "Không thể chuyển lịch hẹn từ " + current + " sang " + target;
        return new BusinessException(409, ErrorCodes.APPOINTMENT_STATUS_TRANSITION_INVALID, message);
    }

    private AppointmentStatus parseStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) return null;
        try {
            return AppointmentStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái lịch hẹn không hợp lệ");
        }
    }

    private Pageable normalize(Pageable pageable) {
        int page = pageable == null ? 0 : pageable.getPageNumber();
        int size = pageable == null ? 20 : pageable.getPageSize();
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page phải >= 0 và size phải từ 1 đến 100");
        }
        Sort sort = pageable == null || pageable.getSort().isUnsorted() ? DEFAULT_SORT : pageable.getSort();
        sort.forEach(order -> {
            if (!ALLOWED_SORTS.contains(order.getProperty())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thuộc tính sắp xếp lịch hẹn không được hỗ trợ");
            }
        });
        return PageRequest.of(page, size, sort);
    }

    private AppointmentResponse toResponse(Appointment appointment) {
        return new AppointmentResponse(
            appointment.getId(), appointment.getBookingCode(), appointment.getPatient().getFullName(),
            appointment.getPatient().getPhone(), appointment.getPatient().getEmail(), appointment.getDoctor().getId(),
            appointment.getDoctor().getFullName(), "Bác sĩ chuyên khoa",
            appointment.getSpecialty() == null ? null : appointment.getSpecialty().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getName(),
            appointment.getBranch() == null ? null : appointment.getBranch().getAddress(),
            appointment.getMedicalPackage() == null ? null : appointment.getMedicalPackage().getName(),
            appointment.getAppointmentDate(), appointment.getStartTime(), appointment.getEndTime(),
            appointment.getStatus(), appointment.getPaymentStatus(), appointment.getReasonForVisit(),
            appointment.getCancellationReason(),
            appointment.isHasInsurance(), appointment.getPrivacyConsentAt(), appointment.getPrivacyConsentVersion(),
            appointment.getCreatedAt()
        );
    }
}
