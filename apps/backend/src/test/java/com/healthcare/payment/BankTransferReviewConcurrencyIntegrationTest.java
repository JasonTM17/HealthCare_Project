package com.healthcare.payment;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.demo.DashboardDemonstrationGuard;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.notification.service.NotificationService;
import com.healthcare.payment.dto.BankTransferPaymentResponse;
import com.healthcare.payment.dto.RefundBankTransferRequest;
import com.healthcare.payment.dto.ReviewBankTransferRequest;
import com.healthcare.payment.entity.BankTransferPayment;
import com.healthcare.payment.entity.PaymentStatus;
import com.healthcare.payment.repository.BankTransferPaymentRepository;
import com.healthcare.payment.service.BankTransferPaymentService;
import com.healthcare.payment.service.PaymentAuditService;
import com.healthcare.payment.service.PaymentChannelProvider;
import com.healthcare.payment.service.PaymentStatusEmailService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/** Real PostgreSQL/JPA transactions: the queued request probes before the winner commits. */
@TestPropertySource(properties = {
    "app.mail.enabled=false", "app.mail.outbox.enabled=false",
    "app.notification.email.enabled=false", "app.payment.bank-transfer.status-email-enabled=false",
    "app.payment.bank-transfer.retry-enabled=false", "app.self-warmer.enabled=false",
    "app.ai.catalog-sync-enabled=false", "ai.rag-ingest.enabled=false",
    "patient.consultation.cleanup-enabled=false", "ai.chat.cleanup-enabled=false"
})
class BankTransferReviewConcurrencyIntegrationTest extends AbstractIntegrationTest {
    @Autowired private BankTransferPaymentService paymentService;
    @Autowired private BankTransferPaymentRepository payments;
    @Autowired private RoleRepository roles;
    @Autowired private UserRepository users;
    @Autowired private PatientProfileRepository patients;
    @Autowired private NotificationService notifications;
    @Autowired private PaymentAuditService audit;
    @Autowired private AppointmentClaimService claims;
    @Autowired private PaymentStatusEmailService statusEmail;
    @Autowired private PaymentChannelProvider channel;
    @Autowired private DashboardDemonstrationGuard demonstration;
    @Autowired private PlatformTransactionManager transactions;

    @ParameterizedTest
    @EnumSource(ReviewBankTransferRequest.Decision.class)
    void queuedIdenticalReviewReturnsCommittedStateWithoutDuplicateEffects(
            ReviewBankTransferRequest.Decision decision) throws Exception {
        Fixture fixture = fixture(PaymentStatus.PENDING_VERIFICATION);
        ReviewBankTransferRequest request = new ReviewBankTransferRequest(decision, "Test reconciliation mismatch");
        PaymentStatus expected = decision == ReviewBankTransferRequest.Decision.VERIFY
            ? PaymentStatus.PAID : PaymentStatus.REJECTED;
        String event = decision == ReviewBankTransferRequest.Decision.VERIFY
            ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED";
        proveQueuedReplay(fixture, expected, "ADMIN_" + decision.name(), event,
            () -> paymentService.review(fixture.paymentId(), request, fixture.principal()),
            service -> service.review(fixture.paymentId(), request, fixture.principal()));
    }

    @Test
    void queuedIdenticalRefundReturnsCommittedStateWithoutDuplicateEffects() throws Exception {
        Fixture fixture = fixture(PaymentStatus.REFUND_PENDING);
        RefundBankTransferRequest request = new RefundBankTransferRequest("TEST-REFUND-0001");
        proveQueuedReplay(fixture, PaymentStatus.REFUNDED, "ADMIN_REFUNDED", "PAYMENT_REFUNDED",
            () -> paymentService.refund(fixture.paymentId(), request, fixture.principal()),
            service -> service.refund(fixture.paymentId(), request, fixture.principal()));
    }

