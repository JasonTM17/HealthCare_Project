package com.healthcare.auth;

import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.notification.service.NotificationPreferenceService;
import com.healthcare.security.DemoBoundaryProperties;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.dto.LoginRequest;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * HC-01/D-01: when {@code healthcare.demo.login-allowed=false}, a deployment
 * rejects shared demo personas at authentication with a professional, stable
 * error; ordinary accounts and the default demo deployment are unaffected.
 */
class DemoLoginPolicyTest {

    private UserSecurityLock userSecurityLock;
    private AuthenticationManager authenticationManager;
    private JwtTokenProvider tokenProvider;
    private RefreshTokenRepository refreshTokenRepository;
    private AuthService authService;
    private DemoBoundaryProperties demoBoundaryProperties;

    @BeforeEach
    void setUp() {
        userSecurityLock = Mockito.mock(UserSecurityLock.class);
        authenticationManager = Mockito.mock(AuthenticationManager.class);
        tokenProvider = Mockito.mock(JwtTokenProvider.class);
        refreshTokenRepository = Mockito.mock(RefreshTokenRepository.class);

        demoBoundaryProperties = new DemoBoundaryProperties();
        authService = new AuthService(
            Mockito.mock(UserRepository.class),
            userSecurityLock,
            Mockito.mock(RoleRepository.class),
            refreshTokenRepository,
            Mockito.mock(PasswordEncoder.class),
            authenticationManager,
            tokenProvider,
            new JwtProperties("unit-test-secret-value-with-enough-length", 900, 604800),
            Mockito.mock(PatientProfileRepository.class),
            Mockito.mock(AuthOtpService.class),
            Mockito.mock(AuthRateLimiter.class),
            Mockito.mock(AppointmentClaimService.class),
            Mockito.mock(BrowserSessionService.class),
            Mockito.mock(NotificationPreferenceService.class),
            demoBoundaryProperties
        );
    }

    @Test
    @DisplayName("login-allowed=false rejects a demo persona with 403 DEMO_LOGIN_DISABLED")
    void rejectsDemoPersonaWhenLoginDisabled() {
        demoBoundaryProperties.setLoginAllowed(false);
        User demoUser = user("admin@healthcare.com", true);
        when(userSecurityLock.findByEmailForUpdate("admin@healthcare.com")).thenReturn(Optional.of(demoUser));
        when(authenticationManager.authenticate(any()))
            .thenReturn(new UsernamePasswordAuthenticationToken("admin@healthcare.com", "unused"));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@healthcare.com", "whatever")))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> {
                BusinessException businessError = (BusinessException) error;
                assertThat(businessError.getStatus()).isEqualTo(403);
                assertThat(businessError.getCode()).isEqualTo(ErrorCodes.DEMO_LOGIN_DISABLED);
                assertThat(businessError.getMessage()).contains("disabled in this deployment");
            });
    }

    @Test
    @DisplayName("login-allowed=false still admits ordinary accounts")
    void admitsOrdinaryAccountWhenLoginDisabled() {
        demoBoundaryProperties.setLoginAllowed(false);
        User ordinaryUser = user("operator@example.com", false);
        when(userSecurityLock.findByEmailForUpdate("operator@example.com"))
            .thenReturn(Optional.of(ordinaryUser));
        when(authenticationManager.authenticate(any()))
            .thenReturn(new UsernamePasswordAuthenticationToken("operator@example.com", "unused"));
        when(tokenProvider.generateAccessToken(any(), anyString())).thenReturn("access");
        when(tokenProvider.generateRefreshToken(any())).thenReturn("refresh");

        var response = authService.login(new LoginRequest("operator@example.com", "whatever"));

        assertThat(response.accessToken()).isEqualTo("access");
        Mockito.verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("default demo deployment (login-allowed=true) keeps demo login usable")
    void keepsDemoLoginUsableByDefault() {
        User demoUser = user("admin@healthcare.com", true);
        when(userSecurityLock.findByEmailForUpdate("admin@healthcare.com")).thenReturn(Optional.of(demoUser));
        when(authenticationManager.authenticate(any()))
            .thenReturn(new UsernamePasswordAuthenticationToken("admin@healthcare.com", "unused"));
        when(tokenProvider.generateAccessToken(any(), anyString())).thenReturn("access");
        when(tokenProvider.generateRefreshToken(any())).thenReturn("refresh");

        var response = authService.login(new LoginRequest("admin@healthcare.com", "whatever"));

        assertThat(response.accessToken()).isEqualTo("access");
    }

    @Test
    @DisplayName("login-allowed=false also rejects refreshing a demo principal's session")
    void rejectsDemoRefreshWhenLoginDisabled() {
        demoBoundaryProperties.setLoginAllowed(false);
        UUID demoUserId = UUID.randomUUID();
        User demoUser = user("admin@healthcare.com", true);
        demoUser.setId(demoUserId);
        when(tokenProvider.isValid("refresh-token")).thenReturn(true);
        when(tokenProvider.isRefreshToken("refresh-token")).thenReturn(true);
        when(tokenProvider.extractUserId("refresh-token")).thenReturn(demoUserId);
        when(userSecurityLock.findByIdForUpdate(demoUserId)).thenReturn(Optional.of(demoUser));
        RefreshToken stored = new RefreshToken();
        stored.setUser(demoUser);
        stored.setTokenHash("ignored-for-guard");
        stored.setExpiresAt(OffsetDateTime.now().plusDays(1));
        when(refreshTokenRepository.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> authService.refreshToken(new com.healthcare.user.dto.RefreshTokenRequest("refresh-token")))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getCode())
                .isEqualTo(ErrorCodes.DEMO_LOGIN_DISABLED));
    }

    private User user(String email, boolean demo) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash("bcrypt-hash");
        user.setDisplayName("Fixture User");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setDemo(demo);
        return user;
    }
}
