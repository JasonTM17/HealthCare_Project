package com.healthcare.auth;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.auth.dto.BrowserSessionCreateRequest;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.auth.service.GoogleIdTokenVerifier;
import com.healthcare.exception.BusinessException;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

/** PostgreSQL uniqueness, stable-row serialization and purpose/subject mailbox proof. */
@TestPropertySource(properties = {"app.mail.outbox.enabled=false", "healthcare.demo.login-allowed=false"})
class GoogleIdentityBindingIntegrationTest extends AbstractIntegrationTest {
    @Autowired private AuthService auth;
    @Autowired private AuthOtpService otps;
    @Autowired private UserRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder encoder;
    @MockitoBean private GoogleIdTokenVerifier verifier;
    @MockitoBean private AfterCommitEmailSender mail;
    @MockitoSpyBean private BrowserSessionService sessions;
    private final AtomicReference<String> mailedCode = new AtomicReference<>();

    @BeforeEach
    void captureSyntheticMailbox() {
        mailedCode.set(null);
        doAnswer(invocation -> {
            Map<?, ?> variables = invocation.getArgument(2);
            mailedCode.set((String) variables.get("code"));
            return null;
        }).when(mail).sendTemplateBestEffort(any(), anyString(), any());
    }

    private void identity(String credential, String subject, String email, boolean authoritative) {
        when(verifier.verify(credential)).thenReturn(
            new GoogleIdTokenVerifier.GoogleIdentity(subject, email, "Synthetic Patient", authoritative));
    }

    private BrowserSessionCreateRequest grant(String credential, String code) {
        return new BrowserSessionCreateRequest(BrowserSessionCreateRequest.GrantType.GOOGLE, null, null, code, credential);
    }

    private User patient(String email, boolean verified) {
        User user = new User();
        user.setEmail(email); user.setDisplayName("Synthetic Patient"); user.setStatus("ACTIVE");
        user.setEmailVerified(verified); user.setPasswordHash(encoder.encode(UUID.randomUUID().toString()));
        user.setCreatedAt(OffsetDateTime.now()); user.setUpdatedAt(OffsetDateTime.now());
        user = users.saveAndFlush(user);
        jdbcTemplate.update("INSERT INTO user_roles(user_id,role_id) VALUES (?,?)", user.getId(), roles.findByCode("PATIENT").orElseThrow().getId());
        return user;
    }

