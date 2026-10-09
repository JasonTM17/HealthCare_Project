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
    private AuthOtpService authOtpService;
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
        authOtpService = Mockito.mock(AuthOtpService.class);
        httpRequest = Mockito.mock(HttpServletRequest.class);

        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        Role patientRole = new Role();
        patientRole.setCode("PATIENT");
        when(roleRepository.findByCode("PATIENT")).thenReturn(Optional.of(patientRole));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
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
            authOtpService, authRateLimiter,
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
            .thenReturn(new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "new@gmail.com", "New Patient"));
        when(userSecurityLock.findByEmailForUpdate("new@gmail.com")).thenReturn(Optional.empty());

        authService.createBrowserSession(googleGrant("good-token"), httpRequest);

        verify(browserSessionService).issueReplacing(any(), any());
        verify(authRateLimiter).checkEmail("new@gmail.com", "login");
    }

    @Test
    @DisplayName("provisioned account is PATIENT, ACTIVE and email-verified")
    void provisionedAccountShape() {
        when(googleIdTokenVerifier.verify("good-token"))
            .thenReturn(new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "new@gmail.com", "New Patient"));
        when(userSecurityLock.findByEmailForUpdate("new@gmail.com")).thenReturn(Optional.empty());

        authService.createBrowserSession(googleGrant("good-token"), httpRequest);

        org.mockito.ArgumentCaptor<User> captor = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(userRepository, Mockito.atLeastOnce()).saveAndFlush(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getEmail()).isEqualTo("new@gmail.com");
        assertThat(saved.getGoogleSubject()).isEqualTo("sub-1");
        assertThat(saved.isEmailVerified()).isTrue();
        assertThat(saved.getRoles()).extracting(Role::getCode).contains("PATIENT");
        assertThat(saved.getStatus()).isEqualTo("ACTIVE");
        verify(notificationPreferenceService).ensureDefaultsForUser(any());
    }

    @Test
    @DisplayName("existing unverified account becomes verified and is not re-provisioned")
    void linksExistingAccount() {
        User existing = new User();
        existing.setEmail("existing@gmail.com");
        existing.setPasswordHash("untrusted-reservation-hash");
        existing.setEmailVerified(false);
        existing.setStatus("ACTIVE");
        when(googleIdTokenVerifier.verify("good-token"))
            .thenReturn(new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "existing@gmail.com", "E P"));
        when(userSecurityLock.findByEmailForUpdate("existing@gmail.com"))
            .thenReturn(Optional.of(existing));

        authService.createBrowserSession(googleGrant("good-token"), httpRequest);

        assertThat(existing.isEmailVerified()).isTrue();
        assertThat(existing.getPasswordHash()).isNotEqualTo("untrusted-reservation-hash");
        assertThat(existing.getGoogleSubject()).isEqualTo("sub-1");
        assertThat(existing.getSecurityVersion()).isEqualTo(1L);
        verify(authOtpService).invalidateAll(existing);
        verify(browserSessionService).revokeAllForUser(any(), anyString());
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
            BrowserSessionCreateRequest.GrantType.GOOGLE, null, "synthetic-local-proof", "654321", "token");

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

    private User existing(String email, String roleCode, boolean verified) {
        User user = new User();
        user.setId(java.util.UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash("legitimate-local-hash");
        user.setEmailVerified(verified);
        user.setStatus("ACTIVE");
        Role role = new Role(); role.setCode(roleCode); user.addRole(role);
        return user;
    }

    @Test
    void returningSubjectKeepsLocalEmailAndPassword() {
        User user = existing("original@example.com", "PATIENT", true);
        user.setGoogleSubject("bound-subject");
        when(googleIdTokenVerifier.verify("synthetic-token")).thenReturn(
            new GoogleIdTokenVerifier.GoogleIdentity("bound-subject", "changed@example.com", "Changed", false));
        when(userSecurityLock.findByGoogleSubjectForUpdate("bound-subject")).thenReturn(Optional.of(user));
        authService.createBrowserSession(googleGrant("synthetic-token"), httpRequest);
        assertThat(user.getEmail()).isEqualTo("original@example.com");
        assertThat(user.getPasswordHash()).isEqualTo("legitimate-local-hash");
        verify(userSecurityLock, never()).findByEmailForUpdate(anyString());
    }

    @Test
    void thirdPartyEmailCannotLogInWithoutCurrentProof() {
        when(googleIdTokenVerifier.verify("synthetic-token")).thenReturn(
            new GoogleIdTokenVerifier.GoogleIdentity("stale-subject", "mailbox@example.com", "Mailbox", false));
        User user = existing("mailbox@example.com", "PATIENT", true);
        when(userSecurityLock.findByEmailForUpdate(user.getEmail())).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> authService.createBrowserSession(googleGrant("synthetic-token"), httpRequest))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode()).isEqualTo("GOOGLE_EMAIL_PROOF_REQUIRED");
        assertThat(user.getGoogleSubject()).isNull();
        verify(browserSessionService, never()).issueReplacing(any(), any());
    }

    @Test
    void firstStaffLinkRequiresFreshPasswordThenPreservesRoles() {
        User user = existing("staff@gmail.com", "ADMIN", true);
        when(googleIdTokenVerifier.verify("synthetic-token")).thenReturn(
            new GoogleIdTokenVerifier.GoogleIdentity("staff-subject", user.getEmail(), "Staff", true));
        when(userSecurityLock.findByEmailForUpdate(user.getEmail())).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> authService.createBrowserSession(googleGrant("synthetic-token"), httpRequest))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode()).isEqualTo("GOOGLE_REAUTH_REQUIRED");
        when(passwordEncoder.matches("synthetic-proof", user.getPasswordHash())).thenReturn(true);
        authService.createBrowserSession(new BrowserSessionCreateRequest(
            BrowserSessionCreateRequest.GrantType.GOOGLE, null, "synthetic-proof", null, "synthetic-token"), httpRequest);
        assertThat(user.getRoles()).extracting(Role::getCode).containsExactly("ADMIN");
        assertThat(user.getPasswordHash()).isEqualTo("legitimate-local-hash");
        assertThat(user.getGoogleSubject()).isEqualTo("staff-subject");
    }

    @Test
    void differentSubjectCannotReplaceExistingBinding() {
        User user = existing("patient@gmail.com", "PATIENT", true);
        user.setGoogleSubject("original-subject");
        when(googleIdTokenVerifier.verify("synthetic-token")).thenReturn(
            new GoogleIdTokenVerifier.GoogleIdentity("different-subject", user.getEmail(), "Other", true));
        when(userSecurityLock.findByEmailForUpdate(user.getEmail())).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> authService.createBrowserSession(googleGrant("synthetic-token"), httpRequest))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getStatus()).isEqualTo(409);
        assertThat(user.getGoogleSubject()).isEqualTo("original-subject");
    }
}
