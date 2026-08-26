package com.healthcare.auth.mail;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailOutboxWorkerTest {

    @Test
    void decryptsVariablesThenRendersOnlyAtDeliveryTime() {
        Fixture fixture = fixture(EmailTemplateKey.BOOKING_OTP.templateVersion());
        EmailOutboxPayload payload = new EmailOutboxPayload(
            "patient@example.test", Map.of("code", "123456", "minutes", "5"));
        RenderedEmail rendered = new RenderedEmail(
            "[HealthCare] Xác nhận đặt lịch", "preheader", "plain", "<html>safe</html>", 1);
        when(fixture.cipher.decrypt(fixture.entry.getPayloadCiphertext(), fixture.entry.getPayloadNonce()))
            .thenReturn(payload);
        when(fixture.renderer.render(EmailTemplateKey.BOOKING_OTP, payload.variables()))
            .thenReturn(rendered);

        fixture.worker.deliverOne();

        verify(fixture.renderer).render(EmailTemplateKey.BOOKING_OTP, payload.variables());
        org.mockito.Mockito.verify(fixture.smtp).sendRichWithMessageId(
            org.mockito.ArgumentMatchers.eq(payload.recipient()), org.mockito.ArgumentMatchers.eq(rendered.subject()),
            org.mockito.ArgumentMatchers.eq(rendered.htmlBody()), org.mockito.ArgumentMatchers.eq(rendered.plainTextBody()),
            org.mockito.ArgumentMatchers.anyString());
        assertThat(fixture.entry.getStatus()).isEqualTo(EmailOutboxStatus.SENT);
        assertThat(fixture.entry.getPayloadCiphertext()).isNull();
        assertThat(fixture.entry.getPayloadNonce()).isNull();
    }

    @Test
    void unsupportedTemplateVersionIsDeadLetteredWithoutDecryptingOrSending() {
        Fixture fixture = fixture(99);

        fixture.worker.deliverOne();

        verify(fixture.cipher, never()).decrypt(any(), any());
        verify(fixture.renderer, never()).render(any(), any());
        verify(fixture.smtp, never()).sendRich(any(), any(), any(), any());
        assertThat(fixture.entry.getStatus()).isEqualTo(EmailOutboxStatus.DEAD);
        assertThat(fixture.entry.getLastErrorCode()).isEqualTo("TEMPLATE_VERSION_UNAVAILABLE");
        assertThat(fixture.entry.getPayloadCiphertext()).isNull();
        assertThat(fixture.entry.getPayloadNonce()).isNull();
    }

    @Test
    void expiredAfterRenderIsMarkedExpiredWithoutCallingSmtp() {
        Fixture fixture = fixture(EmailTemplateKey.BOOKING_OTP.templateVersion());
        EmailOutboxPayload payload = new EmailOutboxPayload(
            "patient@example.test", Map.of("code", "123456", "minutes", "5"));
        when(fixture.cipher.decrypt(fixture.entry.getPayloadCiphertext(), fixture.entry.getPayloadNonce()))
            .thenReturn(payload);
        when(fixture.renderer.render(EmailTemplateKey.BOOKING_OTP, payload.variables()))
            .thenReturn(new RenderedEmail("subject", "preheader", "plain", "<html/>", 1));
        when(fixture.repository.isLeaseActive(isNull(), any())).thenReturn(false);
        when(fixture.repository.markExpiredIfLeaseActive(isNull(), any())).thenAnswer(invocation -> {
            fixture.entry.setStatus(EmailOutboxStatus.EXPIRED);
            return 1;
        });

        fixture.worker.deliverOne();

        verify(fixture.smtp, never()).sendRichWithMessageId(any(), any(), any(), any(), any());
        assertThat(fixture.entry.getStatus()).isEqualTo(EmailOutboxStatus.EXPIRED);
    }

    @Test
    void cleanupDeletesOnlyTerminalRowsBeyondConfiguredRetentionUsingDatabaseTime() {
        Fixture fixture = fixture(EmailTemplateKey.BOOKING_OTP.templateVersion());

        fixture.worker.cleanupTerminal();

        verify(fixture.repository).deleteTerminalBeforeDatabaseTime(90);
    }

    private Fixture fixture(int templateVersion) {
        EmailOutboxRepository repository = mock(EmailOutboxRepository.class);
        EmailPayloadCipher cipher = mock(EmailPayloadCipher.class);
        EmailTemplateRenderer renderer = mock(EmailTemplateRenderer.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<SmtpEmailSender> provider = mock(ObjectProvider.class);
        SmtpEmailSender smtp = mock(SmtpEmailSender.class);
        EmailOutboxEntry entry = new EmailOutboxEntry();
        entry.setTemplateKey(EmailTemplateKey.BOOKING_OTP);
        entry.setTemplateVersion(templateVersion);
        entry.setStatus(EmailOutboxStatus.QUEUED);
        entry.setPayloadCiphertext(new byte[] {1, 2});
        entry.setPayloadNonce(new byte[] {3, 4});

        when(repository.findDueForUpdateSkipLocked(any())).thenReturn(List.of(entry));
        when(repository.databaseNow()).thenReturn(java.time.Instant.now());
        when(repository.saveAndFlush(entry)).thenReturn(entry);
        when(repository.isLeaseActive(isNull(), any())).thenReturn(true);
        when(repository.markExpiredIfLeaseActive(isNull(), any())).thenReturn(0);
        when(repository.markSentIfLeaseActive(isNull(), any())).thenAnswer(invocation -> {
            entry.setStatus(EmailOutboxStatus.SENT);
            entry.setPayloadCiphertext(null);
            entry.setPayloadNonce(null);
            return 1;
        });
        when(repository.markDeadIfLeaseActive(isNull(), any(), any())).thenAnswer(invocation -> {
            entry.setStatus(EmailOutboxStatus.DEAD);
            entry.setLastErrorCode(invocation.getArgument(2));
            entry.setPayloadCiphertext(null);
            entry.setPayloadNonce(null);
            return 1;
        });
        when(provider.getIfAvailable()).thenReturn(smtp);

        EmailOutboxWorker worker = new EmailOutboxWorker(
            repository, cipher, renderer, provider, immediateTransactions());
        return new Fixture(worker, repository, cipher, renderer, smtp, entry);
    }

    private PlatformTransactionManager immediateTransactions() {
        return new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) { }

            @Override
            public void rollback(TransactionStatus status) { }
        };
    }

    private record Fixture(EmailOutboxWorker worker,
                           EmailOutboxRepository repository,
                           EmailPayloadCipher cipher,
                           EmailTemplateRenderer renderer,
                           SmtpEmailSender smtp,
                           EmailOutboxEntry entry) { }
}
