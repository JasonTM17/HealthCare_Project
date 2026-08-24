package com.healthcare.payment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.payment.dto.BankTransferPaymentResponse;
import com.healthcare.payment.dto.ReviewBankTransferRequest;
import com.healthcare.payment.dto.RefundBankTransferRequest;
import com.healthcare.payment.dto.SubmitBankTransferRequest;
import com.healthcare.payment.dto.BankTransferWebhookRequest;
import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.entity.PaymentStatus;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
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

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.HexFormat;

@Service
public class BankTransferPaymentService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORTS = Set.of("createdAt", "submittedAt", "verifiedAt", "status", "amount", "id");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("submittedAt"), Sort.Order.desc("createdAt"));

    private final BankTransferPaymentRepository paymentRepository;
    private final AppointmentRepository appointmentRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final PaymentAuditService auditService;
    private final AppointmentClaimService appointmentClaimService;
    private final PaymentStatusEmailService statusEmailService;

    @Value("${app.payment.bank-transfer.enabled:false}")
    private boolean enabled;
    @Value("${app.payment.bank-transfer.bank-name:}")
    private String bankName;
    @Value("${app.payment.bank-transfer.account-number:}")
    private String bankAccount;
    @Value("${app.payment.bank-transfer.account-holder:}")
    private String accountHolder;
    @Value("${app.payment.bank-transfer.bank-bin:}")
    private String bankBin;
    @Value("${app.payment.bank-transfer.default-amount:200000}")
    private BigDecimal defaultAmount;

    public BankTransferPaymentService(
            BankTransferPaymentRepository paymentRepository,
            AppointmentRepository appointmentRepository,
            PatientProfileRepository patientProfileRepository,
            UserRepository userRepository,
            NotificationService notificationService,
            PaymentAuditService auditService,
            AppointmentClaimService appointmentClaimService,
            PaymentStatusEmailService statusEmailService) {
        this.paymentRepository = paymentRepository;
        this.appointmentRepository = appointmentRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.appointmentClaimService = appointmentClaimService;
        this.statusEmailService = statusEmailService;
    }

    public boolean isAvailable() {
        return enabled && !bankName.isBlank() && !bankAccount.isBlank() && !bankBin.isBlank();
    }

    /** Called inside booking confirmation so amount and transfer content are immutable snapshots. */
    @Transactional
    public BankTransferPayment initialize(Appointment appointment) {
        requireConfigured();
        return paymentRepository.findByAppointmentId(appointment.getId()).orElseGet(() -> {
            BankTransferPayment payment = new BankTransferPayment();
            payment.setAppointment(appointment);
            BigDecimal amount = appointment.getMedicalPackage() == null
                ? defaultAmount
                : appointment.getMedicalPackage().getPrice();
            if (amount == null || amount.signum() <= 0) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Phí thanh toán chưa được cấu hình hợp lệ");
            }
            payment.setAmount(amount);
            payment.setTransferContent("HC " + appointment.getBookingCode().replace("APT-", ""));
            return paymentRepository.saveAndFlush(payment);
        });
    }

    @Transactional
    public BankTransferPaymentResponse getForPatient(UUID appointmentId, UserDetails principal) {
        requireConfigured();
        Appointment appointment = ownAppointmentForUpdate(appointmentId, principal);
        ensurePayable(appointment);
        return toResponse(initialize(appointment));
    }

    @Transactional
    public BankTransferPaymentResponse submit(
            UUID appointmentId,
            SubmitBankTransferRequest request,
            String idempotencyKey,
            UserDetails principal) {
        requireConfigured();
        Appointment appointment = ownAppointmentForUpdate(appointmentId, principal);
        ensurePayable(appointment);
        initialize(appointment);
        BankTransferPayment payment = paymentRepository.findByAppointmentIdForUpdate(appointmentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu thanh toán"));
        String reference = normalizeReference(request.transactionReference());
        String requestHash = sha256(reference);
        String normalizedKey = normalizeIdempotencyKey(idempotencyKey);

        if (normalizedKey.equals(payment.getSubmissionIdempotencyKey())) {
            if (requestHash.equals(payment.getSubmissionRequestHash())) return toResponse(payment);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key đã được dùng cho yêu cầu khác");
        }

        if (payment.getStatus() == PaymentStatus.PAID) return toResponse(payment);
        if (payment.getStatus() == PaymentStatus.PENDING_VERIFICATION) {
            if (reference.equals(payment.getTransactionReference())) return toResponse(payment);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Thanh toán đang chờ kiểm tra với một mã giao dịch khác");
        }
        if (payment.getStatus() == PaymentStatus.REFUND_PENDING || payment.getStatus() == PaymentStatus.REFUNDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Thanh toán này đang hoặc đã được hoàn tiền");
        }

        PaymentStatus previousStatus = payment.getStatus();
        payment.setTransactionReference(reference);
        payment.setSubmissionIdempotencyKey(normalizedKey);
        payment.setSubmissionRequestHash(requestHash);
        payment.setSubmittedAt(OffsetDateTime.now(BUSINESS_ZONE));
        payment.setVerifiedAt(null);
        payment.setVerifiedBy(null);
        payment.setRejectionReason(null);
        payment.setStatus(PaymentStatus.PENDING_VERIFICATION);
        appointment.setPaymentStatus(PaymentStatus.PENDING_VERIFICATION.name());
        appointmentRepository.save(appointment);
        BankTransferPayment saved = paymentRepository.save(payment);
        auditService.record(principal.getUsername(), "PATIENT_SUBMITTED", saved.getId(), appointment.getId(),
            transition(previousStatus, saved.getStatus()) + ";referenceFingerprint=" + fingerprint(reference));
        notifyPatient(appointment, EventType.PAYMENT_SUBMITTED, "Đã nhận thông tin chuyển khoản",
            "Giao dịch cho lịch " + appointment.getBookingCode() + " đang được kiểm tra.");
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<BankTransferPaymentResponse> listForAdmin(String rawStatus, Pageable pageable) {
        PaymentStatus status = parseStatus(rawStatus);
        Pageable safePageable = normalize(pageable);
        Page<BankTransferPayment> payments = status == null
            ? paymentRepository.findAllWithAppointment(safePageable)
            : paymentRepository.findByStatus(status, safePageable);
        return payments.map(this::toResponse);
    }

    @Transactional
    public BankTransferPaymentResponse review(
            UUID paymentId,
            ReviewBankTransferRequest request,
            UserDetails principal) {
        BankTransferPayment payment = paymentRepository.findByIdForUpdate(paymentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thanh toán"));
        User reviewer = userRepository.findByEmail(principal.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không hợp lệ"));

        PaymentStatus previousStatus = payment.getStatus();
        if (request.decision() == ReviewBankTransferRequest.Decision.VERIFY) {
            ensureAppointmentCanBePaid(payment.getAppointment());
            if (payment.getStatus() == PaymentStatus.PAID) return toResponse(payment);
            if (payment.getStatus() != PaymentStatus.PENDING_VERIFICATION) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ có thể duyệt giao dịch đang chờ kiểm tra");
            }
            payment.setStatus(PaymentStatus.PAID);
            payment.setVerifiedAt(OffsetDateTime.now(BUSINESS_ZONE));
            payment.setVerifiedBy(reviewer);
            payment.setRejectionReason(null);
            payment.getAppointment().setPaymentStatus(PaymentStatus.PAID.name());
            notifyPatient(payment.getAppointment(), EventType.PAYMENT_CONFIRMED, "Thanh toán đã được xác nhận",
                "Thanh toán cho lịch " + payment.getAppointment().getBookingCode() + " đã được xác nhận.");
        } else {
            String reason = request.reason() == null ? "Không đối soát được giao dịch" : request.reason().trim();
            if (reason.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần nhập lý do từ chối thanh toán");
            }
            if (payment.getStatus() == PaymentStatus.REJECTED && reason.equals(payment.getRejectionReason())) {
                return toResponse(payment);
            }
            if (payment.getStatus() != PaymentStatus.PENDING_VERIFICATION) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ có thể từ chối giao dịch đang chờ kiểm tra");
            }
            payment.setStatus(PaymentStatus.REJECTED);
            payment.setVerifiedAt(null);
            payment.setVerifiedBy(reviewer);
            payment.setRejectionReason(reason);
            payment.getAppointment().setPaymentStatus(PaymentStatus.REJECTED.name());
            notifyPatient(payment.getAppointment(), EventType.PAYMENT_REJECTED, "Thanh toán cần kiểm tra lại",
                "Giao dịch cho lịch " + payment.getAppointment().getBookingCode() + " chưa được xác nhận: " + reason);
        }
        appointmentRepository.save(payment.getAppointment());
        BankTransferPayment saved = paymentRepository.save(payment);
        String auditDetails = transition(previousStatus, saved.getStatus());
        if (request.decision() == ReviewBankTransferRequest.Decision.REJECT) {
            auditDetails += ";reasonProvided=true";
        }
        auditService.record(principal.getUsername(), "ADMIN_" + request.decision().name(), saved.getId(),
            saved.getAppointment().getId(), auditDetails);
        if (saved.getStatus() == PaymentStatus.PAID) {
            statusEmailService.paymentConfirmed(saved);
        } else {
            statusEmailService.paymentRejected(saved);
        }
        return toResponse(saved);
    }

    @Transactional
    public BankTransferPaymentResponse refund(UUID paymentId, RefundBankTransferRequest request, UserDetails principal) {
        BankTransferPayment payment = paymentRepository.findByIdForUpdate(paymentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thanh toán"));
        String reference = normalizeReference(request.refundReference());
        if (payment.getStatus() == PaymentStatus.REFUNDED) {
            if (reference.equals(payment.getRefundReference())) return toResponse(payment);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Khoản tiền đã được hoàn với mã khác");
        }
        if (payment.getStatus() != PaymentStatus.REFUND_PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ có thể xác nhận khoản đang chờ hoàn tiền");
        }
        User reviewer = userRepository.findByEmail(principal.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không hợp lệ"));
        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setRefundReference(reference);
        payment.setRefundedAt(OffsetDateTime.now(BUSINESS_ZONE));
        payment.setRefundedBy(reviewer);
        payment.getAppointment().setPaymentStatus(PaymentStatus.REFUNDED.name());
        appointmentRepository.save(payment.getAppointment());
        BankTransferPayment saved = paymentRepository.save(payment);
        auditService.record(principal.getUsername(), "ADMIN_REFUNDED", saved.getId(), saved.getAppointment().getId(),
            transition(PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED)
                + ";referenceFingerprint=" + fingerprint(reference));
        notifyPatient(saved.getAppointment(), EventType.PAYMENT_REFUNDED, "Khoản thanh toán đã được hoàn",
            "Khoản thanh toán cho lịch " + saved.getAppointment().getBookingCode() + " đã được hoàn tiền.");
        statusEmailService.paymentRefunded(saved);
        return toResponse(saved);
    }

    @Transactional
    public BankTransferPaymentResponse confirmFromWebhook(BankTransferWebhookRequest request, String eventId) {
        requireConfigured();
        BankTransferPayment payment = paymentRepository.findByTransferContentForUpdate(request.transferContent().trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nội dung chuyển khoản"));
        if (payment.getAmount().compareTo(request.amount()) != 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Số tiền webhook không khớp");
        }
        String reference = normalizeReference(request.transactionReference());
        if (payment.getStatus() == PaymentStatus.PAID) {
            if (reference.equals(payment.getTransactionReference())) return toResponse(payment);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Thanh toán đã được xác nhận với mã giao dịch khác");
        }
        ensureAppointmentCanBePaid(payment.getAppointment());
        if (payment.getStatus() == PaymentStatus.REFUND_PENDING || payment.getStatus() == PaymentStatus.REFUNDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Khoản thanh toán đã vào quy trình hoàn tiền");
        }
        PaymentStatus previousStatus = payment.getStatus();
        payment.setTransactionReference(reference);
        if (payment.getSubmittedAt() == null) payment.setSubmittedAt(OffsetDateTime.now(BUSINESS_ZONE));
        payment.setStatus(PaymentStatus.PAID);
        payment.setVerifiedAt(OffsetDateTime.now(BUSINESS_ZONE));
        payment.setVerifiedBy(null);
        payment.setRejectionReason(null);
        payment.getAppointment().setPaymentStatus(PaymentStatus.PAID.name());
        appointmentRepository.save(payment.getAppointment());
        BankTransferPayment saved = paymentRepository.save(payment);
        auditService.record("webhook", "WEBHOOK_CONFIRMED", saved.getId(), saved.getAppointment().getId(),
            transition(previousStatus, PaymentStatus.PAID) + ";eventFingerprint=" + fingerprint(eventId));
        notifyPatient(saved.getAppointment(), EventType.PAYMENT_CONFIRMED, "Thanh toán đã được xác nhận",
            "Thanh toán cho lịch " + saved.getAppointment().getBookingCode() + " đã được tự động xác nhận.");
        statusEmailService.paymentConfirmed(saved);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public BankTransferPaymentResponse getByTransferContent(String transferContent) {
        return paymentRepository.findByTransferContentForUpdate(transferContent.trim())
            .map(this::toResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nội dung chuyển khoản"));
    }

    @Transactional
    public void markAppointmentCancelled(Appointment appointment) {
        paymentRepository.findByAppointmentIdForUpdate(appointment.getId()).ifPresent(payment -> {
            if (payment.getStatus() == PaymentStatus.PAID) {
                payment.setStatus(PaymentStatus.REFUND_PENDING);
                appointment.setPaymentStatus(PaymentStatus.REFUND_PENDING.name());
                BankTransferPayment saved = paymentRepository.save(payment);
                auditService.record("system:appointment-cancelled", "REFUND_PENDING", saved.getId(),
                    appointment.getId(), transition(PaymentStatus.PAID, PaymentStatus.REFUND_PENDING));
            } else if (payment.getStatus() == PaymentStatus.PENDING_VERIFICATION) {
                payment.setStatus(PaymentStatus.REJECTED);
                payment.setRejectionReason("Lịch hẹn đã được hủy trước khi đối soát giao dịch");
                appointment.setPaymentStatus(PaymentStatus.REJECTED.name());
                BankTransferPayment saved = paymentRepository.save(payment);
                auditService.record("system:appointment-cancelled", "REJECTED", saved.getId(),
                    appointment.getId(), transition(PaymentStatus.PENDING_VERIFICATION, PaymentStatus.REJECTED));
            }
        });
    }

    private Appointment ownAppointmentForUpdate(UUID appointmentId, UserDetails principal) {
        if (principal == null) throw new AccessDeniedException("Cần đăng nhập bằng tài khoản bệnh nhân");
        User user = userRepository.findByEmail(principal.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không hợp lệ"));
        PatientProfile patient = patientProfileRepository.findByUserId(user.getId()).orElse(null);
        Appointment appointment = appointmentRepository.findByIdWithDetailsForUpdate(appointmentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch hẹn"));
        if ((patient == null || !appointment.getPatient().getId().equals(patient.getId()))
                && !appointmentClaimService.isOwned(appointmentId, user.getId())) {
            throw new AccessDeniedException("Bạn không có quyền truy cập thanh toán này");
        }
        return appointment;
    }

    private void ensurePayable(Appointment appointment) {
        if (appointment.getStatus() == AppointmentStatus.PENDING_CONFIRMATION
                || appointment.getStatus() == AppointmentStatus.CANCELLED
                || appointment.getStatus() == AppointmentStatus.NO_SHOW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lịch hẹn hiện không thể thanh toán");
        }
    }

    private void ensureAppointmentCanBePaid(Appointment appointment) {
        if (appointment.getStatus() == AppointmentStatus.CANCELLED
                || appointment.getStatus() == AppointmentStatus.NO_SHOW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lịch hẹn đã kết thúc và không thể ghi nhận thanh toán");
        }
    }

    private String normalizeReference(String value) {
        return value.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    private String normalizeIdempotencyKey(String value) {
        if (value == null || value.isBlank() || value.length() > 100 || !value.matches("[A-Za-z0-9._:-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key không hợp lệ");
        }
        return value;
    }

    private String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private String fingerprint(String value) {
        return sha256(value).substring(0, 12);
    }

    private String transition(PaymentStatus from, PaymentStatus to) {
        return "from=" + from.name() + ";to=" + to.name();
    }

    private String qrCodeUrl(BankTransferPayment payment) {
        StringBuilder url = new StringBuilder("https://img.vietqr.io/image/")
            .append(URLEncoder.encode(bankBin, StandardCharsets.UTF_8)).append('-')
            .append(URLEncoder.encode(bankAccount, StandardCharsets.UTF_8)).append("-compact2.png?amount=")
            .append(payment.getAmount().toBigIntegerExact()).append("&addInfo=")
            .append(URLEncoder.encode(payment.getTransferContent(), StandardCharsets.UTF_8));
        if (accountHolder != null && !accountHolder.isBlank()) {
            url.append("&accountName=").append(URLEncoder.encode(accountHolder, StandardCharsets.UTF_8));
        }
        return url.toString();
    }

    private void requireConfigured() {
        if (!isAvailable()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Thanh toán chuyển khoản chưa được cấu hình");
        }
    }

    private PaymentStatus parseStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) return null;
        try {
            return PaymentStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái thanh toán không hợp lệ");
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
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thuộc tính sắp xếp thanh toán không được hỗ trợ");
            }
        });
        return PageRequest.of(page, size, sort);
    }

    private BankTransferPaymentResponse toResponse(BankTransferPayment payment) {
        Appointment appointment = payment.getAppointment();
        return new BankTransferPaymentResponse(
            payment.getId(), appointment.getId(), appointment.getBookingCode(),
            appointment.getPatient().getFullName(), appointment.getDoctor().getFullName(),
            appointment.getMedicalPackage() == null ? null : appointment.getMedicalPackage().getName(),
            appointment.getAppointmentDate(), payment.getAmount(), payment.getCurrency(), payment.getStatus(),
            bankName, bankAccount, accountHolder, qrCodeUrl(payment), payment.getTransferContent(), payment.getTransactionReference(),
            payment.getSubmittedAt(), payment.getVerifiedAt(), payment.getRejectionReason(),
            payment.getRefundReference(), payment.getRefundedAt(),
            payment.getCreatedAt(), payment.getUpdatedAt()
        );
    }

    private void notifyPatient(Appointment appointment, EventType type, String title, String message) {
        if (appointment.getPatient().getUserId() != null) {
            notificationService.create(appointment.getPatient().getUserId(), type, title, message, appointment.getId());
        }
        for (UUID userId : appointmentClaimService.claimedUserIds(appointment.getId())) {
            if (!userId.equals(appointment.getPatient().getUserId())) {
                notificationService.create(userId, type, title, message, appointment.getId());
            }
        }
    }
}
