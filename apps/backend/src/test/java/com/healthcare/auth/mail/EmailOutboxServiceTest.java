package com.healthcare.auth.mail;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.mockito.ArgumentCaptor;
import com.healthcare.notification.entity.NotificationCategory;
import com.healthcare.notification.entity.NotificationChannel;
import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.entity.NotificationPreferenceId;
import com.healthcare.notification.repository.NotificationPreferenceRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailOutboxServiceTest {

    @Test
    void idempotencyReturnsExistingRowWithoutReencrypting() {
        EmailOutboxRepository repository = mock(EmailOutboxRepository.class);
        EmailPayloadCipher cipher = mock(EmailPayloadCipher.class);
        EmailOutboxEntry existing = new EmailOutboxEntry();
        existing.setTemplateKey(EmailTemplateKey.BOOKING_OTP);
        existing.setTemplateVersion(EmailTemplateKey.BOOKING_OTP.templateVersion());
        existing.setPayloadDigest("digest");
        existing.setEventType("BOOKING_OTP");
        when(repository.findByIdempotencyKey("same-key")).thenReturn(Optional.of(existing));
        when(cipher.isConfigured()).thenReturn(true);
        when(cipher.digest(any(EmailOutboxPayload.class))).thenReturn("digest");

        EmailOutboxEntry result = new EmailOutboxService(repository, cipher).enqueue(
            EmailTemplateKey.BOOKING_OTP, "patient@example.test", Map.of("code", "123456", "minutes", "5"), "same-key",
            null, null, "BOOKING_OTP", 900);

        assertSame(existing, result);
        org.mockito.Mockito.verify(cipher, org.mockito.Mockito.never()).encrypt(any(EmailOutboxPayload.class));
    }

    @Test
    void newEnvelopeUsesAtomicInsertThenReturnsTheDatabaseWinner() {
        EmailOutboxRepository repository = mock(EmailOutboxRepository.class);
        EmailPayloadCipher cipher = mock(EmailPayloadCipher.class);
        EmailOutboxEntry winner = new EmailOutboxEntry();
        winner.setTemplateKey(EmailTemplateKey.BOOKING_OTP);
        winner.setTemplateVersion(EmailTemplateKey.BOOKING_OTP.templateVersion());
        winner.setPayloadDigest("digest");
        winner.setEventType("BOOKING_OTP");
        when(repository.findByIdempotencyKey("same-key"))
            .thenReturn(Optional.empty(), Optional.of(winner));
        when(cipher.isConfigured()).thenReturn(true);
        when(cipher.digest(any(EmailOutboxPayload.class))).thenReturn("digest");
        when(cipher.encrypt(any(EmailOutboxPayload.class)))
            .thenReturn(new EmailPayloadCipher.EncryptedPayload(new byte[] {1}, new byte[] {2}));
        EmailOutboxEntry result = new EmailOutboxService(repository, cipher).enqueue(
            EmailTemplateKey.BOOKING_OTP, "Patient@Example.Test", Map.of("code", "123456"), "same-key",
            null, null, "BOOKING_OTP", 900);

        assertSame(winner, result);
        verify(repository).insertQueuedIfAbsent(
            any(UUID.class), isNull(), isNull(), eq("BOOKING_OTP"), eq("BOOKING_OTP"),
            eq(1), eq("same-key"), any(byte[].class), any(byte[].class),
            eq("digest"), any(String.class),
            any(OffsetDateTime.class), any(OffsetDateTime.class),
            any(OffsetDateTime.class), any(OffsetDateTime.class));
        ArgumentCaptor<EmailOutboxPayload> payload = ArgumentCaptor.forClass(EmailOutboxPayload.class);
        verify(cipher).encrypt(payload.capture());
        assertEquals("patient@example.test", payload.getValue().recipient());
        assertEquals(Map.of("code", "123456"), payload.getValue().variables());
    }

    @Test
    void idempotencyKeyCannotBeReusedForAnotherEvent() {
        EmailOutboxRepository repository = mock(EmailOutboxRepository.class);
        EmailPayloadCipher cipher = mock(EmailPayloadCipher.class);
        EmailOutboxEntry existing = new EmailOutboxEntry();
        existing.setTemplateKey(EmailTemplateKey.PASSWORD_RESET);
        existing.setTemplateVersion(EmailTemplateKey.PASSWORD_RESET.templateVersion());
        existing.setEventType("PASSWORD_RESET");
        existing.setPayloadDigest("digest");
        when(repository.findByIdempotencyKey("same-key")).thenReturn(Optional.of(existing));
        when(cipher.isConfigured()).thenReturn(true);
        when(cipher.digest(any(EmailOutboxPayload.class))).thenReturn("digest");

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () ->
            new EmailOutboxService(repository, cipher).enqueue(
                EmailTemplateKey.BOOKING_OTP, "patient@example.test", Map.of(), "same-key",
                null, null, "BOOKING_OTP", 900));
    }

    @Test
    void idempotencyKeyCannotReplayDifferentEncryptedVariables() {
        EmailOutboxRepository repository = mock(EmailOutboxRepository.class);
        EmailPayloadCipher cipher = mock(EmailPayloadCipher.class);
        EmailOutboxEntry existing = new EmailOutboxEntry();
        existing.setTemplateKey(EmailTemplateKey.BOOKING_OTP);
        existing.setTemplateVersion(EmailTemplateKey.BOOKING_OTP.templateVersion());
        existing.setEventType("BOOKING_OTP");
        existing.setPayloadDigest("old-digest");
        when(repository.findByIdempotencyKey("same-key")).thenReturn(Optional.of(existing));
        when(cipher.isConfigured()).thenReturn(true);
        when(cipher.digest(any(EmailOutboxPayload.class))).thenReturn("new-digest");

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () ->
            new EmailOutboxService(repository, cipher).enqueue(
                EmailTemplateKey.BOOKING_OTP, "patient@example.test",
                Map.of("code", "999999", "minutes", "5"), "same-key", null, null, "BOOKING_OTP", 900));
    }

    @Test
    void legacyTerminalRowWithoutPayloadDigestFailsClosed() {
        EmailOutboxRepository repository = mock(EmailOutboxRepository.class);
        EmailPayloadCipher cipher = mock(EmailPayloadCipher.class);
        EmailOutboxEntry existing = new EmailOutboxEntry();
        existing.setTemplateKey(EmailTemplateKey.BOOKING_OTP);
        existing.setTemplateVersion(EmailTemplateKey.BOOKING_OTP.templateVersion());
        existing.setEventType("BOOKING_OTP");
        existing.setStatus(EmailOutboxStatus.SENT);
        existing.setPayloadDigest(null);
        when(repository.findByIdempotencyKey("legacy-key")).thenReturn(Optional.of(existing));
        when(cipher.isConfigured()).thenReturn(true);
        when(cipher.digest(any(EmailOutboxPayload.class))).thenReturn("new-digest");

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () ->
            new EmailOutboxService(repository, cipher).enqueue(
                EmailTemplateKey.BOOKING_OTP, "patient@example.test",
                Map.of("code", "123456", "minutes", "5"), "legacy-key", null, null,
                "BOOKING_OTP", 900));
        org.mockito.Mockito.verify(cipher, org.mockito.Mockito.never()).encrypt(any(EmailOutboxPayload.class));
    }

    @Test
    void digestIsStableForCompatibilityIdempotency() {
        assertEquals(64, EmailOutboxService.digest("recipient\nsubject\nbody").length());
        assertEquals(EmailOutboxService.digest("x"), EmailOutboxService.digest("x"));
    }

    @Test
    void optionalCarePlanMailRespectsEmailPreference() {
        EmailOutboxRepository repository = mock(EmailOutboxRepository.class);
        EmailPayloadCipher cipher = mock(EmailPayloadCipher.class);
        NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
        UUID userId = UUID.randomUUID();
        NotificationPreference preference = new NotificationPreference();
        preference.setId(new NotificationPreferenceId(userId, NotificationCategory.CARE_PLAN, NotificationChannel.EMAIL));
        preference.setEnabled(false);
        when(preferences.findById(preference.getId())).thenReturn(Optional.of(preference));

        org.junit.jupiter.api.Assertions.assertThrows(EmailDeliverySuppressedException.class, () ->
            new EmailOutboxService(repository, cipher, preferences).enqueue(
                EmailTemplateKey.CARE_PLAN_REMINDER, "patient@example.test", Map.of("message", "Nhắc việc"),
                "care-plan-key", userId, UUID.randomUUID(), "CARE_PLAN", 900));
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.never()).insertQueuedIfAbsent(
            any(UUID.class), isNull(), isNull(), any(String.class), any(String.class), org.mockito.ArgumentMatchers.anyInt(),
            any(String.class), any(byte[].class), any(byte[].class), any(String.class), any(String.class),
            any(OffsetDateTime.class), any(OffsetDateTime.class), any(OffsetDateTime.class), any(OffsetDateTime.class));
    }
}
