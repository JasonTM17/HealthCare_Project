package com.healthcare.auth;

import com.healthcare.security.CustomUserDetailsService;
import com.healthcare.user.dto.AuthResponse;
import com.healthcare.user.dto.LoginRequest;
import com.healthcare.user.dto.RefreshTokenRequest;
import com.healthcare.user.dto.RegisterRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Authentication APIs for login, register, and token management")
public class AuthController {

    private final AuthService authService;
    private final CustomUserDetailsService userDetailsService;

    public AuthController(AuthService authService, CustomUserDetailsService userDetailsService) {
        this.authService = authService;
        this.userDetailsService = userDetailsService;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new user", description = "Creates a new user account with PATIENT role")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
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

    @PostMapping("/logout")
    @Operation(summary = "Logout current user", description = "Revoke all refresh tokens for the authenticated user")
    public ResponseEntity<Map<String, String>> logout(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails != null) {
            authService.logoutByEmail(userDetails.getUsername());
        }
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}
