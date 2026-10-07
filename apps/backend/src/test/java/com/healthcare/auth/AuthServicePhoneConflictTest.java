package com.healthcare.auth;

import com.healthcare.appointment.entity.PatientProfile;
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
import com.healthcare.user.dto.RegistrationPendingResponse;
import com.healthcare.user.dto.RegisterRequest;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Container-free unit coverage for the split phone-conflict codes in
 * {@link AuthService#register(RegisterRequest, jakarta.servlet.http.HttpServletRequest)}.
 * The MockMvc flow in {@code AuthControllerTest} needs Testcontainers; these
 * cases only need the service collaborators, so they run anywhere.
 */
@ExtendWith(MockitoExtension.class)
class AuthServicePhoneConflictTest {

    private static final String OWNER_PHONE = "0901110001";
    private static final String GUEST_PHONE = "0902220002";

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

    private AuthService service() {
        return new AuthService(userRepository, userSecurityLock, roleRepository,
            refreshTokenRepository, passwordEncoder, authenticationManager, tokenProvider,
            jwtProperties, patientProfileRepository, authOtpService, authRateLimiter,
            appointmentClaimService, browserSessionService, notificationPreferenceService,
            demoBoundaryProperties,
            org.mockito.Mockito.mock(com.healthcare.auth.service.GoogleIdTokenVerifier.class));
    }

    private PatientProfile unboundProfile(String phone, String email) {
        PatientProfile profile = new PatientProfile();
        profile.setFullName("Guest Booked");
        profile.setPhone(phone);
        profile.setEmail(email);
        return profile;
    }

    private RegisterRequest request(String email, String phone) {
        return new RegisterRequest(email, "Str0ng!Pass", "Registrant", phone);
    }

    @Test
    void phoneBoundToAnotherAccountThrowsOwnedByAccountCode() {
        PatientProfile bound = unboundProfile(OWNER_PHONE, "owner@example.com");
        bound.setUserId(UUID.randomUUID());
        when(userRepository.existsByEmail("newcomer@example.com")).thenReturn(false);
        when(patientProfileRepository.findByPhone(OWNER_PHONE)).thenReturn(Optional.of(bound));

        assertThatThrownBy(() -> service().register(request("newcomer@example.com", OWNER_PHONE)))
            .isInstanceOfSatisfying(BusinessException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(409);
                assertThat(ex.getCode()).isEqualTo(ErrorCodes.PHONE_OWNED_BY_ACCOUNT);
                assertThat(ex.getMessage()).isEqualTo(
                    "Số điện thoại này đã liên kết một tài khoản khác — hãy đăng nhập hoặc dùng SĐT khác");
            });

        // The block is the point: nothing persists for the impostor.
        verify(userRepository, never()).save(any(User.class));
        verify(patientProfileRepository, never()).save(any(PatientProfile.class));
    }

    @Test
    void guestBookingPhoneWithMismatchedEmailThrowsBookingEmailCode() {
        when(userRepository.existsByEmail("wrong@example.com")).thenReturn(false);
        when(patientProfileRepository.findByPhone(GUEST_PHONE))
            .thenReturn(Optional.of(unboundProfile(GUEST_PHONE, "guest.booking@example.com")));

        assertThatThrownBy(() -> service().register(request("wrong@example.com", GUEST_PHONE)))
            .isInstanceOfSatisfying(BusinessException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(409);
                assertThat(ex.getCode()).isEqualTo(ErrorCodes.PHONE_LINKED_TO_BOOKING_EMAIL);
                assertThat(ex.getMessage()).isEqualTo(
                    "Số điện thoại này đã dùng đặt lịch với một email khác — hãy đăng ký bằng email bạn đã nhận mã xác nhận đặt lịch");
            });

        verify(userRepository, never()).save(any(User.class));
        verify(patientProfileRepository, never()).save(any(PatientProfile.class));
    }

    /**
     * Non-regression: the same phone with the SAME booking email still binds
     * the existing profile to the new account instead of erroring.
     */
    @Test
    void matchingBookingEmailStillReusesAndBindsProfile() {
        when(userRepository.existsByEmail("guest.booking@example.com")).thenReturn(false);
        when(patientProfileRepository.findByPhone(GUEST_PHONE))
            .thenReturn(Optional.of(unboundProfile(GUEST_PHONE, "guest.booking@example.com")));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(roleRepository.findByCode("PATIENT")).thenReturn(Optional.of(new Role()));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User persisted = inv.getArgument(0);
            persisted.setId(UUID.randomUUID());
            return persisted;
        });
        when(authOtpService.ttlSeconds()).thenReturn(600L);
        when(authOtpService.resendCooldownSeconds()).thenReturn(60L);
        when(patientProfileRepository.save(any(PatientProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        RegistrationPendingResponse response =
            service().register(request("guest.booking@example.com", GUEST_PHONE));

        assertThat(response.verificationRequired()).isTrue();
        verify(patientProfileRepository).save(argThat(saved ->
            saved.getUserId() != null
                && GUEST_PHONE.equals(saved.getPhone())
                && "guest.booking@example.com".equals(saved.getEmail())));
    }
}
