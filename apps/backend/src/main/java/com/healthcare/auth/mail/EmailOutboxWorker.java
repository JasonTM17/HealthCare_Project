package com.healthcare.auth.mail;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Lease-based delivery worker. It never logs recipient, subject or payload. */
@Component
@ConditionalOnProperty(prefix = "app.mail.outbox", name = "enabled", havingValue = "true")
public class EmailOutboxWorker {

    private static final int MAX_ATTEMPTS = 8;
    private final EmailOutboxRepository repository;
    private final EmailPayloadCipher cipher;
    private final EmailTemplateRenderer renderer;
    private final ObjectProvider<SmtpEmailSender> smtpProvider;
    private final TransactionTemplate transactionTemplate;
    private final int retentionDays;

    /** Test-friendly constructor retaining the safe 90-day default. */
    public EmailOutboxWorker(EmailOutboxRepository repository,
                             EmailPayloadCipher cipher,
                             EmailTemplateRenderer renderer,
                             ObjectProvider<SmtpEmailSender> smtpProvider,
                             PlatformTransactionManager transactionManager) {
        this(repository, cipher, renderer, smtpProvider, transactionManager, 90);
    }

    @Autowired
    public EmailOutboxWorker(EmailOutboxRepository repository,
                             EmailPayloadCipher cipher,
                             EmailTemplateRenderer renderer,
                             ObjectProvider<SmtpEmailSender> smtpProvider,
                             PlatformTransactionManager transactionManager,
                             @Value("${app.mail.outbox.retention-days:90}") int retentionDays) {
        this.repository = repository;
        this.cipher = cipher;
        this.renderer = renderer;
        this.smtpProvider = smtpProvider;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.retentionDays = Math.max(1, Math.min(retentionDays, 3650));
    }

    @Scheduled(fixedDelayString = "${app.mail.outbox.poll-ms:5000}")
    public void deliverOne() {
        transactionTemplate.executeWithoutResult(status -> repository.expireDueAtDatabaseTime(dueStatusNames()));
        EmailOutboxClaim claim = transactionTemplate.execute(status -> claimOne());
        if (claim == null) return;
        try {
            if (claim.templateVersion() != claim.templateKey().templateVersion()) {
                throw new UnsupportedTemplateVersionException();
            }
            EmailOutboxPayload payload = cipher.decrypt(claim.payloadCiphertext(), claim.payloadNonce());
            RenderedEmail rendered = renderer.render(claim.templateKey(), payload.variables());
            // A claim can expire while decryption/rendering is in progress.
            // Re-check with database time immediately before SMTP so an
            // expired OTP is not handed to the provider.
            Boolean leaseActive = transactionTemplate.execute(status ->
                repository.isLeaseActive(claim.id(), claim.leaseToken()));
            if (!Boolean.TRUE.equals(leaseActive)) {
                transactionTemplate.executeWithoutResult(status -> markExpired(claim));
                return;
            }
            // SmtpEmailSender is the only delivery implementation reachable by
            // this worker; the outbox adapter is deliberately not recursive.
            SmtpEmailSender smtp = smtpProvider.getIfAvailable();
            if (smtp == null) throw new IllegalStateException("SMTP delivery is not configured");
            smtp.sendRichWithMessageId(payload.recipient(), rendered.subject(), rendered.htmlBody(), rendered.plainTextBody(), claim.deliveryMessageId());
            transactionTemplate.executeWithoutResult(status -> markSent(claim));
        } catch (UnsupportedTemplateVersionException exception) {
            transactionTemplate.executeWithoutResult(status -> markTerminalFailure(claim, "TEMPLATE_VERSION_UNAVAILABLE"));
        } catch (RuntimeException exception) {
            transactionTemplate.executeWithoutResult(status -> markFailure(claim));
        }
    }

    @Scheduled(fixedDelayString = "${app.mail.outbox.cleanup-ms:3600000}",
               initialDelayString = "${app.mail.outbox.cleanup-initial-delay-ms:3600000}")
    public void cleanupTerminal() {
        transactionTemplate.executeWithoutResult(status -> repository.deleteTerminalBeforeDatabaseTime(retentionDays));
    }

    private EmailOutboxClaim claimOne() {
        List<EmailOutboxEntry> due = repository.findDueForUpdateSkipLocked(dueStatusNames());
        if (due.isEmpty()) return null;
        EmailOutboxEntry entry = due.get(0);
        Instant databaseNow = repository.databaseNow();
        if (databaseNow == null) throw new IllegalStateException("Database clock unavailable");
        OffsetDateTime now = databaseNow.atOffset(ZoneOffset.UTC);
        UUID lease = UUID.randomUUID();
        entry.setStatus(EmailOutboxStatus.PROCESSING);
        entry.setLeaseToken(lease);
        entry.setLeaseExpiresAt(now.plusSeconds(120));
        entry.setAttempts(entry.getAttempts() + 1);
        entry.setUpdatedAt(now);
        repository.saveAndFlush(entry);
        return new EmailOutboxClaim(
            entry.getId(), lease, entry.getAttempts(),
            entry.getTemplateKey(), entry.getTemplateVersion(),
            entry.getDeliveryMessageId() == null ? "healthcare-outbox-" + entry.getId() : entry.getDeliveryMessageId(),
            entry.getPayloadCiphertext(), entry.getPayloadNonce()
        );
    }

    private void markSent(EmailOutboxClaim claim) {
        if (repository.markSentIfLeaseActive(claim.id(), claim.leaseToken()) == 0) {
            repository.markExpiredIfLeaseActive(claim.id(), claim.leaseToken());
        }
    }

    private void markFailure(EmailOutboxClaim claim) {
        if (repository.markExpiredIfLeaseActive(claim.id(), claim.leaseToken()) > 0) return;
        int updated = claim.attempts() >= MAX_ATTEMPTS
            ? repository.markDeadIfLeaseActive(claim.id(), claim.leaseToken(), "DELIVERY_UNAVAILABLE")
            : repository.markRetryIfLeaseActive(claim.id(), claim.leaseToken(), backoffSeconds(claim.attempts()));
        if (updated == 0) repository.markExpiredIfLeaseActive(claim.id(), claim.leaseToken());
    }

    private void markTerminalFailure(EmailOutboxClaim claim, String code) {
        if (repository.markExpiredIfLeaseActive(claim.id(), claim.leaseToken()) > 0) return;
        if (repository.markDeadIfLeaseActive(claim.id(), claim.leaseToken(), code) == 0) {
            repository.markExpiredIfLeaseActive(claim.id(), claim.leaseToken());
        }
    }

    private void markExpired(EmailOutboxClaim claim) {
        repository.markExpiredIfLeaseActive(claim.id(), claim.leaseToken());
    }

    private record EmailOutboxClaim(UUID id,
                                    UUID leaseToken,
                                    int attempts,
                                    EmailTemplateKey templateKey,
                                    int templateVersion,
                                    String deliveryMessageId,
                                    byte[] payloadCiphertext,
                                    byte[] payloadNonce) {}

    private static final class UnsupportedTemplateVersionException extends RuntimeException { }

    private static long backoffSeconds(int attempts) {
        return Math.min(3600L, 1L << Math.min(12, Math.max(0, attempts)));
    }

    private static List<EmailOutboxStatus> dueStatuses() {
        return List.of(EmailOutboxStatus.QUEUED, EmailOutboxStatus.PROCESSING, EmailOutboxStatus.RETRY);
    }

    private static List<String> dueStatusNames() {
        return dueStatuses().stream().map(Enum::name).toList();
    }
}
