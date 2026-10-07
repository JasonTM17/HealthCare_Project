package com.healthcare.auth;

import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.auth.dto.BrowserSessionCreateRequest;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.auth.service.GoogleIdTokenVerifier;
import com.healthcare.exception.BusinessException;
import com.healthcare.notification.service.NotificationPreferenceService;
import com.healthcare.security.DemoBoundaryProperties;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The GOOGLE browser-session grant: identity comes from the verified ID token
 * (never from request fields), unknown emails provision a verified patient,
 * existing unverified accounts get linked and verified, suspended accounts
 * and malformed grant combinations fail closed.
 */
class AuthServiceGoogleGrantTest {

    private UserRepository userRepository;
    private UserSecurityLock userSecurityLock;
    private RoleRepository roleRepository;
    private PasswordEncoder passwordEncoder;
    private AuthRateLimiter authRateLimiter;
    private BrowserSessionService browserSessionService;
    private NotificationPreferenceService notificationPreferenceService;
    private GoogleIdTokenVerifier googleIdTokenVerifier;
    private AuthService authService;
    private HttpServletRequest httpRequest;

    @BeforeEach
    void setUp() {
        userRepository = Mockito.mock(UserRepository.class);
        userSecurityLock = Mockito.mock(UserSecurityLock.class);
        roleRepository = Mockito.mock(RoleRepository.class);
        passwordEncoder = Mockito.mock(PasswordEncoder.class);
        authRateLimiter = Mockito.mock(AuthRateLimiter.class);
        browserSessionService = Mockito.mock(BrowserSessionService.class);
        notificationPreferenceService = Mockito.mock(NotificationPreferenceService.class);
        googleIdTokenVerifier = Mockito.mock(GoogleIdTokenVerifier.class);
        httpRequest = Mockito.mock(HttpServletRequest.class);

        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        Role patientRole = new Role();
        patientRole.setCode("PATIENT");
        when(roleRepository.findByCode("PATIENT")).thenReturn(Optional.of(patientRole));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(browserSessionService.issueReplacing(any(), any()))
            .thenReturn(Mockito.mock(BrowserSessionService.IssuedBrowserSession.class));

        authService = new AuthService(
            userRepository, userSecurityLock, roleRepository,
            Mockito.mock(RefreshTokenRepository.class), passwordEncoder,
            Mockito.mock(AuthenticationManager.class),
            Mockito.mock(JwtTokenProvider.class),
            new JwtProperties("unit-test-secret-value-with-enough-length", 900, 604800),
            Mockito.mock(PatientProfileRepository.class),
            Mockito.mock(AuthOtpService.class), authRateLimiter,
            Mockito.mock(AppointmentClaimService.class),
            browserSessionService, notificationPreferenceService,
            new DemoBoundaryProperties(), googleIdTokenVerifier);
    }

    private BrowserSessionCreateRequest googleGrant(String token) {
        return new BrowserSessionCreateRequest(
            BrowserSessionCreateRequest.GrantType.GOOGLE, null, null, null, token);
    }

    @Test
    @DisplayName("unknown Google email provisions a verified PATIENT and issues a session")
    void provisionsVerifiedPatient() {
        when(googleIdTokenVerifier.verify("good-token"))
            .thenReturn(new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "new@patient.dev", "New Patient"));
        when(userSecurityLock.findByEmailForUpdate("new@patient.dev")).thenReturn(Optional.empty());

        authService.createBrowserSession(googleGrant("good-token"), httpRequest);

        verify(browserSessionService).issueReplacing(any(), any());
        verify(authRateLimiter).checkEmail("new@patient.dev", "login");
    }

    @Test
    @DisplayName("provisioned account is PATIENT, ACTIVE and email-verified")
    void provisionedAccountShape() {
        when(googleIdTokenVerifier.verify("good-token"))
            .thenReturn(new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "new@patient.dev", "New Patient"));
        when(userSecurityLock.findByEmailForUpdate("new@patient.dev")).thenReturn(Optional.empty());

        authService.createBrowserSession(googleGrant("good-token"), httpRequest);

        org.mockito.ArgumentCaptor<User> captor = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(userRepository, Mockito.atLeastOnce()).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getEmail()).isEqualTo("new@patient.dev");
        assertThat(saved.isEmailVerified()).isTrue();
        assertThat(saved.getRoles()).extracting(Role::getCode).contains("PATIENT");
        assertThat(saved.getStatus()).isEqualTo("ACTIVE");
        verify(notificationPreferenceService).ensureDefaultsForUser(any());
    }

    @Test
    @DisplayName("existing unverified account becomes verified and is not re-provisioned")
    void linksExistingAccount() {
        User existing = new User();
        existing.setEmail("existing@patient.dev");
        existing.setEmailVerified(false);
        existing.setStatus("ACTIVE");
        when(googleIdTokenVerifier.verify("good-token"))
            .thenReturn(new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "existing@patient.dev", "E P"));
        when(userSecurityLock.findByEmailForUpdate("existing@patient.dev"))
            .thenReturn(Optional.of(existing));

        authService.createBrowserSession(googleGrant("good-token"), httpRequest);

        assertThat(existing.isEmailVerified()).isTrue();
        verify(roleRepository, never()).findByCode("PATIENT");
    }

    @Test
    @DisplayName("suspended account is denied even with a valid Google token")
    void suspendedAccountDenied() {
        User suspended = new User();
        suspended.setEmail("locked@patient.dev");
        suspended.setEmailVerified(true);
        suspended.setStatus("SUSPENDED");
        when(googleIdTokenVerifier.verify("good-token"))
            .thenReturn(new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "locked@patient.dev", "L P"));
        when(userSecurityLock.findByEmailForUpdate("locked@patient.dev"))
            .thenReturn(Optional.of(suspended));

        assertThatThrownBy(() -> authService.createBrowserSession(googleGrant("good-token"), httpRequest))
            .isInstanceOf(BadCredentialsException.class);
        verify(browserSessionService, never()).issueReplacing(any(), any());
    }

    @Test
    @DisplayName("GOOGLE grant carrying password or code fields is a 400, never a login")
    void grantCombinationRejected() {
        BrowserSessionCreateRequest mixed = new BrowserSessionCreateRequest(
            BrowserSessionCreateRequest.GrantType.GOOGLE, null, "hunter2", null, "token");

        assertThatThrownBy(() -> authService.createBrowserSession(mixed, httpRequest))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(400);
        verify(googleIdTokenVerifier, never()).verify(anyString());
    }

    @Test
    @DisplayName("GOOGLE grant without a token is a 400")
    void missingTokenRejected() {
        assertThatThrownBy(() -> authService.createBrowserSession(googleGrant(" "), httpRequest))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(400);
        verify(googleIdTokenVerifier, never()).verify(anyString());
    }

    @Test
    @DisplayName("PASSWORD grant without email is a 400, not an NPE")
    void passwordGrantRequiresEmail() {
        BrowserSessionCreateRequest noEmail = new BrowserSessionCreateRequest(
            BrowserSessionCreateRequest.GrantType.PASSWORD, null, "secret", null, null);

        assertThatThrownBy(() -> authService.createBrowserSession(noEmail, httpRequest))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(400);
    }
}
