package com.healthcare.auth;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.security.CustomUserDetailsService;
import com.healthcare.security.JwtProperties;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.dto.AuthResponse;
import com.healthcare.user.dto.LoginRequest;
import com.healthcare.user.dto.RefreshTokenRequest;
import com.healthcare.user.dto.RegisterRequest;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.security.authentication.AuthenticationManager;
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
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final JwtProperties jwtProperties;

    public AuthService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       JwtTokenProvider tokenProvider,
                       JwtProperties jwtProperties) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.jwtProperties = jwtProperties;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.email().toLowerCase().trim();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateResourceException("Email already registered: " + normalizedEmail);
        }

        Role patientRole = roleRepository.findByCode("PATIENT")
            .orElseThrow(() -> new ResourceNotFoundException("Default PATIENT role not found"));

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName());
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(patientRole);

        user = userRepository.save(user);

        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refreshTokenString = tokenProvider.generateRefreshToken(user.getId());
        saveRefreshToken(user, refreshTokenString);

        return buildAuthResponse(user, accessToken, refreshTokenString);
    }

    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().toLowerCase().trim();

        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, request.password())
            );
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("Invalid email or password");
        }

        User user = userRepository.findWithRolesByEmail(normalizedEmail)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refreshTokenString = tokenProvider.generateRefreshToken(user.getId());
        saveRefreshToken(user, refreshTokenString);

        return buildAuthResponse(user, accessToken, refreshTokenString);
    }

    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String token = request.refreshToken();

        if (!tokenProvider.isValid(token)) {
            throw new BadCredentialsException("Invalid refresh token");
        }

        UUID userId = tokenProvider.extractUserId(token);
        String tokenHash = hashToken(token);

        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new BadCredentialsException("Refresh token not found"));

        if (storedToken.isRevoked() || storedToken.isExpired()) {
            revokeAllUserTokens(storedToken.getUser());
            throw new BadCredentialsException("Refresh token expired or revoked");
        }

        User user = userRepository.findWithRolesByEmail(storedToken.getUser().getEmail())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String accessToken = tokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getId());

        refreshTokenRepository.delete(storedToken);
        saveRefreshToken(user, newRefreshToken);

        return buildAuthResponse(user, accessToken, newRefreshToken);
    }

    @Transactional
    public void logout(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        revokeAllUserTokens(user);
    }

    @Transactional
    public void logoutByEmail(String email) {
        userRepository.findByEmail(email).ifPresent(this::revokeAllUserTokens);
    }

    private void saveRefreshToken(User user, String token) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(hashToken(token));
        refreshToken.setExpiresAt(OffsetDateTime.now().plus(jwtProperties.refreshTokenTtl(), ChronoUnit.SECONDS));
        refreshToken.setCreatedAt(OffsetDateTime.now());
        refreshTokenRepository.save(refreshToken);
    }

    private void revokeAllUserTokens(User user) {
        refreshTokenRepository.findAll().stream()
            .filter(rt -> rt.getUser().getId().equals(user.getId()) && !rt.isRevoked())
            .forEach(rt -> {
                rt.setRevokedAt(OffsetDateTime.now());
                refreshTokenRepository.save(rt);
            });
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
                roles
            )
        );
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
}
