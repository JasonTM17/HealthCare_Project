package com.healthcare.payment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.entity.PaymentInvoice;
import com.healthcare.payment.entity.PaymentStatus;
import com.healthcare.payment.repository.PaymentInvoiceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Issues immutable payment receipts (biên nhận) as PDFs. The invoice row is
 * the single issuance record: repeated downloads replay the same row, a
 * receipt only ever exists for a verified payment (PAID or later), and the
 * stored snapshot keeps an issued document stable even if the appointment is
 * edited afterwards.
 */
@Service
public class PaymentInvoiceService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final BankTransferPaymentService paymentService;
    private final PaymentInvoiceRepository invoiceRepository;
    private final PaymentReceiptPdfRenderer renderer;
    private final JdbcTemplate jdbcTemplate;

    public PaymentInvoiceService(BankTransferPaymentService paymentService,
            PaymentInvoiceRepository invoiceRepository, PaymentReceiptPdfRenderer renderer,
            JdbcTemplate jdbcTemplate) {
        this.paymentService = paymentService;
        this.invoiceRepository = invoiceRepository;
        this.renderer = renderer;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public byte[] receiptForPatient(UUID appointmentId, UserDetails principal) {
        return receiptFor(paymentService.loadOwnedPaymentForUpdate(appointmentId, principal), actorOf(principal));
    }

    @Transactional
    public byte[] receiptForAdmin(UUID paymentId, UserDetails principal) {
        return receiptFor(paymentService.loadPaymentForUpdate(paymentId), actorOf(principal));
    }

    private byte[] receiptFor(BankTransferPayment payment, String actor) {
        PaymentInvoice invoice = invoiceRepository.findByPaymentId(payment.getId())
            .orElseGet(() -> issue(payment, actor));
        return renderer.render(invoice, payment.getTransferContent(), payment.getTransactionReference(),
            payment.getVerifiedAt(), statusSnapshot(payment.getStatus()));
    }

    private PaymentInvoice issue(BankTransferPayment payment, String actor) {
        if (payment.getStatus() != PaymentStatus.PAID
                && payment.getStatus() != PaymentStatus.REFUND_PENDING
                && payment.getStatus() != PaymentStatus.REFUNDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Chỉ cấp biên nhận cho thanh toán đã được xác nhận đối soát");
        }
        Appointment appointment = payment.getAppointment();
        PaymentInvoice invoice = new PaymentInvoice();
        invoice.setPaymentId(payment.getId());
        invoice.setInvoiceNumber(nextInvoiceNumber());
        invoice.setIssuedAt(OffsetDateTime.now(BUSINESS_ZONE));
        invoice.setIssuedBy(actor);
        invoice.setAmount(payment.getAmount());
        invoice.setCurrency(payment.getCurrency());
        invoice.setPatientName(appointment.getPatient().getFullName());
        invoice.setDoctorName(appointment.getDoctor().getFullName());
        invoice.setBookingCode(appointment.getBookingCode());
        return invoiceRepository.saveAndFlush(invoice);
    }

    /** Gap-free numbering is not a goal; uniqueness under retries is (unique index). */
    private String nextInvoiceNumber() {
        Long value = jdbcTemplate.queryForObject("select nextval('payment_invoice_number_seq')", Long.class);
        return "HD-%d-%06d".formatted(LocalDate.now(BUSINESS_ZONE).getYear(), value);
    }

    private PaymentReceiptPdfRenderer.PaymentStatusSnapshot statusSnapshot(PaymentStatus status) {
        if (status == PaymentStatus.REFUNDED) {
            return PaymentReceiptPdfRenderer.PaymentStatusSnapshot.REFUNDED;
        }
        if (status == PaymentStatus.REFUND_PENDING) {
            return PaymentReceiptPdfRenderer.PaymentStatusSnapshot.REFUND_PENDING;
        }
        return PaymentReceiptPdfRenderer.PaymentStatusSnapshot.PAID;
    }

    private String actorOf(UserDetails principal) {
        return principal == null ? null : principal.getUsername();
    }
}
