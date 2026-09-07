package com.healthcare.auth;

import com.healthcare.auth.entity.AuthOtpChallenge;
import com.healthcare.auth.entity.AuthOtpPurpose;
import com.healthcare.auth.mail.AfterCommitEmailSender;
import com.healthcare.auth.mail.EmailOutboxService;
import com.healthcare.auth.mail.EmailTemplateRenderer;
import com.healthcare.auth.repository.AuthOtpChallengeRepository;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The fixed development code must stay unusable unless the opt-in flag AND
 * the "test" profile are BOTH active; a mail-disabled deployment otherwise
 * hands out a universal password-reset code.
 */
class AuthOtpServiceMasterCodeTest {

    private AuthOtpChallengeRepository challengeRepository;
    private UserSecurityLock userSecurityLock;
    private PasswordEncoder passwordEncoder;
    private MockEnvironment environment;
    private AuthOtpService service;
    private AuthOtpChallenge challenge;

    @BeforeEach
    void setUp() {
        challengeRepository = mock(AuthOtpChallengeRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        userSecurityLock = mock(UserSecurityLock.class);
        passwordEncoder = mock(PasswordEncoder.class);
        AfterCommitEmailSender emailSender = mock(AfterCommitEmailSender.class);
        EmailOutboxService emailOutbox = mock(EmailOutboxService.class);
        EmailTemplateRenderer emailTemplates = mock(EmailTemplateRenderer.class);
        AuthRateLimiter rateLimiter = mock(AuthRateLimiter.class);
        environment = new MockEnvironment();

        service = new AuthOtpService(
            challengeRepository, userRepository, userSecurityLock, passwordEncoder,
            emailSender, emailOutbox, emailTemplates, rateLimiter, environment);

        challenge = new AuthOtpChallenge();
        challenge.setUser(new User());
        challenge.setPurpose(AuthOtpPurpose.PASSWORD_RESET);
        challenge.setAttempts(0);
        challenge.setCreatedAt(OffsetDateTime.now());
        challenge.setExpiresAt(OffsetDateTime.now().plusMinutes(10));
    }

    private OtpVerificationException verifyMasterCode() {
        when(userSecurityLock.findByEmailForUpdate(anyString()))
            .thenReturn(Optional.of(new User()));
        when(challengeRepository.findActiveLatestForUpdate(any(), any()))
            .thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches(anyString(), any())).thenReturn(false);
        return assertThrows(OtpVerificationException.class,
            () -> service.confirmPasswordReset("patient@example.test", "123456", null));
    }

    @Test
    void masterCodeIsRejectedWithoutTheTestProfileEvenWhenFlagIsSet() {
        environment.setProperty("app.security.auth-otp.allow-test-otp", "true");

        OtpVerificationException ex = verifyMasterCode();

        assertEquals(ErrorCodes.INVALID_OTP, ex.getCode());
        verify(challengeRepository).save(any(AuthOtpChallenge.class));
    }

    @Test
    void masterCodeIsRejectedWithTestProfileButWithoutTheFlag() {
        environment.setActiveProfiles("test");

        OtpVerificationException ex = verifyMasterCode();

        assertEquals(ErrorCodes.INVALID_OTP, ex.getCode());
    }

    @Test
    void masterCodeIsAcceptedOnlyWhenFlagAndTestProfileAreBothActive() {
        environment.setProperty("app.security.auth-otp.allow-test-otp", "true");
        environment.setActiveProfiles("test");
        when(userSecurityLock.findByEmailForUpdate(anyString()))
            .thenReturn(Optional.of(new User()));
        when(challengeRepository.findActiveLatestForUpdate(any(), any()))
            .thenReturn(Optional.of(challenge));

        service.confirmPasswordReset("patient@example.test", "123456", null);

        assertEquals(0, challenge.getAttempts());
        verify(challengeRepository).save(any(AuthOtpChallenge.class));
    }

    @Test
    void realOtpStillVerifiesThroughThePasswordEncoder() {
        when(userSecurityLock.findByEmailForUpdate(anyString()))
            .thenReturn(Optional.of(new User()));
        when(challengeRepository.findActiveLatestForUpdate(any(), any()))
            .thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("548102", challenge.getOtpHash())).thenReturn(true);

        service.confirmPasswordReset("patient@example.test", "548102", null);

        verify(passwordEncoder).matches("548102", challenge.getOtpHash());
        verify(challengeRepository).save(any(AuthOtpChallenge.class));
    }
}
