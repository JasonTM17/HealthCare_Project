package com.healthcare.auth;

import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.auth.dto.BrowserSessionCreateRequest;
import com.healthcare.auth.dto.BrowserSessionResponse;
import com.healthcare.auth.security.BrowserSessionContext;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
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
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Authentication APIs for login, register, and token management")
public class AuthController {

    private final AuthService authService;
    private final BrowserSessionService browserSessionService;

    public AuthController(
            AuthService authService,
            BrowserSessionService browserSessionService) {
        this.authService = authService;
        this.browserSessionService = browserSessionService;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new user", description = "Creates a new user account with PATIENT role")
    public ResponseEntity<RegistrationPendingResponse> register(@Valid @RequestBody RegisterRequest request,
                                                                 HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(authService.register(request, httpRequest));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password", description = "Authenticate user and return access + refresh tokens")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token", description = "Exchange a valid refresh token for new access + refresh tokens")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request));
    }

    @PostMapping({"/email-verifications/confirm", "/verify-email", "/confirm-email"})
    @Operation(summary = "Verify an email address", description = "Consumes the one-time email verification code and signs the user in")
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody EmailVerificationRequest request,
                                                     HttpServletRequest httpRequest) {
        return ResponseEntity.ok(authService.confirmEmail(request, httpRequest));
    }

    @PostMapping({"/email-verifications/resend", "/resend-verification", "/resend-email-verification"})
    @Operation(summary = "Resend email verification", description = "Returns a generic response whether or not an account is eligible")
    public ResponseEntity<AuthActionResponse> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(authService.resendVerification(request, httpRequest));
    }

    @PostMapping({"/password-reset-requests", "/forgot-password", "/password-reset/request", "/reset-password/request"})
    @Operation(summary = "Request a password reset", description = "Returns a generic response and sends a reset code when eligible")
    public ResponseEntity<AuthActionResponse> requestPasswordReset(
            @Valid @RequestBody PasswordResetRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(authService.requestPasswordReset(request, httpRequest));
    }

    @PostMapping({"/password-reset-requests/confirm", "/reset-password", "/password-reset/confirm", "/reset-password/confirm"})
    @Operation(summary = "Confirm a password reset", description = "Consumes a reset code and revokes all refresh sessions")
    public ResponseEntity<Void> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        authService.confirmPasswordReset(request, httpRequest);
        browserSessionService.clearCookies(httpResponse);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change password for authenticated user")
    public ResponseEntity<AuthActionResponse> changePassword(
            @Valid @RequestBody com.healthcare.user.dto.ChangePasswordRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        }
        authService.changePassword(userDetails.getUsername(), request.currentPassword(), request.newPassword());
        return ResponseEntity.ok(new AuthActionResponse("Mật khẩu đã được thay đổi thành công."));
    }

    @PostMapping("/browser-sessions")
    @Operation(summary = "Create a secure browser session", description = "Uses a password or email-verification grant and returns no bearer token")
    public ResponseEntity<BrowserSessionResponse> createBrowserSession(
            @Valid @RequestBody BrowserSessionCreateRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        BrowserSessionService.IssuedBrowserSession issued =
            authService.createBrowserSession(request, httpRequest);
        browserSessionService.writeIssuedCookies(httpResponse, issued);
        return ResponseEntity.ok(issued.response());
    }

    @GetMapping("/browser-sessions/current")
    @Operation(summary = "Get the current browser session", description = "Returns safe user and expiry metadata without session secrets")
    public ResponseEntity<BrowserSessionResponse> currentBrowserSession(
            @AuthenticationPrincipal HealthcareUserPrincipal principal,
            HttpServletRequest request) {
        BrowserSessionContext context = browserSessionService.context(request)
            .filter(value -> principal != null && value.userId().equals(principal.getUserId()))
            .orElseThrow(() -> new BusinessException(
                401,
                ErrorCodes.AUTHENTICATION_REQUIRED,
                "Browser session is required"
            ));
        return ResponseEntity.ok(browserSessionService.responseFor(context));
    }

    @DeleteMapping("/browser-sessions/current")
    @Operation(summary = "End the current browser session", description = "Revokes browser and refresh sessions for the authenticated user")
    public ResponseEntity<Void> deleteBrowserSession(
            @AuthenticationPrincipal HealthcareUserPrincipal principal,
            HttpServletRequest request,
            HttpServletResponse response) {
        BrowserSessionContext context = browserSessionService.context(request)
            .filter(value -> principal != null && value.userId().equals(principal.getUserId()))
            .orElseThrow(() -> new BusinessException(
                401,
                ErrorCodes.AUTHENTICATION_REQUIRED,
                "Browser session is required"
            ));
        authService.logout(context.userId());
        browserSessionService.clearCookies(response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout current user", description = "Revoke all refresh tokens for the authenticated user")
    public ResponseEntity<Map<String, String>> logout(
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletResponse response) {
        if (userDetails != null) {
            authService.logoutByEmail(userDetails.getUsername());
        }
        browserSessionService.clearCookies(response);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

}
