package com.healthcare.payment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.demo.DashboardDemonstration;
import com.healthcare.demo.DashboardDemonstrationGuard;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.user.repository.UserRepository;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class DashboardBankEvidenceContainmentTest {
    private static final String CONTENT = "HC DEMO 0001";
    private static final String SECRET = "isolated-only-webhook-key-with-32-characters";
    private final BankTransferPaymentRepository payments = mock(BankTransferPaymentRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final BankTransferPaymentService paymentService = paymentService();

    private BankTransferPaymentService paymentService() {
        var provider = new VietQrChannelProvider();
        ReflectionTestUtils.setField(provider, "enabled", true);
        ReflectionTestUtils.setField(provider, "bankName", "Isolated Test Bank");
        ReflectionTestUtils.setField(provider, "bankAccount", "0000000000");
        ReflectionTestUtils.setField(provider, "bankBin", "000000");
        ReflectionTestUtils.setField(provider, "accountHolder", "ISOLATED TEST");
        var result = new BankTransferPaymentService(payments, mock(AppointmentRepository.class),
            mock(PatientProfileRepository.class), mock(UserRepository.class), mock(NotificationService.class),
            mock(PaymentAuditService.class), mock(AppointmentClaimService.class),
            mock(PaymentStatusEmailService.class), provider, mock(DashboardDemonstrationGuard.class));
        ReflectionTestUtils.setField(result, "configuredProvider", VietQrChannelProvider.PROVIDER_ID);
        return result;
    }

    @Test
    void ownedWebhookIsRejectedBeforeAnyEvidenceReadOrWrite() throws Exception {
        when(payments.findAppointmentIdByTransferContent(CONTENT)).thenReturn(Optional.of(DashboardDemonstration.id("appointment")));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(Object[].class))).thenReturn(false);
        var service = new BankTransferWebhookService(paymentService, jdbc, new ObjectMapper(), mock(Validator.class), transactions);
        ReflectionTestUtils.setField(service, "webhookSecret", SECRET);
        var timestamp = Long.toString(Instant.now().getEpochSecond());
        var body = "{\"transferContent\":\"" + CONTENT + "\",\"amount\":200000,\"transactionReference\":\"DEMO-EVIDENCE-0001\"}";
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        var signature = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + body).getBytes(StandardCharsets.UTF_8)));
        assertThatThrownBy(() -> service.process("demo-evidence-0001", timestamp, signature, body))
            .isInstanceOfSatisfying(ResponseStatusException.class, error -> org.assertj.core.api.Assertions.assertThat(error.getStatusCode().value()).isEqualTo(409));
        verifyNoInteractions(jdbc, transactions);
    }

    @Test
    void mixedStatementIsRejectedBeforeHeaderOrOrdinarySiblingConfirmation() {
        when(payments.findAppointmentIdByTransferContent(CONTENT)).thenReturn(Optional.of(DashboardDemonstration.id("appointment")));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        var service = new BankStatementImportService(paymentService, jdbc, transactions);
        assertThatThrownBy(() -> service.importStatement("demo.csv", "200000;HC ORDINARY 0001;CONTROL-1\n200000;" + CONTENT + ";DEMO-1\n", new User("isolated@example.test", "unused", List.of())))
            .isInstanceOfSatisfying(ResponseStatusException.class, error -> org.assertj.core.api.Assertions.assertThat(error.getStatusCode().value()).isEqualTo(409));
        verifyNoInteractions(jdbc, transactions);
        verify(payments, never()).findByAppointmentIdForUpdate(any());
    }
}
