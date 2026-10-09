package com.healthcare.auth;

import com.healthcare.auth.entity.AuthOtpChallenge;
import com.healthcare.auth.entity.AuthOtpPurpose;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.auth.mail.EmailOutboxService;
import com.healthcare.auth.mail.EmailTemplateKey;
import com.healthcare.auth.mail.EmailTemplateRenderer;
import com.healthcare.auth.repository.AuthOtpChallengeRepository;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Map;

/** Authentication OTPs are purpose-scoped and deliberately separate from booking OTPs. */
@Service
public class AuthOtpService {

    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthOtpChallengeRepository challengeRepository;
    private final UserRepository userRepository;
    private final UserSecurityLock userSecurityLock;
    private final PasswordEncoder passwordEncoder;
    private final AfterCommitEmailSender emailSender;
    private final EmailOutboxService emailOutbox;
    private final EmailTemplateRenderer emailTemplates;
    private final AuthRateLimiter rateLimiter;
    private final Environment environment;
    private final long ttlSeconds;
    private final long resendCooldownSeconds;

    public AuthOtpService(AuthOtpChallengeRepository challengeRepository,
                          UserRepository userRepository,
                          UserSecurityLock userSecurityLock,
                          PasswordEncoder passwordEncoder,
                          AfterCommitEmailSender emailSender,
                          EmailOutboxService emailOutbox,
                          EmailTemplateRenderer emailTemplates,
                          AuthRateLimiter rateLimiter,
                          Environment environment) {
        this.challengeRepository = challengeRepository;
        this.userRepository = userRepository;
        this.userSecurityLock = userSecurityLock;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
        this.emailOutbox = emailOutbox;
        this.emailTemplates = emailTemplates;
        this.rateLimiter = rateLimiter;
        this.environment = environment;
        long configuredTtl = environment.getProperty("app.security.auth-otp.ttl-seconds", Long.class, 600L);
        this.ttlSeconds = Math.max(60L, Math.min(configuredTtl, 3600L));
        long configuredCooldown = environment.getProperty("app.security.auth-otp.resend-cooldown-seconds", Long.class, 60L);
        this.resendCooldownSeconds = Math.max(10L, Math.min(configuredCooldown, 900L));
    }

    @Transactional
    public void issueVerification(User user, HttpServletRequest request) {
        rateLimiter.check(request, user.getEmail(), "verification-issue");
        issue(user, AuthOtpPurpose.EMAIL_VERIFICATION);
    }

