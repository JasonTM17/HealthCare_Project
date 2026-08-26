package com.healthcare.payment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.auth.mail.EmailTemplateKey;
import com.healthcare.payment.entity.BankTransferPayment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Locale;

/** Sends transactional payment notices without including financial references or clinical data. */
@Service
public class PaymentStatusEmailService {

    private final AfterCommitEmailSender emailSender;
    private final boolean enabled;

    public PaymentStatusEmailService(
            AfterCommitEmailSender emailSender,
            @Value("${app.payment.bank-transfer.status-email-enabled:true}") boolean enabled) {
        this.emailSender = emailSender;
        this.enabled = enabled;
    }

    public void paymentConfirmed(BankTransferPayment payment) {
        send(
            payment,
            "Thanh toán cho lịch hẹn %s đã được xác nhận."
                .formatted(payment.getAppointment().getBookingCode())
        );
    }

    public void paymentRejected(BankTransferPayment payment) {
        send(
            payment,
            "Thanh toán cho lịch hẹn %s chưa được xác nhận. Vui lòng đăng nhập cổng bệnh nhân để xem hướng dẫn."
                .formatted(payment.getAppointment().getBookingCode())
        );
    }

    public void paymentRefunded(BankTransferPayment payment) {
        send(
            payment,
            "Khoản thanh toán cho lịch hẹn %s đã được ghi nhận là hoàn tiền."
                .formatted(payment.getAppointment().getBookingCode())
        );
    }

    private void send(BankTransferPayment payment, String statusLine) {
        if (!enabled || !emailSender.isDeliveryAvailable()) return;
        Appointment appointment = payment.getAppointment();
        String recipient = appointment.getPatient().getEmail();
        if (recipient == null || recipient.isBlank()) return;

        emailSender.sendTemplate(
            EmailTemplateKey.PAYMENT_STATUS,
            recipient.trim().toLowerCase(Locale.ROOT),
            java.util.Map.of("message", statusLine)
        );
    }
}
