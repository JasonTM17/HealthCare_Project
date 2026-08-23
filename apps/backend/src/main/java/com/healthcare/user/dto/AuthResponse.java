package com.healthcare.user.dto;

import java.util.List;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long expiresIn,
    UserInfo user
) {
    public record UserInfo(
        String id,
        String email,
        String displayName,
        List<String> roles,
        boolean emailVerified
    ) {
        public UserInfo(String id, String email, String displayName, List<String> roles) {
            this(id, email, displayName, roles, true);
        }
    }
}