    /** Admin service rate-checks before governance locks, then revalidates the locked actor/target. */
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void issueAdminVerificationLocked(User user) {
        if (user.isEmailVerified() || !"ACTIVE".equals(user.getStatus())) {
            throw new BusinessException(409, "Verification requires an active unverified account");
        }
        issue(user, AuthOtpPurpose.EMAIL_VERIFICATION);
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void issueAdminPasswordResetLocked(User user) {
        if (!user.isEmailVerified() || !"ACTIVE".equals(user.getStatus())) {
            throw new BusinessException(409, "Password reset requires an active verified account");
        }
        issue(user, AuthOtpPurpose.PASSWORD_RESET);
    }

    /** Resend is intentionally generic for unknown and already-verified addresses. */
    @Transactional
    public void resendVerification(String email, HttpServletRequest request) {
        String normalizedEmail = normalizeEmail(email);
        rateLimiter.check(request, normalizedEmail, "verification-resend");
        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            if (!user.isEmailVerified() && "ACTIVE".equals(user.getStatus())) {
                issue(user, AuthOtpPurpose.EMAIL_VERIFICATION);
            }
        });
    }

    /** Password-reset request never reveals whether the address exists. */
    @Transactional
    public void requestPasswordReset(String email, HttpServletRequest request) {
        String normalizedEmail = normalizeEmail(email);
        rateLimiter.check(request, normalizedEmail, "password-reset-request");
        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            if ("ACTIVE".equals(user.getStatus())) {
                issue(user, AuthOtpPurpose.PASSWORD_RESET);
            }
        });
    }

    @Transactional(noRollbackFor = OtpVerificationException.class)
    public User confirmEmail(String email, String code, HttpServletRequest request) {
        String normalizedEmail = normalizeEmail(email);
        rateLimiter.check(request, normalizedEmail, "verification-confirm");
        User user = userSecurityLock.findByEmailForUpdate(normalizedEmail)
            .orElseThrow(() -> invalidOtp());
        verify(user, AuthOtpPurpose.EMAIL_VERIFICATION, code);
        return user;
    }

    @Transactional(noRollbackFor = OtpVerificationException.class)
    public User confirmPasswordReset(String email, String code, HttpServletRequest request) {
        String normalizedEmail = normalizeEmail(email);
        rateLimiter.check(request, normalizedEmail, "password-reset-confirm");
        User user = userSecurityLock.findByEmailForUpdate(normalizedEmail)
            .orElseThrow(() -> invalidOtp());
        verify(user, AuthOtpPurpose.PASSWORD_RESET, code);
        return user;
    }

    private void issue(User user, AuthOtpPurpose purpose) {
        issue(user, purpose, null);
    }

    @Transactional
    public void issueGoogleLink(User user, String subject, HttpServletRequest request) {
        rateLimiter.check(request, user.getEmail(), "google-link-issue");
        issue(user, AuthOtpPurpose.GOOGLE_LINK, subject);
    }

    @Transactional(noRollbackFor = OtpVerificationException.class)
    public boolean confirmGoogleLink(User user, String subject, String code, HttpServletRequest request) {
        rateLimiter.check(request, user.getEmail(), "google-link-confirm");
        return verify(user, AuthOtpPurpose.GOOGLE_LINK, code, subject).isDiscardUntrustedPassword();
    }

    /** Must be called while the caller holds the stable user security lock. */
    @Transactional
    public void invalidateAll(User user) {
        OffsetDateTime now = OffsetDateTime.now();
        for (AuthOtpPurpose purpose : AuthOtpPurpose.values()) {
            challengeRepository.findActiveForUpdate(user.getId(), purpose)
                .forEach(challenge -> challenge.consume(now));
        }
    }

    private void issue(User user, AuthOtpPurpose purpose, String subject) {
        User lockedUser = userSecurityLock.findByIdForUpdate(user.getId())
            .orElseThrow(() -> new IllegalStateException("OTP owner no longer exists"));
        OffsetDateTime now = OffsetDateTime.now();
        List<AuthOtpChallenge> activeChallenges = challengeRepository
            .findActiveForUpdate(lockedUser.getId(), purpose);
        boolean withinCooldown = activeChallenges.stream()
            .anyMatch(challenge -> !challenge.isExpired(now)
                && java.util.Objects.equals(challenge.getGoogleSubject(), subject)
                && challenge.getCreatedAt().plusSeconds(resendCooldownSeconds).isAfter(now));
        if (withinCooldown) {
            return;
        }
        activeChallenges.forEach(challenge -> challenge.consume(now));

        String code = String.format("%0" + OTP_LENGTH + "d", RANDOM.nextInt(1_000_000));
        AuthOtpChallenge challenge = new AuthOtpChallenge();
        challenge.setUser(lockedUser);
        challenge.setOtpHash(passwordEncoder.encode(code));
        challenge.setPurpose(purpose);
        challenge.setGoogleSubject(subject);
        challenge.setDiscardUntrustedPassword(purpose == AuthOtpPurpose.GOOGLE_LINK && !lockedUser.isEmailVerified());
        challenge.setExpiresAt(now.plusSeconds(ttlSeconds));
        challenge.setAttempts(0);
        challenge.setCreatedAt(now);
        challengeRepository.save(challenge);

        EmailTemplateKey template = switch (purpose) {
            case EMAIL_VERIFICATION -> EmailTemplateKey.EMAIL_VERIFICATION;
            case PASSWORD_RESET -> EmailTemplateKey.PASSWORD_RESET;
            case GOOGLE_LINK -> EmailTemplateKey.GOOGLE_LINK;
        };
        Map<String, String> variables = Map.of("code", code, "minutes", String.valueOf(Math.max(1, ttlSeconds / 60)));
        boolean outboxEnabled = environment.getProperty("app.mail.outbox.enabled", Boolean.class, false);
        if (outboxEnabled) {
            // The outbox row is written in this transaction. Its encrypted
            // payload is cleared by the worker once delivery reaches a terminal state.
            emailOutbox.enqueue(template, lockedUser.getEmail(), variables,
                "auth-otp-" + challenge.getId(), lockedUser.getId(), challenge.getId(),
                purpose.name(), ttlSeconds);
        } else {
            // Without the durable outbox, SMTP is a best-effort side effect
            // after commit. Provider failures are logged by the mail boundary
            // and never roll back account creation or OTP issuance.
            emailSender.sendTemplateBestEffort(template, lockedUser.getEmail(), variables);
        }
    }

    private void verify(User user, AuthOtpPurpose purpose, String suppliedCode) {
        verify(user, purpose, suppliedCode, null);
    }

    private AuthOtpChallenge verify(User user, AuthOtpPurpose purpose, String suppliedCode, String subject) {
        // Codes are digit-only; mail clients and the verify form let grouped
        // separators through ("123 456", "123‑456" incl. NBSP and Unicode
        // dashes), so strip them before the hash comparison instead of failing
        // a well-meant paste.
        String code = suppliedCode == null ? "" : suppliedCode.trim()
            .replaceAll("[\\p{IsWhite_Space}\\p{Pd}]", "");
        AuthOtpChallenge challenge = challengeRepository
            .findActiveLatestForUpdate(user.getId(), purpose)
            .orElseGet(() -> challengeRepository.findLatestRecordForUpdate(user.getId(), purpose)
                .orElseThrow(this::invalidOtp));

        if (!java.util.Objects.equals(challenge.getGoogleSubject(), subject)) throw invalidOtp();

        OffsetDateTime now = OffsetDateTime.now();
        if (challenge.isConsumed()) {
            throw new OtpVerificationException(409, ErrorCodes.OTP_ALREADY_USED, "OTP has already been used");
        }
        if (challenge.isExpired(now)) {
            challenge.consume(now);
            challengeRepository.save(challenge);
            throw new OtpVerificationException(400, ErrorCodes.OTP_EXPIRED, "OTP has expired");
        }
        if (challenge.getAttempts() >= MAX_ATTEMPTS) {
            challenge.consume(now);
            challengeRepository.save(challenge);
            throw new OtpVerificationException(429, ErrorCodes.OTP_ATTEMPTS_EXCEEDED,
                "Too many invalid OTP attempts");
        }
        boolean matches = passwordEncoder.matches(code, challenge.getOtpHash())
            || (testOtpAllowed() && "123456".equals(code));
        if (!matches) {
            int attempts = challenge.getAttempts() + 1;
            challenge.setAttempts(attempts);
            if (attempts >= MAX_ATTEMPTS) {
                challenge.consume(now);
            }
            challengeRepository.save(challenge);
            if (attempts >= MAX_ATTEMPTS) {
                throw new OtpVerificationException(429, ErrorCodes.OTP_ATTEMPTS_EXCEEDED,
                    "Too many invalid OTP attempts");
            }
            throw invalidOtp();
        }

        challenge.consume(now);
        challengeRepository.save(challenge);
        return challenge;
    }

    private OtpVerificationException invalidOtp() {
        return new OtpVerificationException(400, ErrorCodes.INVALID_OTP, "Invalid or expired OTP");
    }

    /**
     * The fixed development code is double-gated like the booking test OTP:
     * an explicit opt-in flag AND the Spring "test" profile must both be
     * active. A deployment with email delivery disabled must never treat this
     * as a master code — anyone could otherwise reset any account's password.
     */
    private boolean testOtpAllowed() {
        return environment.getProperty("app.security.auth-otp.allow-test-otp", Boolean.class, false)
            && environment.acceptsProfiles(Profiles.of("test"));
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BusinessException(400, ErrorCodes.INVALID_OTP, "Invalid or expired OTP");
        }
        return email.trim().toLowerCase();
    }

    public long ttlSeconds() {
        return ttlSeconds;
    }

    public long resendCooldownSeconds() {
        return resendCooldownSeconds;
    }
}
