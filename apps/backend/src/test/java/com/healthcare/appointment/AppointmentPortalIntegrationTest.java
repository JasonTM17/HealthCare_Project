package com.healthcare.appointment;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.payment.service.BankTransferPaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.HexFormat;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Transactional
class AppointmentPortalIntegrationTest extends AbstractIntegrationTest {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final LocalDate PORTAL_DATE = LocalDate.of(2030, 1, 15);

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;
    @Autowired private BankTransferPaymentService paymentService;
    @Autowired private com.healthcare.payment.service.BankTransferWebhookService webhookService;
    @Autowired private BankTransferPaymentRepository paymentRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private org.springframework.transaction.PlatformTransactionManager transactionManager;

    @Test
    void bookingOtpClaimsAppointmentForVerifiedAccountWithMatchingEmail() throws Exception {
        User patientUser = createUser("PATIENT", "claim.patient." + UUID.randomUUID() + "@example.com");
        User otherUser = createUser("PATIENT", "claim.other." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "claim.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile bookingPatient = new PatientProfile();
        bookingPatient.setFullName("Public booking patient");
        bookingPatient.setPhone("096" + randomDigits());
        bookingPatient.setEmail(patientUser.getEmail());
        bookingPatient = patientProfileRepository.saveAndFlush(bookingPatient);
        Doctor doctor = createDoctor(doctorUser, "claim-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("claim-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            bookingPatient, doctor, branch, PORTAL_DATE, LocalTime.of(13, 30), AppointmentStatus.PENDING_CONFIRMATION);
        appointment.setOtpCode(passwordEncoder.encode("123456"));
        appointment.setHoldExpiresAt(OffsetDateTime.now().plusMinutes(10));
        appointment.setOtpExpiresAt(OffsetDateTime.now().plusMinutes(5));
        appointmentRepository.saveAndFlush(appointment);
        paymentService.initialize(appointment);

        mockMvc.perform(post("/api/v1/appointments/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bookingCode\":\"" + appointment.getBookingCode() + "\",\"otpCode\":\"123456\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(appointment.getId().toString()))
            .andExpect(jsonPath("$.status").value("CONFIRMED"));

        mockMvc.perform(get("/api/v1/patient/appointments")
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].id").value(appointment.getId().toString()));

        mockMvc.perform(get("/api/v1/patient/appointments/" + appointment.getId() + "/payment")
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.appointmentId").value(appointment.getId().toString()));

        mockMvc.perform(get("/api/v1/patient/appointments/" + appointment.getId() + "/payment")
                .header("Authorization", bearer(otherUser)))
            .andExpect(status().isForbidden());
    }

    @Test
    void signedPaymentWebhookRejectsForgeryAndIsReplaySafe() throws Exception {
        User patientUser = createUser("PATIENT", "webhook.patient." + UUID.randomUUID() + "@example.com");
        User adminUser = createUser("ADMIN", "webhook.admin." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "webhook.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "097" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "webhook-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("webhook-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(11, 30), AppointmentStatus.CONFIRMED);
        BankTransferPayment payment = paymentService.initialize(appointment);
        String payload = "{\"transferContent\":\"" + payment.getTransferContent()
            + "\",\"amount\":" + payment.getAmount().toPlainString()
            + ",\"transactionReference\":\"FT-WEBHOOK-123456\"}";
        String timestamp = Long.toString(Instant.now().getEpochSecond());

        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "evt-forged")
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", "invalid")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isUnauthorized());

        String signature = webhookSignature(timestamp, payload);
        for (String invalidTimestamp : java.util.List.of(
                Long.toString(Instant.now().minusSeconds(3600).getEpochSecond()),
                Long.toString(Instant.now().plusSeconds(3600).getEpochSecond()),
                "not-a-timestamp")) {
            mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                    .header("X-Webhook-Id", "evt-outside-tolerance")
                    .header("X-Webhook-Timestamp", invalidTimestamp)
                    .header("X-Webhook-Signature", webhookSignature(invalidTimestamp, payload))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
                .andExpect(status().isUnauthorized());
        }

        String wrongAmountPayload = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(java.util.Map.of(
            "transferContent", payment.getTransferContent(),
            "amount", payment.getAmount().add(java.math.BigDecimal.ONE),
            "transactionReference", "FT-WEBHOOK-WRONG-AMOUNT"));
        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "evt-wrong-amount")
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", webhookSignature(timestamp, wrongAmountPayload))
                .contentType(MediaType.APPLICATION_JSON)
                .content(wrongAmountPayload))
            .andExpect(status().isConflict());

        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "../invalid-event")
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", signature)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "evt-oversized")
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", signature)
                .contentType(MediaType.APPLICATION_JSON)
                .content("x".repeat(4097)))
            .andExpect(status().isBadRequest());

        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                    .header("X-Webhook-Id", "evt-valid-replayed")
                    .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", signature)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION"))
                .andExpect(jsonPath("$.transactionReference").value("FT-WEBHOOK-123456"));
        }

        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "evt-valid-replayed")
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", webhookSignature(timestamp, wrongAmountPayload))
                .contentType(MediaType.APPLICATION_JSON)
                .content(wrongAmountPayload))
            .andExpect(status().isConflict());

        // The webhook only enters the review queue. An ADMIN decision is the
        // sole transition that can make the appointment/payment PAID.
        Integer auditBeforeDeniedReviews = jdbcTemplate.queryForObject(
            "select count(*) from payment_audit_logs where payment_id = ?", Integer.class, payment.getId());
        for (User nonAdmin : java.util.List.of(patientUser, doctorUser)) {
            mockMvc.perform(get("/api/v1/admin/payments").header("Authorization", bearer(nonAdmin)))
                .andExpect(status().isForbidden());
            mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId() + "/refund")
                    .header("Authorization", bearer(nonAdmin)).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"refundReference\":\"DENIED-REFUND\"}"))
                .andExpect(status().isForbidden());
            for (String decision : java.util.List.of("VERIFY", "REJECT")) {
                mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId())
                        .header("Authorization", bearer(nonAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\",\"reason\":\"Unauthorized review\"}"))
                    .andExpect(status().isForbidden());
            }
        }
        mockMvc.perform(get("/api/v1/admin/payments")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"VERIFY\"}"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId() + "/refund")
                .contentType(MediaType.APPLICATION_JSON).content("{\"refundReference\":\"DENIED-REFUND\"}"))
            .andExpect(status().isUnauthorized());
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select count(*) from payment_audit_logs where payment_id = ?", Integer.class, payment.getId()))
            .isEqualTo(auditBeforeDeniedReviews);
        org.assertj.core.api.Assertions.assertThat(paymentService.getByTransferContent(payment.getTransferContent()).status())
            .isEqualTo(com.healthcare.payment.entity.PaymentStatus.PENDING_VERIFICATION);
        mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId())
                .header("Authorization", bearer(adminUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"VERIFY\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PAID"));
    }

    @Test
    void pendingPaymentRejectsASecondWebhookReferenceBeforeAdminReview() throws Exception {
        User patientUser = createUser("PATIENT", "webhook-conflict.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "webhook-conflict.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "096" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "webhook-conflict-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("webhook-conflict-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(12, 0), AppointmentStatus.CONFIRMED);
        BankTransferPayment payment = paymentService.initialize(appointment);

        String firstPayload = webhookPayload(payment, "FT-WEBHOOK-FIRST-123");
        String firstTimestamp = Long.toString(Instant.now().getEpochSecond());
        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "evt-first-reference")
                .header("X-Webhook-Timestamp", firstTimestamp)
                .header("X-Webhook-Signature", webhookSignature(firstTimestamp, firstPayload))
                .contentType(MediaType.APPLICATION_JSON)
                .content(firstPayload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION"));

        String conflictingPayload = webhookPayload(payment, "FT-WEBHOOK-SECOND-456");
        String conflictingTimestamp = Long.toString(Instant.now().getEpochSecond());
        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "evt-second-reference")
                .header("X-Webhook-Timestamp", conflictingTimestamp)
                .header("X-Webhook-Signature", webhookSignature(conflictingTimestamp, conflictingPayload))
                .contentType(MediaType.APPLICATION_JSON)
                .content(conflictingPayload))
            .andExpect(status().isConflict());

        org.assertj.core.api.Assertions.assertThat(paymentRepository.findByAppointmentId(appointment.getId()))
            .get()
            .extracting(BankTransferPayment::getTransactionReference)
            .isEqualTo("FT-WEBHOOK-FIRST-123");
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void unmatchedWebhookEvidenceIsReMatchedOnceThePaymentIsInitialized(boolean retryWorker) throws Exception {
        String eventId = "evt-late-" + retryWorker;
        // A bank notification that arrives before the patient ever opened the
        // payment panel must survive as unprocessed evidence, then re-match on
        // redelivery instead of being answered with a read-only payment copy.
        User patientUser = createUser("PATIENT", "webhook-late.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "webhook-late.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "094" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "webhook-late-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("webhook-late-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(14, 0), AppointmentStatus.CONFIRMED);

        // initialize() derives the content deterministically from the booking
        // code, so the bank payload can be crafted before the row exists.
        String transferContent = "HC " + appointment.getBookingCode().replace("APT-", "");
        org.springframework.test.context.transaction.TestTransaction.flagForCommit();
        org.springframework.test.context.transaction.TestTransaction.end();
        String payload = "{\"transferContent\":\"" + transferContent
            + "\",\"amount\":200000"
            + ",\"transactionReference\":\"FT-LATE-WEBHOOK-001\"}";
        String timestamp = Long.toString(Instant.now().getEpochSecond());

        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", eventId)
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", webhookSignature(timestamp, payload))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isNotFound());
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select count(*) from payment_webhook_events where event_id = ? and payment_id is null",
            Integer.class, eventId)).isEqualTo(1);
        java.util.Map<String, Object> recovery = jdbcTemplate.queryForMap(
            "select transfer_content, amount, transaction_reference, retry_attempts, next_retry_at "
                + "from payment_webhook_events where event_id = ?", eventId);
        org.assertj.core.api.Assertions.assertThat(recovery)
            .containsEntry("transfer_content", transferContent)
            .containsEntry("transaction_reference", "FT-LATE-WEBHOOK-001")
            .containsEntry("retry_attempts", 0);
        org.assertj.core.api.Assertions.assertThat((java.math.BigDecimal) recovery.get("amount"))
            .isEqualByComparingTo("200000");
        org.assertj.core.api.Assertions.assertThat(recovery.get("next_retry_at")).isNotNull();

        paymentService.initialize(appointment);
        if (retryWorker) {
            webhookService.retryPendingEvents();
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select count(*) from payment_webhook_events where event_id = ? "
                    + "and processed_at is not null and retry_attempts = 1", Integer.class, eventId)).isEqualTo(1);
        }

        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", eventId)
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", webhookSignature(timestamp, payload))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION"))
            .andExpect(jsonPath("$.transactionReference").value("FT-LATE-WEBHOOK-001"));
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select count(*) from payment_webhook_events where event_id = ? and processed_at is not null",
            Integer.class, eventId)).isEqualTo(1);
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void webhookRetrySkipsLockedEvidenceAndClaimsItAfterRelease() throws Exception {
        String eventId = "locked-" + UUID.randomUUID();
        jdbcTemplate.update("""
            insert into payment_webhook_events
                (event_id, payload_hash, transfer_content, amount, transaction_reference)
            values (?, ?, ?, 200000, ?)
            """, eventId, "c".repeat(64), "missing-" + eventId, eventId);
        var executor = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            new org.springframework.transaction.support.TransactionTemplate(transactionManager)
                .executeWithoutResult(transaction -> {
                    jdbcTemplate.queryForObject(
                        "select event_id from payment_webhook_events where event_id = ? for update",
                        String.class, eventId);
                    var attempt = executor.submit(() -> webhookService.retryPendingEvents());
                    try {
                        attempt.get(10, java.util.concurrent.TimeUnit.SECONDS);
                    } catch (Exception exception) {
                        attempt.cancel(true);
                        throw new AssertionError("Retry worker blocked on an owned evidence row", exception);
                    }
                    org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                        "select retry_attempts from payment_webhook_events where event_id = ?",
                        Integer.class, eventId)).isZero();
                });
            webhookService.retryPendingEvents();
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select retry_attempts from payment_webhook_events where event_id = ?",
                Integer.class, eventId)).isEqualTo(1);
        } finally {
            executor.shutdownNow();
            org.assertj.core.api.Assertions.assertThat(executor.awaitTermination(
                10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        }
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void staleWorkerClaimPreservesCommittedAdminRejection(boolean workerLocksFirst) throws Exception {
        User patientUser = createUser("PATIENT", "stale.patient." + UUID.randomUUID() + "@example.com");
        User adminUser = createUser("ADMIN", "stale.admin." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "stale.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "094" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "stale-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("stale-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(14, 30), AppointmentStatus.CONFIRMED);
        BankTransferPayment payment = paymentService.initialize(appointment);
        String adminToken = bearer(adminUser);
        org.springframework.test.context.transaction.TestTransaction.flagForCommit();
        org.springframework.test.context.transaction.TestTransaction.end();

        String eventId = "stale-" + UUID.randomUUID();
        String payload = webhookPayload(payment, "FT-STALE-CLAIM");
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        // Persist valid evidence without processing it, representing a bank-first delivery.
        String payloadHash = HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
            .digest(payload.getBytes(StandardCharsets.UTF_8)));
        jdbcTemplate.update("""
            insert into payment_webhook_events
                (event_id, payload_hash, transfer_content, amount, transaction_reference)
            values (?, ?, ?, ?, ?)
            """, eventId, payloadHash, payment.getTransferContent(), payment.getAmount(), "FT-STALE-CLAIM");
        var claimCommitted = new java.util.concurrent.CountDownLatch(1);
        var resumeWorker = new java.util.concurrent.CountDownLatch(1);
        JdbcTemplate workerJdbc = org.mockito.Mockito.spy(jdbcTemplate);
        org.mockito.Mockito.doAnswer(invocation -> {
            Object lockedResult = workerLocksFirst ? invocation.callRealMethod() : null;
            claimCommitted.countDown();
            if (!resumeWorker.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new AssertionError("Worker was not released after admin review");
            }
            return workerLocksFirst ? lockedResult : invocation.callRealMethod();
        }).when(workerJdbc).queryForObject(
            org.mockito.ArgumentMatchers.eq("select processed_at is not null from payment_webhook_events where event_id = ? for update"),
            org.mockito.ArgumentMatchers.eq(Boolean.class), org.mockito.ArgumentMatchers.eq(eventId));
        var worker = new com.healthcare.payment.service.BankTransferWebhookService(paymentService, workerJdbc,
            (com.fasterxml.jackson.databind.ObjectMapper) org.springframework.test.util.ReflectionTestUtils.getField(webhookService, "objectMapper"),
            (jakarta.validation.Validator) org.springframework.test.util.ReflectionTestUtils.getField(webhookService, "validator"),
            transactionManager);
        org.springframework.test.util.ReflectionTestUtils.setField(worker, "webhookSecret",
            org.springframework.test.util.ReflectionTestUtils.getField(webhookService, "webhookSecret"));
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var attempt = executor.submit(worker::retryPendingEvents);
            org.assertj.core.api.Assertions.assertThat(claimCommitted.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select retry_attempts from payment_webhook_events where event_id = ?", Integer.class, eventId)).isEqualTo(1);
            if (workerLocksFirst) {
                var bankLockAttempted = new java.util.concurrent.CountDownLatch(1);
                JdbcTemplate bankJdbc = org.mockito.Mockito.spy(jdbcTemplate);
                org.mockito.Mockito.doAnswer(invocation -> {
                    bankLockAttempted.countDown();
                    return invocation.callRealMethod();
                }).when(bankJdbc).queryForObject(
                    org.mockito.ArgumentMatchers.eq("select processed_at is not null from payment_webhook_events where event_id = ? for update"),
                    org.mockito.ArgumentMatchers.eq(Boolean.class), org.mockito.ArgumentMatchers.eq(eventId));
                var bank = new com.healthcare.payment.service.BankTransferWebhookService(paymentService, bankJdbc,
                    (com.fasterxml.jackson.databind.ObjectMapper) org.springframework.test.util.ReflectionTestUtils.getField(webhookService, "objectMapper"),
                    (jakarta.validation.Validator) org.springframework.test.util.ReflectionTestUtils.getField(webhookService, "validator"),
                    transactionManager);
                org.springframework.test.util.ReflectionTestUtils.setField(bank, "webhookSecret",
                    org.springframework.test.util.ReflectionTestUtils.getField(webhookService, "webhookSecret"));
                org.springframework.test.util.ReflectionTestUtils.setField(bank, "toleranceSeconds", 300L);
                var bankDelivery = executor.submit(() -> bank.process(
                    eventId, timestamp, webhookSignature(timestamp, payload), payload));
                org.assertj.core.api.Assertions.assertThat(bankLockAttempted.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                resumeWorker.countDown();
                org.assertj.core.api.Assertions.assertThat(attempt.get(10, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(1);
                org.assertj.core.api.Assertions.assertThat(bankDelivery.get(10, java.util.concurrent.TimeUnit.SECONDS).status())
                    .isEqualTo(com.healthcare.payment.entity.PaymentStatus.PENDING_VERIFICATION);
                org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                    "select payment_id from payment_webhook_events where event_id = ? and processed_at is not null",
                    UUID.class, eventId)).isEqualTo(payment.getId());
                org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                    "select count(*) from payment_audit_logs where payment_id = ? and action = 'WEBHOOK_RECEIVED_FOR_REVIEW'",
                    Integer.class, payment.getId())).isEqualTo(1);
                org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                    "select count(*) from notifications where event_type = 'PAYMENT_SUBMITTED'", Integer.class)).isEqualTo(1);
                return;
            }
            webhookService.process(eventId, timestamp, webhookSignature(timestamp, payload), payload);
            mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId())
                    .header("Authorization", adminToken).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"decision\":\"REJECT\",\"reason\":\"Bank statement mismatch\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
            var before = jdbcTemplate.queryForMap(
                "select status, verified_by, rejection_reason, version from bank_transfer_payments where id = ?", payment.getId());
            var processedBefore = jdbcTemplate.queryForMap(
                "select payment_id, processed_at from payment_webhook_events where event_id = ?", eventId);
            resumeWorker.countDown();
            org.assertj.core.api.Assertions.assertThat(attempt.get(10, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(1);
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForMap(
                "select status, verified_by, rejection_reason, version from bank_transfer_payments where id = ?", payment.getId()))
                .isEqualTo(before);
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select payment_status from appointments where id = ?", String.class, appointment.getId())).isEqualTo("REJECTED");
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForMap(
                "select payment_id, processed_at from payment_webhook_events where event_id = ?", eventId)).isEqualTo(processedBefore);
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select count(*) from payment_audit_logs where payment_id = ? and action = 'WEBHOOK_RECEIVED_FOR_REVIEW'",
                Integer.class, payment.getId())).isEqualTo(1);
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select count(*) from notifications where event_type = 'PAYMENT_SUBMITTED'", Integer.class)).isEqualTo(1);
        } finally {
            resumeWorker.countDown();
            executor.shutdownNow();
            org.assertj.core.api.Assertions.assertThat(executor.awaitTermination(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void webhookRetryDefersFailuresHonorsLeasesAndStopsExhaustedRows() {
        String prefix = "retry-" + UUID.randomUUID();
        for (String suffix : java.util.List.of("due", "leased", "exhausted")) {
            jdbcTemplate.update("""
                insert into payment_webhook_events
                    (event_id, payload_hash, transfer_content, amount, transaction_reference,
                     retry_attempts, next_retry_at)
                values (?, ?, ?, 200000, ?, ?, current_timestamp + cast(? as interval))
                """, prefix + suffix, "a".repeat(64), "missing-" + prefix,
                prefix, suffix.equals("due") ? 19 : suffix.equals("leased") ? 2 : 20,
                suffix.equals("leased") ? "1 hour" : "-1 minute");
        }
        jdbcTemplate.update("insert into payment_webhook_events (event_id, payload_hash) values (?, ?)",
            prefix + "legacy", "b".repeat(64));

        webhookService.retryPendingEvents();

        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject("""
            select count(*) from payment_webhook_events where event_id = ?
                and processed_at is null and retry_attempts = 20 and next_retry_at > current_timestamp
            """, Integer.class, prefix + "due")).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select retry_attempts from payment_webhook_events where event_id = ?",
            Integer.class, prefix + "leased")).isEqualTo(2);
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select retry_attempts from payment_webhook_events where event_id = ?",
            Integer.class, prefix + "legacy")).isZero();

        // Expire a crashed claim and an exhausted row without sleeping.
        jdbcTemplate.update("""
            update payment_webhook_events set next_retry_at = current_timestamp - interval '1 minute'
            where event_id in (?, ?)
            """, prefix + "leased", prefix + "due");
        webhookService.retryPendingEvents();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
            "select retry_attempts from payment_webhook_events where event_id = ?",
            Integer.class, prefix + "leased")).isEqualTo(3);
        for (String suffix : java.util.List.of("due", "exhausted")) {
            org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "select retry_attempts from payment_webhook_events where event_id = ?",
                Integer.class, prefix + suffix)).isEqualTo(20);
        }
    }

    @Test
    void cancelledPendingPaymentCannotBeConfirmedByAdminOrWebhook() throws Exception {
        User patientUser = createUser("PATIENT", "cancelled-payment.patient." + UUID.randomUUID() + "@example.com");
        User adminUser = createUser("ADMIN", "cancelled-payment.admin." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "cancelled-payment.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "095" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "cancelled-payment-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("cancelled-payment-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(12, 30), AppointmentStatus.CONFIRMED);
        BankTransferPayment payment = paymentService.initialize(appointment);
        String reference = "FT-CANCELLED-PENDING-123";

        mockMvc.perform(post("/api/v1/patient/appointments/" + appointment.getId() + "/payment/submit")
                .header("Authorization", bearer(patientUser))
                .header("Idempotency-Key", "cancelled-payment-submit-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"transactionReference\":\"" + reference + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION"));

        mockMvc.perform(post("/api/v1/appointments/" + appointment.getBookingCode() + "/cancel")
                .header("Authorization", bearer(patientUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Hủy trước khi đối soát\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paymentStatus").value("REJECTED"));

        mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId())
                .header("Authorization", bearer(adminUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"VERIFY\"}"))
            .andExpect(status().isConflict());

        String payload = webhookPayload(payment, reference);
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        mockMvc.perform(post("/api/v1/payments/webhooks/bank-transfer")
                .header("X-Webhook-Id", "evt-cancelled-payment")
                .header("X-Webhook-Timestamp", timestamp)
                .header("X-Webhook-Signature", webhookSignature(timestamp, payload))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isConflict());

        org.assertj.core.api.Assertions.assertThat(paymentRepository.findByAppointmentId(appointment.getId()))
            .get()
            .extracting(BankTransferPayment::getStatus)
            .isEqualTo(com.healthcare.payment.entity.PaymentStatus.REJECTED);
    }

    private String webhookPayload(BankTransferPayment payment, String transactionReference) {
        return "{\"transferContent\":\"" + payment.getTransferContent()
            + "\",\"amount\":" + payment.getAmount().toPlainString()
            + ",\"transactionReference\":\"" + transactionReference + "\"}";
    }

    private String webhookSignature(String timestamp, String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(
            "test-only-payment-webhook-secret-at-least-32-chars".getBytes(StandardCharsets.UTF_8),
            "HmacSHA256"
        ));
        return HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void bankTransferIsOwnerScopedIdempotentAndAdminReviewed() throws Exception {
        User patientUser = createUser("PATIENT", "payment.patient." + UUID.randomUUID() + "@example.com");
        User otherPatientUser = createUser("PATIENT", "payment.other." + UUID.randomUUID() + "@example.com");
        User adminUser = createUser("ADMIN", "payment.admin." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "payment.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "098" + randomDigits());
        createPatient(otherPatientUser, "099" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "payment-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("payment-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(9, 30), AppointmentStatus.CONFIRMED);
        BankTransferPayment payment = paymentService.initialize(appointment);

        mockMvc.perform(get("/api/v1/patient/appointments/" + appointment.getId() + "/payment")
                .header("Authorization", bearer(otherPatientUser)))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/patient/appointments/" + appointment.getId() + "/payment")
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UNPAID"))
            .andExpect(jsonPath("$.amount").value(200000))
            .andExpect(jsonPath("$.bankAccount").value("0000000000"))
            .andExpect(jsonPath("$.qrCodeUrl").value(org.hamcrest.Matchers.containsString("970436-0000000000-compact2.png")));

        String payload = "{\"transactionReference\":\"ft-123456789\"}";
        mockMvc.perform(post("/api/v1/patient/appointments/" + appointment.getId() + "/payment/submit")
                .header("Authorization", bearer(patientUser))
                .header("Idempotency-Key", "payment-submit-test-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION"))
            .andExpect(jsonPath("$.transactionReference").value("FT-123456789"));

        // Same submission is idempotent and does not create a second payment.
        mockMvc.perform(post("/api/v1/patient/appointments/" + appointment.getId() + "/payment/submit")
                .header("Authorization", bearer(patientUser))
                .header("Idempotency-Key", "payment-submit-test-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(payment.getId().toString()));

        mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId())
                .header("Authorization", bearer(adminUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"VERIFY\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PAID"));

        mockMvc.perform(post("/api/v1/appointments/" + appointment.getBookingCode() + "/cancel")
                .header("Authorization", bearer(patientUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Thay đổi kế hoạch\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paymentStatus").value("REFUND_PENDING"));

        mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId() + "/refund")
                .header("Authorization", bearer(adminUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refundReference\":\"rf-987654321\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REFUNDED"));

        mockMvc.perform(patch("/api/v1/admin/payments/" + payment.getId())
                .header("Authorization", bearer(patientUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"VERIFY\"}"))
            .andExpect(status().isForbidden());

        org.assertj.core.api.Assertions.assertThat(paymentRepository.findByAppointmentId(appointment.getId()))
            .get().extracting(BankTransferPayment::getStatus)
            .isEqualTo(com.healthcare.payment.entity.PaymentStatus.REFUNDED);
        org.assertj.core.api.Assertions.assertThat(appointmentRepository.findById(appointment.getId()))
            .get().extracting(Appointment::getPaymentStatus)
            .isEqualTo("REFUNDED");

        java.util.List<String> auditDetails = jdbcTemplate.queryForList(
            "select details from payment_audit_logs where payment_id = ? order by created_at", String.class, payment.getId());
        org.assertj.core.api.Assertions.assertThat(auditDetails)
            .anyMatch(details -> details.contains("from=PENDING_VERIFICATION;to=PAID"))
            .anyMatch(details -> details.contains("from=PAID;to=REFUND_PENDING"))
            .anyMatch(details -> details.contains("from=REFUND_PENDING;to=REFUNDED"))
            .noneMatch(details -> details.contains("FT-123456789") || details.contains("RF-987654321"));
    }

    @Test
    void patientAppointmentsAreScopedPaginatedAndDoNotExposeSecrets() throws Exception {
        User patientUser = createUser("PATIENT", "portal.patient." + UUID.randomUUID() + "@example.com");
        User otherPatientUser = createUser("PATIENT", "portal.other.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "090" + randomDigits());
        PatientProfile otherPatient = createPatient(otherPatientUser, "091" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);

        Appointment first = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);
        createAppointment(
            patient, doctor, branch, PORTAL_DATE.plusDays(1), LocalTime.of(10, 0), AppointmentStatus.CONFIRMED);
        createAppointment(
            otherPatient, doctor, branch, PORTAL_DATE, LocalTime.of(11, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(get("/api/v1/patient/appointments")
                .param("page", "0")
                .param("size", "1")
                .param("sort", "appointmentDate,asc")
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].id").value(first.getId().toString()))
            .andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.content[0].doctorName").value(doctor.getFullName()))
            .andExpect(jsonPath("$.content[0].branchId").value(branch.getId().toString()))
            .andExpect(jsonPath("$.content[0].patientPhone").doesNotExist())
            .andExpect(jsonPath("$.content[0].patientEmail").doesNotExist())
            .andExpect(jsonPath("$.content[0].otpCode").doesNotExist())
            .andExpect(jsonPath("$.content[0].otpExpiresAt").doesNotExist());
    }

    @Test
    void patientCanReadAndUpdateOwnProfileWithoutChangingIdentityFields() throws Exception {
        User patientUser = createUser("PATIENT", "portal.profile.patient." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "097" + randomDigits());

        mockMvc.perform(put("/api/v1/patient/profile")
                .header("Authorization", bearer(patientUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "fullName": "Nguyen Van Updated",
                      "dateOfBirth": "1990-05-20",
                      "gender": "MALE",
                      "address": "Ho Chi Minh City",
                      "emergencyContactName": "Emergency Contact",
                      "emergencyContactPhone": "0901234567"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(patient.getId().toString()))
            .andExpect(jsonPath("$.fullName").value("Nguyen Van Updated"))
            .andExpect(jsonPath("$.phone").value(patient.getPhone()))
            .andExpect(jsonPath("$.gender").value("MALE"));

        mockMvc.perform(get("/api/v1/patient/profile")
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.address").value("Ho Chi Minh City"));
    }

    @Test
    void doctorAppointmentsAreScopedByDoctorDateAndStatus() throws Exception {
        User patientUser = createUser("PATIENT", "portal.doctor.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.doctor.owner." + UUID.randomUUID() + "@example.com");
        User otherDoctorUser = createUser("DOCTOR", "portal.doctor.other." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "092" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-owner-doctor-" + UUID.randomUUID());
        Doctor otherDoctor = createDoctor(otherDoctorUser, "portal-other-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-doctor-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        assignDoctorToBranch(otherDoctor, branch);

        Appointment confirmed = createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);
        createAppointment(
            patient, doctor, branch, PORTAL_DATE, LocalTime.of(10, 0), AppointmentStatus.CANCELLED);
        createAppointment(
            patient, otherDoctor, branch, PORTAL_DATE, LocalTime.of(11, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .param("status", "CONFIRMED")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].id").value(confirmed.getId().toString()))
            .andExpect(jsonPath("$.content[0].patientId").value(patient.getId().toString()))
            .andExpect(jsonPath("$.content[0].patientName").value(patient.getFullName()))
            .andExpect(jsonPath("$.content[0].patientPhone").doesNotExist())
            .andExpect(jsonPath("$.content[0].patientEmail").doesNotExist())
            .andExpect(jsonPath("$.content[0].paymentStatus").doesNotExist())
            .andExpect(jsonPath("$.content[0].otpCode").doesNotExist());
    }

    @Test
    void wrongRolesAndInvalidDoctorFiltersAreRejected() throws Exception {
        User patientUser = createUser("PATIENT", "portal.invalid.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.invalid.doctor." + UUID.randomUUID() + "@example.com");
        createPatient(patientUser, "093" + randomDigits());
        createDoctor(doctorUser, "portal-invalid-doctor-" + UUID.randomUUID());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .header("Authorization", bearer(patientUser)))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/patient/appointments")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", "2030-99-15")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .param("status", "NOT_A_STATUS")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void doctorEmptyPageReportsNoRows() throws Exception {
        User doctorUser = createUser("DOCTOR", "portal.empty.doctor." + UUID.randomUUID() + "@example.com");
        createDoctor(doctorUser, "portal-empty-doctor-" + UUID.randomUUID());

        mockMvc.perform(get("/api/v1/doctor/appointments")
                .param("date", PORTAL_DATE.toString())
                .header("Authorization", bearer(doctorUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.content.length()").value(0))
            .andExpect(jsonPath("$.totalElements").value(0))
            .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void assignedDoctorCanAdvanceAppointmentLifecycleInOrder() throws Exception {
        User patientUser = createUser("PATIENT", "portal.workflow.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.workflow.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "094" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-workflow-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-workflow-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, LocalDate.now(BUSINESS_ZONE), LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CHECKED_IN\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CHECKED_IN"));

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    void doctorCannotSkipLifecycleOrUpdateAnotherDoctorsAppointment() throws Exception {
        User patientUser = createUser("PATIENT", "portal.workflow.guard.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.workflow.guard.doctor." + UUID.randomUUID() + "@example.com");
        User otherDoctorUser = createUser("DOCTOR", "portal.workflow.guard.other." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "095" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-workflow-guard-" + UUID.randomUUID());
        createDoctor(otherDoctorUser, "portal-workflow-other-" + UUID.randomUUID());
        Branch branch = createBranch("portal-workflow-guard-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, LocalDate.now(BUSINESS_ZONE), LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}"))
            .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(otherDoctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CHECKED_IN\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void doctorCanMarkPastConfirmedAppointmentAsNoShow() throws Exception {
        User patientUser = createUser("PATIENT", "portal.noshow.patient." + UUID.randomUUID() + "@example.com");
        User doctorUser = createUser("DOCTOR", "portal.noshow.doctor." + UUID.randomUUID() + "@example.com");
        PatientProfile patient = createPatient(patientUser, "096" + randomDigits());
        Doctor doctor = createDoctor(doctorUser, "portal-noshow-doctor-" + UUID.randomUUID());
        Branch branch = createBranch("portal-noshow-branch-" + UUID.randomUUID());
        assignDoctorToBranch(doctor, branch);
        Appointment appointment = createAppointment(
            patient, doctor, branch, LocalDate.now(BUSINESS_ZONE).minusDays(1), LocalTime.of(9, 0), AppointmentStatus.CONFIRMED);

        mockMvc.perform(patch("/api/v1/doctor/appointments/" + appointment.getId() + "/status")
                .header("Authorization", bearer(doctorUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"NO_SHOW\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("NO_SHOW"));
    }

    private User createUser(String roleCode, String email) {
        Role role = roleRepository.findByCode(roleCode).orElseThrow();
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName(roleCode + " Portal Test");
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(role);
        return userRepository.saveAndFlush(user);
    }

    private PatientProfile createPatient(User user, String phone) {
        PatientProfile patient = new PatientProfile();
        patient.setUserId(user.getId());
        patient.setFullName(user.getDisplayName());
        patient.setPhone(phone);
        patient.setEmail(user.getEmail());
        return patientProfileRepository.saveAndFlush(patient);
    }

    private Doctor createDoctor(User user, String slug) {
        Doctor doctor = new Doctor();
        doctor.setUserId(user.getId());
        doctor.setFullName(user.getDisplayName());
        doctor.setSlug(slug);
        doctor.setActive(true);
        return doctorRepository.saveAndFlush(doctor);
    }

    private Branch createBranch(String slug) {
        Branch branch = new Branch();
        branch.setName("Portal branch");
        branch.setSlug(slug);
        branch.setAddress("Portal test address");
        branch.setActive(true);
        return branchRepository.saveAndFlush(branch);
    }

    private void assignDoctorToBranch(Doctor doctor, Branch branch) {
        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(doctor);
        doctorBranch.setBranch(branch);
        doctorBranchRepository.saveAndFlush(doctorBranch);
    }

    private Appointment createAppointment(
            PatientProfile patient,
            Doctor doctor,
            Branch branch,
            LocalDate date,
            LocalTime start,
            AppointmentStatus status) {
        Appointment appointment = new Appointment();
        appointment.setBookingCode("PORTAL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setBranch(branch);
        appointment.setAppointmentDate(date);
        appointment.setStartTime(start);
        appointment.setEndTime(start.plusMinutes(30));
        appointment.setAppointmentTime(OffsetDateTime.of(date, start, ZoneOffset.UTC));
        appointment.setStatus(status);
        appointment.setPaymentStatus("UNPAID");
        appointment.setReasonForVisit("Portal appointment test");
        appointment.setOtpCode("123456");
        appointment.setOtpExpiresAt(OffsetDateTime.now().plusMinutes(10));
        return appointmentRepository.saveAndFlush(appointment);
    }

    private String bearer(User user) {
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private String randomDigits() {
        return String.valueOf(Math.abs(UUID.randomUUID().getLeastSignificantBits())).substring(0, 7);
    }
}
