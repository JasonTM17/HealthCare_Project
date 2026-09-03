package com.healthcare.auth;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.dto.AuthResponse;
import com.healthcare.user.dto.AuthActionResponse;
import com.healthcare.user.dto.EmailVerificationRequest;
import com.healthcare.user.dto.LoginRequest;
import com.healthcare.user.dto.PasswordResetConfirmRequest;
import com.healthcare.user.dto.PasswordResetRequest;
import com.healthcare.user.dto.RefreshTokenRequest;
import com.healthcare.user.dto.RegisterRequest;
import com.healthcare.user.dto.RegistrationPendingResponse;
import com.healthcare.user.dto.ResendVerificationRequest;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.appointment.service.AppointmentClaimService;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.auth.dto.BrowserSessionCreateRequest;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.notification.service.NotificationPreferenceService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AccountStatusException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final UserSecurityLock userSecurityLock;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final JwtProperties jwtProperties;
    private final PatientProfileRepository patientProfileRepository;
    private final AuthOtpService authOtpService;
    private final AuthRateLimiter authRateLimiter;
    private final AppointmentClaimService appointmentClaimService;
    private final BrowserSessionService browserSessionService;
    private final NotificationPreferenceService notificationPreferenceService;

    public AuthService(UserRepository userRepository,
                       UserSecurityLock userSecurityLock,
                       RoleRepository roleRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       JwtTokenProvider tokenProvider,
                       JwtProperties jwtProperties,
                       PatientProfileRepository patientProfileRepository,
                       AuthOtpService authOtpService,
                       AuthRateLimiter authRateLimiter,
                       AppointmentClaimService appointmentClaimService,
                       BrowserSessionService browserSessionService,
                       NotificationPreferenceService notificationPreferenceService) {
        this.userRepository = userRepository;
        this.userSecurityLock = userSecurityLock;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.jwtProperties = jwtProperties;
        this.patientProfileRepository = patientProfileRepository;
        this.authOtpService = authOtpService;
        this.authRateLimiter = authRateLimiter;
        this.appointmentClaimService = appointmentClaimService;
        this.browserSessionService = browserSessionService;
        this.notificationPreferenceService = notificationPreferenceService;
    }

    @Transactional
    public RegistrationPendingResponse register(RegisterRequest request) {
        return register(request, null);
    }

    @Transactional
    public RegistrationPendingResponse register(RegisterRequest request, HttpServletRequest httpRequest) {
        String normalizedEmail = request.email().toLowerCase().trim();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateResourceException(
                ErrorCodes.EMAIL_ALREADY_REGISTERED,
                "Email already registered"
            );
        }
        String normalizedPhone = normalizePhone(request.phone());
        PatientProfile reusableProfile = normalizedPhone == null
            ? null
            : patientProfileRepository.findByPhone(normalizedPhone).orElse(null);
        if (reusableProfile != null && (reusableProfile.getUserId() != null
                || reusableProfile.getEmail() == null
                || !normalizedEmail.equals(reusableProfile.getEmail().trim().toLowerCase()))) {
            throw new DuplicateResourceException("Phone number already registered");
        }

        Role patientRole = roleRepository.findByCode("PATIENT")
            .orElseThrow(() -> new ResourceNotFoundException("Default PATIENT role not found"));

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName());
        user.setStatus("ACTIVE");
        user.setEmailVerified(false);
        user.setEmailVerifiedAt(null);
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(patientRole);

        user = userRepository.save(user);
        // V45 materializes existing accounts once, while this idempotent
        // upsert covers registrations that happen after the migration.
        notificationPreferenceService.ensureDefaultsForUser(user.getId());

        if (normalizedPhone != null) {
            PatientProfile profile = reusableProfile == null ? new PatientProfile() : reusableProfile;
            profile.setFullName(request.displayName().trim());
            profile.setPhone(normalizedPhone);
            profile.setEmail(normalizedEmail);
            profile.setUserId(user.getId());
            patientProfileRepository.save(profile);
        }

        authOtpService.issueVerification(user, httpRequest);

        return new RegistrationPendingResponse(
            user.getEmail(),
            true,
            "If the account can receive email, a verification code has been sent.",
            authOtpService.ttlSeconds(),
            authOtpService.resendCooldownSeconds()
        );
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        return issueTokens(authenticatePasswordLocked(request));
    }

    private User authenticatePasswordLocked(LoginRequest request) {
        String normalizedEmail = request.email().toLowerCase().trim();
        authRateLimiter.checkEmail(normalizedEmail, "login");

        User user = userSecurityLock.findByEmailForUpdate(normalizedEmail)
            .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, request.password())
            );
        } catch (BadCredentialsException | AccountStatusException e) {
            throw new BadCredentialsException("Invalid email or password");
        }

        if (!user.isEmailVerified()) {
            throw new BusinessException(
                403,
                ErrorCodes.EMAIL_VERIFICATION_REQUIRED,
                "Email verification is required before login"
            );
        }
        return user;
    }

    @Transactional(noRollbackFor = OtpVerificationException.class)
    public AuthResponse confirmEmail(EmailVerificationRequest request, HttpServletRequest httpRequest) {
        return issueTokens(confirmEmailLocked(request, httpRequest));
    }

    private User confirmEmailLocked(
            EmailVerificationRequest request,
            HttpServletRequest httpRequest) {
        User user = authOtpService.confirmEmail(request.email(), request.code(), httpRequest);
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(user);
        appointmentClaimService.claimAfterEmailVerification(user);
        return user;
    }

    /**
     * Linearizes a browser grant, the stable user-row security lock, session
     * issuance and ambient-session rotation in one database transaction.
     */
    @Transactional(noRollbackFor = OtpVerificationException.class)
    public BrowserSessionService.IssuedBrowserSession createBrowserSession(
            BrowserSessionCreateRequest request,
            HttpServletRequest httpRequest) {
        User user = switch (request.grantType()) {
            case PASSWORD -> {
                requireGrantValue(request.password(), request.code());
                yield authenticatePasswordLocked(new LoginRequest(request.email(), request.password()));
            }
            case EMAIL_VERIFICATION -> {
                requireGrantValue(request.code(), request.password());
                yield confirmEmailLocked(
                    new EmailVerificationRequest(request.email(), request.code()),
                    httpRequest
                );
            }
        };

        String replacedSecret = browserSessionService.cookieValue(
            httpRequest,
            BrowserSessionService.SESSION_COOKIE_NAME
        );
        return browserSessionService.issueReplacing(user.getId(), replacedSecret);
    }

    @Transactional
    public AuthActionResponse resendVerification(ResendVerificationRequest request,
                                                  HttpServletRequest httpRequest) {
        authOtpService.resendVerification(request.email(), httpRequest);
        return new AuthActionResponse(
            "If the account is eligible, a verification code has been sent."
        );
    }

    @Transactional
    public AuthActionResponse requestPasswordReset(PasswordResetRequest request,
                                                    HttpServletRequest httpRequest) {
        authOtpService.requestPasswordReset(request.email(), httpRequest);
        return new AuthActionResponse(
            "If an account exists for that email, reset instructions have been sent."
        );
    }

    @Transactional(noRollbackFor = OtpVerificationException.class)
    public AuthActionResponse confirmPasswordReset(PasswordResetConfirmRequest request,
                                                    HttpServletRequest httpRequest) {
        User user = authOtpService.confirmPasswordReset(request.email(), request.token(), httpRequest);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(user);
        revokeAllUserTokensLocked(user);
        return new AuthActionResponse("Password reset completed.");
    }

    @Transactional
    public void changePassword(String email, String currentPassword, String newPassword) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new BadCredentialsException("Tài khoản không tồn tại"));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadCredentialsException("Mật khẩu hiện tại không chính xác");
        }
        if (newPassword == null || newPassword.trim().length() < 8) {
            throw new BusinessException(400, ErrorCodes.VALIDATION_ERROR, "Mật khẩu mới phải có ít nhất 8 ký tự");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(user);
    }

    @Transactional(noRollbackFor = BadCredentialsException.class)
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String token = request.refreshToken();

        if (!tokenProvider.isValid(token)) {
            throw new BadCredentialsException("Invalid refresh token");
        }

        if (!tokenProvider.isRefreshToken(token)) {
            throw new BadCredentialsException("Invalid refresh token");
        }

        UUID userId;
        try {
            userId = tokenProvider.extractUserId(token);
        } catch (RuntimeException e) {
            throw new BadCredentialsException("Invalid refresh token");
        }
        String tokenHash = hashToken(token);

        User user = userSecurityLock.findByIdForUpdate(userId)
            .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));

        RefreshToken storedToken = refreshTokenRepository.findByTokenHashForUpdate(tokenHash)
            .orElseThrow(() -> new BadCredentialsException("Refresh token not found"));

        UUID storedUserId = storedToken.getUser().getId();
        if (!storedUserId.equals(userId)) {
            throw new BadCredentialsException("Invalid refresh token");
        }

        if (storedToken.isRevoked() || storedToken.isExpired()) {
            revokeAllUserTokensLocked(user);
            throw new BadCredentialsException("Refresh token expired or revoked");
        }

        if (!"ACTIVE".equals(user.getStatus())) {
            revokeAllUserTokensLocked(user);
            throw new BadCredentialsException("Account is disabled");
        }

        if (!user.isEmailVerified()) {
            revokeAllUserTokensLocked(user);
            throw new BusinessException(
                403,
                ErrorCodes.EMAIL_VERIFICATION_REQUIRED,
                "Email verification is required before login"
            );
        }

        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getId());

        storedToken.setRevokedAt(OffsetDateTime.now());
        refreshTokenRepository.save(storedToken);
        saveRefreshToken(user, newRefreshToken);

        return buildAuthResponse(user, accessToken, newRefreshToken);
    }

    @Transactional
    public void logout(UUID userId) {
        User user = userSecurityLock.findByIdForUpdate(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        revokeAllUserTokensLocked(user);
    }

    @Transactional
    public void logoutByEmail(String email) {
        userSecurityLock.findByEmailForUpdate(email)
            .ifPresent(this::revokeAllUserTokensLocked);
    }

    private void saveRefreshToken(User user, String token) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(hashToken(token));
        refreshToken.setExpiresAt(OffsetDateTime.now().plus(jwtProperties.refreshTokenTtl(), ChronoUnit.SECONDS));
        refreshToken.setCreatedAt(OffsetDateTime.now());
        refreshTokenRepository.save(refreshToken);
    }

    private void revokeAllUserTokensLocked(User lockedUser) {
        refreshTokenRepository.findAllActiveByUserId(lockedUser.getId())
            .forEach(rt -> {
                rt.setRevokedAt(OffsetDateTime.now());
                refreshTokenRepository.save(rt);
            });
        browserSessionService.revokeAllForUser(lockedUser.getId(), "SECURITY_REVOKE_ALL");
    }

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        List<String> roles = user.getRoles().stream()
            .map(Role::getCode)
            .toList();

        return new AuthResponse(
            accessToken,
            refreshToken,
            "Bearer",
            jwtProperties.accessTokenTtl(),
            new AuthResponse.UserInfo(
                user.getId().toString(),
                user.getEmail(),
                user.getDisplayName(),
                roles,
                user.isEmailVerified()
            )
        );
    }

    private AuthResponse issueTokens(User user) {
        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = tokenProvider.generateRefreshToken(user.getId());
        saveRefreshToken(user, refreshToken);
        return buildAuthResponse(user, accessToken, refreshToken);
    }

    private void requireGrantValue(String required, String forbidden) {
        if (required == null || required.isBlank() || (forbidden != null && !forbidden.isBlank())) {
            throw new BusinessException(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "Browser session grant is invalid"
            );
        }
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    private String normalizePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        return phone.trim().replaceAll("[\\s().-]", "");
    }
}
