package com.healthcare.auth;

import com.healthcare.auth.entity.AuthOtpChallenge;
import com.healthcare.auth.entity.AuthOtpPurpose;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.auth.repository.AuthOtpChallengeRepository;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

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
    private final AuthRateLimiter rateLimiter;
    private final long ttlSeconds;
    private final long resendCooldownSeconds;

    public AuthOtpService(AuthOtpChallengeRepository challengeRepository,
                          UserRepository userRepository,
                          UserSecurityLock userSecurityLock,
                          PasswordEncoder passwordEncoder,
                          AfterCommitEmailSender emailSender,
                          AuthRateLimiter rateLimiter,
                          Environment environment) {
        this.challengeRepository = challengeRepository;
        this.userRepository = userRepository;
        this.userSecurityLock = userSecurityLock;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
        this.rateLimiter = rateLimiter;
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
        User lockedUser = userSecurityLock.findByIdForUpdate(user.getId())
            .orElseThrow(() -> new IllegalStateException("OTP owner no longer exists"));
        OffsetDateTime now = OffsetDateTime.now();
        List<AuthOtpChallenge> activeChallenges = challengeRepository
            .findActiveForUpdate(lockedUser.getId(), purpose);
        boolean withinCooldown = activeChallenges.stream()
            .anyMatch(challenge -> !challenge.isExpired(now)
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
        challenge.setExpiresAt(now.plusSeconds(ttlSeconds));
        challenge.setAttempts(0);
        challenge.setCreatedAt(now);
        challengeRepository.save(challenge);

        String subject = purpose == AuthOtpPurpose.EMAIL_VERIFICATION
            ? "HealthCare email verification"
            : "HealthCare password reset";
        String body = "Your HealthCare security code is " + code
            + ". It expires in " + Math.max(1, ttlSeconds / 60)
            + " minutes. If you did not request this, you can ignore this email.";
        // The body is delivered only through the mail boundary; it is never logged or returned.
        emailSender.send(lockedUser.getEmail(), subject, body);
    }

    private void verify(User user, AuthOtpPurpose purpose, String suppliedCode) {
        String code = suppliedCode == null ? "" : suppliedCode.trim();
        AuthOtpChallenge challenge = challengeRepository
            .findActiveLatestForUpdate(user.getId(), purpose)
            .orElseGet(() -> challengeRepository.findLatestRecordForUpdate(user.getId(), purpose)
                .orElseThrow(this::invalidOtp));

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
        if (!passwordEncoder.matches(code, challenge.getOtpHash())) {
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
    }

    private OtpVerificationException invalidOtp() {
        return new OtpVerificationException(400, ErrorCodes.INVALID_OTP, "Invalid or expired OTP");
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