    @Test
    void thirdPartyFirstLoginRequiresFreshMailboxProofAndRejectsReplay() {
        identity("synthetic-third-party", "third-party-subject", "mailbox@example.com", false);
        assertThatThrownBy(() -> auth.createBrowserSession(grant("synthetic-third-party", null), new MockHttpServletRequest()))
            .isInstanceOf(BusinessException.class);
        assertThat(users.findByEmail("mailbox@example.com")).isEmpty();
        auth.requestGoogleProof("synthetic-third-party", new MockHttpServletRequest());
        User pending = users.findByEmail("mailbox@example.com").orElseThrow();
        assertThat(pending.getGoogleSubject()).isNull();
        assertThat(pending.isEmailVerified()).isFalse();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM browser_sessions WHERE user_id=?", Long.class, pending.getId())).isZero();
        String code = mailedCode.get();
        auth.createBrowserSession(grant("synthetic-third-party", code), new MockHttpServletRequest());
        User linked = users.findByEmail("mailbox@example.com").orElseThrow();
        assertThat(linked.getGoogleSubject()).isEqualTo("third-party-subject");
        assertThat(linked.isEmailVerified()).isTrue();
        assertThatThrownBy(() -> auth.createBrowserSession(grant("synthetic-third-party", code), new MockHttpServletRequest()))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void wrongSubjectWrongCodeAndExpiredProofDoNotBindAndAttemptsCommit() {
        identity("synthetic-one", "subject-one", "mailbox@example.com", false);
        identity("synthetic-two", "subject-two", "mailbox@example.com", false);
        auth.requestGoogleProof("synthetic-one", new MockHttpServletRequest());
        UUID id = users.findByEmail("mailbox@example.com").orElseThrow().getId();
        assertThatThrownBy(() -> auth.createBrowserSession(grant("synthetic-two", mailedCode.get()), new MockHttpServletRequest()))
            .isInstanceOf(OtpVerificationException.class);
        assertThatThrownBy(() -> auth.createBrowserSession(grant("synthetic-one", "incorrect-synthetic-code"), new MockHttpServletRequest()))
            .isInstanceOf(OtpVerificationException.class);
        assertThat(jdbcTemplate.queryForObject("SELECT attempts FROM auth_otp_challenges WHERE user_id=? AND purpose='GOOGLE_LINK'", Integer.class, id)).isEqualTo(1);
        jdbcTemplate.update("UPDATE auth_otp_challenges SET expires_at=CURRENT_TIMESTAMP - interval '1 minute' WHERE user_id=?", id);
        assertThatThrownBy(() -> auth.createBrowserSession(grant("synthetic-one", mailedCode.get()), new MockHttpServletRequest()))
            .isInstanceOf(OtpVerificationException.class);
        assertThat(users.findById(id).orElseThrow().getGoogleSubject()).isNull();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM auth_otp_challenges WHERE user_id=? AND consumed_at IS NULL", Long.class, id)).isZero();
    }

    @Test
    void ordinaryEmailVerificationCannotBindGoogleAndCannotPreserveReservationPassword() {
        User reservation = patient("mailbox@example.com", false);
        String originalHash = reservation.getPasswordHash();
        identity("synthetic-google", "proved-subject", reservation.getEmail(), false);
        auth.requestGoogleProof("synthetic-google", new MockHttpServletRequest());
        String googleCode = mailedCode.get();
        otps.issueVerification(reservation, new MockHttpServletRequest());
        String ordinaryCode = mailedCode.get();
        auth.confirmEmail(new com.healthcare.user.dto.EmailVerificationRequest(reservation.getEmail(), ordinaryCode), new MockHttpServletRequest());
        assertThat(users.findById(reservation.getId()).orElseThrow().getGoogleSubject()).isNull();
        assertThatThrownBy(() -> auth.createBrowserSession(grant("synthetic-google", null), new MockHttpServletRequest()))
            .isInstanceOf(BusinessException.class);
        auth.createBrowserSession(grant("synthetic-google", googleCode), new MockHttpServletRequest());
        assertThat(users.findById(reservation.getId()).orElseThrow().getPasswordHash()).isNotEqualTo(originalHash);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM refresh_tokens WHERE user_id=? AND revoked_at IS NULL", Long.class, reservation.getId())).isZero();
    }

    @Test
    void authoritativeReservationActivationDiscardsPasswordAndResetChallenges() {
        User reservation = patient("victim@gmail.com", false);
        String originalHash = reservation.getPasswordHash();
        otps.requestPasswordReset(reservation.getEmail(), new MockHttpServletRequest());
        identity("synthetic-gmail", "victim-subject", reservation.getEmail(), true);
        auth.createBrowserSession(grant("synthetic-gmail", null), new MockHttpServletRequest());
        User linked = users.findById(reservation.getId()).orElseThrow();
        assertThat(linked.getPasswordHash()).isNotEqualTo(originalHash);
        assertThat(linked.getGoogleSubject()).isEqualTo("victim-subject");
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM auth_otp_challenges WHERE user_id=? AND consumed_at IS NULL", Long.class, reservation.getId())).isZero();
    }

    @Test
    void returningSubjectPreservesOriginalAccountWhenProviderEmailChanges() {
        identity("synthetic-first", "stable-subject", "original@gmail.com", true);
        auth.createBrowserSession(grant("synthetic-first", null), new MockHttpServletRequest());
        User original = users.findByEmail("original@gmail.com").orElseThrow();
        identity("synthetic-changed", "stable-subject", "changed@example.com", false);
        auth.createBrowserSession(grant("synthetic-changed", null), new MockHttpServletRequest());
        assertThat(users.findById(original.getId()).orElseThrow().getEmail()).isEqualTo("original@gmail.com");
        assertThat(users.findByEmail("changed@example.com")).isEmpty();
    }

    private int attempt(String credential, CountDownLatch start) throws Exception {
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Test synchronization timeout");
        try { auth.createBrowserSession(grant(credential, null), new MockHttpServletRequest()); return 200; }
        catch (BusinessException error) { return error.getStatus(); }
    }

    @Test
    void distinctSubjectsRacingFirstBindingCannotOverwriteWinner() throws Exception {
        User patient = patient("race@gmail.com", true);
        String password = patient.getPasswordHash();
        identity("synthetic-race-one", "race-one", patient.getEmail(), true);
        identity("synthetic-race-two", "race-two", patient.getEmail(), true);
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var one = pool.submit(() -> attempt("synthetic-race-one", start));
            var two = pool.submit(() -> attempt("synthetic-race-two", start));
            start.countDown();
            assertThat(java.util.List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
        }
        User winner = users.findById(patient.getId()).orElseThrow();
        assertThat(winner.getGoogleSubject()).isIn("race-one", "race-two");
        assertThat(winner.getPasswordHash()).isEqualTo(password);
    }

    @Test
    void sameSubjectConcurrentProvisioningProducesOneUser() throws Exception {
        identity("synthetic-race-one", "unique-subject", "one@gmail.com", true);
        identity("synthetic-race-two", "unique-subject", "two@gmail.com", true);
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var one = pool.submit(() -> attempt("synthetic-race-one", start));
            var two = pool.submit(() -> attempt("synthetic-race-two", start));
            start.countDown();
            assertThat(java.util.List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS)))
                .allMatch(status -> status == 200 || status == 409).contains(200);
        }
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM users WHERE google_subject='unique-subject'", Long.class)).isEqualTo(1);
    }

    @Test
    void blankAndDuplicateSubjectsAreDatabaseConstraints() {
        User one = patient("one@example.com", true);
        User two = patient("two@example.com", true);
        assertThat(one.getGoogleSubject()).isNull();
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE users SET google_subject=' ' WHERE id=?", one.getId()))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        jdbcTemplate.update("UPDATE users SET google_subject='constraint-subject' WHERE id=?", one.getId());
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE users SET google_subject='constraint-subject' WHERE id=?", two.getId()))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void sessionFailureRollsBackProvisioningPreferencesAndBinding() {
        identity("synthetic-fault", "fault-subject", "fault@gmail.com", true);
        doThrow(new IllegalStateException("Synthetic session failure")).when(sessions).issueReplacing(any(), any());
        assertThatThrownBy(() -> auth.createBrowserSession(grant("synthetic-fault", null), new MockHttpServletRequest()))
            .isInstanceOf(IllegalStateException.class);
        assertThat(users.findByEmail("fault@gmail.com")).isEmpty();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM users WHERE google_subject='fault-subject'", Long.class)).isZero();
    }
}