    private void proveQueuedReplay(Fixture fixture, PaymentStatus expected, String action, String event,
            Supplier<BankTransferPaymentResponse> winner,
            java.util.function.Function<BankTransferPaymentService, BankTransferPaymentResponse> duplicate)
            throws Exception {
        CountDownLatch afterProbe = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        // Delegate all real repository behavior; only control the pre-lock schedule.
        AppointmentRepository gatedAppointments = (AppointmentRepository) Proxy.newProxyInstance(
            AppointmentRepository.class.getClassLoader(), new Class<?>[] {AppointmentRepository.class},
            (proxy, method, args) -> {
                if (method.getName().equals("findByIdWithDetailsForUpdate")) {
                    afterProbe.countDown();
                    assertThat(release.await(15, TimeUnit.SECONDS)).as("release queued appointment lock").isTrue();
                }
                try {
                    return method.invoke(appointmentRepository, args);
                } catch (InvocationTargetException exception) {
                    throw exception.getCause();
                }
            });
        BankTransferPaymentService queued = new BankTransferPaymentService(payments, gatedAppointments,
            patients, users, notifications, audit, claims, statusEmail, channel, demonstration);
        for (String field : new String[] {"configuredProvider", "defaultAmount", "payByHoursBeforeAppointment"}) {
            ReflectionTestUtils.setField(queued, field, ReflectionTestUtils.getField(paymentService, field));
        }
        var executor = Executors.newSingleThreadExecutor();
        try {
            var result = executor.submit(() -> new TransactionTemplate(transactions)
                .execute(status -> duplicate.apply(queued)));
            assertThat(afterProbe.await(15, TimeUnit.SECONDS)).as("queued request completed its ID probe").isTrue();
            long beforeVersion = version(fixture.paymentId());
            assertThat(winner.get().status()).isEqualTo(expected);
            long committedVersion = version(fixture.paymentId());
            assertThat(committedVersion).isEqualTo(beforeVersion + 1);
            release.countDown();
            assertThat(result.get(15, TimeUnit.SECONDS).status()).isEqualTo(expected);
            assertThat(version(fixture.paymentId())).isEqualTo(committedVersion);
            assertThat(jdbcTemplate.queryForObject(
                "select status from bank_transfer_payments where id=?", String.class, fixture.paymentId()))
                .isEqualTo(expected.name());
            assertThat(jdbcTemplate.queryForObject(
                "select payment_status from appointments where id=?", String.class, fixture.appointmentId()))
                .isEqualTo(expected.name());
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from payment_audit_logs where payment_id=? and action=? and actor_email=?",
                Integer.class, fixture.paymentId(), action, fixture.principal().getUsername())).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from payment_audit_logs where payment_id=?", Integer.class, fixture.paymentId()))
                .isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from notifications where reference_id=? and event_type=? and user_id=?",
                Integer.class, fixture.appointmentId(), event, fixture.patientUserId())).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "select count(*) from notifications where reference_id=?", Integer.class, fixture.appointmentId()))
                .isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject("select count(*) from email_outbox", Integer.class)).isZero();
            assertThat(jdbcTemplate.queryForObject("select count(*) from payment_invoices", Integer.class)).isZero();
            assertThat(jdbcTemplate.queryForObject("select count(*) from payment_webhook_events", Integer.class)).isZero();
        } finally {
            release.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(15, TimeUnit.SECONDS)).isTrue();
        }
    }

    private long version(UUID id) {
        return jdbcTemplate.queryForObject("select version from bank_transfer_payments where id=?", Long.class, id);
    }

    private Fixture fixture(PaymentStatus initial) {
        return new TransactionTemplate(transactions).execute(status -> createFixture(initial));
    }

    private Fixture createFixture(PaymentStatus initial) {
        User admin = user("ADMIN");
        User patientUser = user("PATIENT");
        PatientProfile patient = new PatientProfile();
        patient.setUserId(patientUser.getId()); patient.setFullName("Synthetic concurrency patient");
        patient.setEmail(patientUser.getEmail()); patient.setPhone("099" + System.nanoTime() % 10000000);
        patient = patientProfileRepository.saveAndFlush(patient);
        Doctor doctor = new Doctor(); doctor.setFullName("Synthetic concurrency doctor");
        doctor.setSlug("concurrency-" + UUID.randomUUID()); doctor.setActive(true);
        doctor = doctorRepository.saveAndFlush(doctor);
        Appointment appointment = new Appointment();
        appointment.setBookingCode("TEST-" + UUID.randomUUID().toString().substring(0, 20));
        appointment.setPatient(patient); appointment.setDoctor(doctor);
        appointment.setAppointmentDate(LocalDate.of(2030, 1, 15));
        appointment.setStartTime(LocalTime.of(9, 0)); appointment.setEndTime(LocalTime.of(9, 30));
        appointment.setAppointmentTime(OffsetDateTime.of(2030, 1, 15, 9, 0, 0, 0, ZoneOffset.UTC));
        appointment.setStatus(AppointmentStatus.CONFIRMED); appointment.setPaymentStatus(initial.name());
        appointment = appointmentRepository.saveAndFlush(appointment);
        BankTransferPayment payment = new BankTransferPayment();
        payment.setAppointment(appointment); payment.setAmount(new BigDecimal("200000"));
        payment.setTransferContent("TEST " + UUID.randomUUID()); payment.setStatus(initial);
        payment.setTransactionReference("TEST-REFERENCE-0001");
        payment.setSubmittedAt(OffsetDateTime.now());
        if (initial == PaymentStatus.REFUND_PENDING) payment.setVerifiedAt(OffsetDateTime.now());
        payment = payments.saveAndFlush(payment);
        UserDetails principal = org.springframework.security.core.userdetails.User
            .withUsername(admin.getEmail()).password("unused").roles("ADMIN").build();
        return new Fixture(payment.getId(), appointment.getId(), patientUser.getId(), principal);
    }

    private User user(String role) {
        User user = new User(); user.setEmail("payment-race-" + UUID.randomUUID() + "@example.invalid");
        user.setDisplayName("Synthetic concurrency " + role); user.setPasswordHash("unused");
        user.setStatus("ACTIVE"); user.setEmailVerified(true); user.addRole(roles.findByCode(role).orElseThrow());
        user.setCreatedAt(OffsetDateTime.now()); user.setUpdatedAt(OffsetDateTime.now());
        return users.saveAndFlush(user);
    }

    private record Fixture(UUID paymentId, UUID appointmentId, UUID patientUserId, UserDetails principal) {}
}
