package com.healthcare.auth;

import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.auth.dto.BrowserSessionCreateRequest;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.auth.service.GoogleIdTokenVerifier;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ValidationException;
import com.healthcare.notification.service.NotificationPreferenceService;
import com.healthcare.security.DemoBoundaryProperties;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.dto.LoginRequest;
import com.healthcare.user.dto.PasswordResetConfirmRequest;
import com.healthcare.user.dto.RegisterRequest;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Container-free unit coverage for the 72-UTF-8-byte BCrypt input boundary:
 * the DTO constraint and the service guards that run before encode or
 * password verification.
 */
@ExtendWith(MockitoExtension.class)
class AuthServicePasswordBoundaryTest {

    private static final String PASSWORD_72_ASCII = "Aa1!" + "x".repeat(68);
    private static final String PASSWORD_73_ASCII = PASSWORD_72_ASCII + "y";
    private static final String PASSWORD_72_UTF8 = "Aa1!" + "é".repeat(34);
    private static final String PASSWORD_74_UTF8 = "Aa1!" + "é".repeat(35);

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserSecurityLock userSecurityLock;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private JwtProperties jwtProperties;

    @Mock
    private PatientProfileRepository patientProfileRepository;

    @Mock
    private AuthOtpService authOtpService;

    @Mock
    private AuthRateLimiter authRateLimiter;

    @Mock
    private AppointmentClaimService appointmentClaimService;

    @Mock
    private BrowserSessionService browserSessionService;

    @Mock
    private NotificationPreferenceService notificationPreferenceService;

    @Mock
    private DemoBoundaryProperties demoBoundaryProperties;

    @Mock
    private GoogleIdTokenVerifier googleIdTokenVerifier;

    private AuthService service() {
        return new AuthService(userRepository, userSecurityLock, roleRepository,
            refreshTokenRepository, passwordEncoder, authenticationManager, tokenProvider,
            jwtProperties, patientProfileRepository, authOtpService, authRateLimiter,
            appointmentClaimService, browserSessionService, notificationPreferenceService,
            demoBoundaryProperties, googleIdTokenVerifier);
    }

    private static RegisterRequest registerRequest(String password) {
        return new RegisterRequest("boundary@example.test", password, "Registrant", "0901234567");
    }

    private static void assertPasswordFieldError(ValidationException ex, String field) {
        assertThat(ex.getFieldErrors()).anyMatch(fe -> fe.field().equals(field));
    }

    @Test
    void registerRejects73BytePasswordBeforeAnyRepositoryOrHash() {
        assertThatThrownBy(() -> service().register(registerRequest(PASSWORD_73_ASCII)))
            .isInstanceOfSatisfying(ValidationException.class,
                ex -> assertPasswordFieldError(ex, "password"));

        verify(userRepository, never()).save(any());
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void registerRejects74ByteUtf8PasswordBeforeAnyRepositoryOrHash() {
        assertThatThrownBy(() -> service().register(registerRequest(PASSWORD_74_UTF8)))
            .isInstanceOfSatisfying(ValidationException.class,
                ex -> assertPasswordFieldError(ex, "password"));

        verify(userRepository, never()).save(any());
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void registerAccepts72ByteAsciiPasswordAtTheBoundary() {
        when(userRepository.existsByEmail("boundary@example.test")).thenReturn(false);
        when(roleRepository.findByCode("PATIENT")).thenReturn(Optional.of(new Role()));
        when(passwordEncoder.encode(PASSWORD_72_ASCII)).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User persisted = inv.getArgument(0);
            persisted.setId(UUID.randomUUID());
            return persisted;
        });
        when(authOtpService.ttlSeconds()).thenReturn(600L);
        when(authOtpService.resendCooldownSeconds()).thenReturn(60L);

        service().register(registerRequest(PASSWORD_72_ASCII));

        verify(passwordEncoder).encode(PASSWORD_72_ASCII);
        verify(userRepository).save(any(User.class));
    }

    @Test
    void registerAccepts72ByteUtf8PasswordAtTheBoundary() {
        when(userRepository.existsByEmail("boundary@example.test")).thenReturn(false);
        when(roleRepository.findByCode("PATIENT")).thenReturn(Optional.of(new Role()));
        when(passwordEncoder.encode(PASSWORD_72_UTF8)).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User persisted = inv.getArgument(0);
            persisted.setId(UUID.randomUUID());
            return persisted;
        });
        when(authOtpService.ttlSeconds()).thenReturn(600L);
        when(authOtpService.resendCooldownSeconds()).thenReturn(60L);

        service().register(registerRequest(PASSWORD_72_UTF8));

        verify(passwordEncoder).encode(PASSWORD_72_UTF8);
    }

    @Test
    void loginOver72BytePasswordNeverReachesAuthenticate() {
        User user = new User();
        user.setEmail("boundary@example.test");
        when(userSecurityLock.findByEmailForUpdate("boundary@example.test"))
            .thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service().login(
            new LoginRequest("boundary@example.test", PASSWORD_73_ASCII)))
            .isInstanceOf(BadCredentialsException.class)
            .hasMessage("Invalid email or password");

        verify(authenticationManager, never()).authenticate(any());
    }

    @Test
    void confirmPasswordResetRejectsOver72BeforeOtpConsumed() {
        assertThatThrownBy(() -> service().confirmPasswordReset(
            new PasswordResetConfirmRequest("boundary@example.test", "123456", PASSWORD_73_ASCII), null))
            .isInstanceOfSatisfying(ValidationException.class,
                ex -> assertPasswordFieldError(ex, "password"));

        verify(authOtpService, never()).confirmPasswordReset(anyString(), anyString(), any());
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void changePasswordRejectsOver72CurrentBeforeMatches() {
        User user = new User();
        user.setEmail("boundary@example.test");
        user.setPasswordHash("hash");
        when(userRepository.findByEmail("boundary@example.test")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service().changePassword(
            "boundary@example.test", PASSWORD_73_ASCII, "NewStr0ng!Pass", null))
            .isInstanceOf(BadCredentialsException.class);

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void changePasswordRejectsOver72NewBeforeEncode() {
        User user = new User();
        user.setEmail("boundary@example.test");
        user.setPasswordHash("hash");
        when(userRepository.findByEmail("boundary@example.test")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Curr3nt!Pass", "hash")).thenReturn(true);

        assertThatThrownBy(() -> service().changePassword(
            "boundary@example.test", "Curr3nt!Pass", PASSWORD_73_ASCII, null))
            .isInstanceOfSatisfying(ValidationException.class,
                ex -> assertPasswordFieldError(ex, "newPassword"));

        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void changePasswordAcceptsWhitespacePaddedEightCharacterNewPassword() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("boundary@example.test");
        user.setPasswordHash("hash");
        when(userRepository.findByEmail("boundary@example.test")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Curr3nt!Pass", "hash")).thenReturn(true);
        when(passwordEncoder.encode(" Aa1!xx ")).thenReturn("hashed");

        service().changePassword("boundary@example.test", "Curr3nt!Pass", " Aa1!xx ", null);

        verify(passwordEncoder).encode(" Aa1!xx ");
        verify(refreshTokenRepository).findAllActiveByUserId(user.getId());
        verify(browserSessionService).revokeOthersForUser(user.getId(), null, "PASSWORD_CHANGED");
    }

    @Test
    void googleStaffProofOver72NeverReachesMatches() {
        Role doctorRole = new Role();
        doctorRole.setCode("DOCTOR");
        User staff = new User();
        staff.setEmail("doctor@example.test");
        staff.setStatus("ACTIVE");
        staff.setEmailVerified(true);
        staff.setPasswordHash("hash");
        staff.addRole(doctorRole);
        GoogleIdTokenVerifier.GoogleIdentity identity =
            new GoogleIdTokenVerifier.GoogleIdentity("sub-1", "doctor@example.test", "Doc", true);
        when(googleIdTokenVerifier.verify("id-token")).thenReturn(identity);
        when(userSecurityLock.findByGoogleSubjectForUpdate("sub-1")).thenReturn(Optional.empty());
        when(userSecurityLock.findByEmailForUpdate("doctor@example.test")).thenReturn(Optional.of(staff));

        BrowserSessionCreateRequest grant = new BrowserSessionCreateRequest(
            BrowserSessionCreateRequest.GrantType.GOOGLE, null, PASSWORD_73_ASCII, null, "id-token");

        assertThatThrownBy(() -> service().createBrowserSession(grant, null))
            .isInstanceOfSatisfying(BadCredentialsException.class,
                ex -> assertThat(ex.getMessage()).isEqualTo("Invalid local account proof"));

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void dtoConstraintFlags73ByteAscii() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertThat(validator.validate(registerRequest(PASSWORD_73_ASCII)))
            .anyMatch(v -> v.getPropertyPath().toString().equals("password"));
    }

    @Test
    void dtoConstraintAccepts72ByteAscii() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertThat(validator.validate(registerRequest(PASSWORD_72_ASCII)))
            .noneMatch(v -> v.getPropertyPath().toString().equals("password")
                && v.getMessage().contains("72"));
    }

    @Test
    void dtoConstraintFlags74ByteUtf8() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertThat(validator.validate(registerRequest(PASSWORD_74_UTF8)))
            .anyMatch(v -> v.getPropertyPath().toString().equals("password"));
    }

    @Test
    void dtoConstraintAccepts72ByteUtf8() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertThat(validator.validate(registerRequest(PASSWORD_72_UTF8)))
            .noneMatch(v -> v.getPropertyPath().toString().equals("password")
                && v.getMessage().contains("72"));
    }
}
