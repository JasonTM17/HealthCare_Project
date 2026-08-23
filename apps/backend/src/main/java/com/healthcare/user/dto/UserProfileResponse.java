package com.healthcare.user.dto;

import java.util.List;

public record UserProfileResponse(
    String id,
    String email,
    String displayName,
    String status,
    List<String> roles,
    boolean emailVerified
) {
    public UserProfileResponse(String id, String email, String displayName, String status, List<String> roles) {
        this(id, email, displayName, status, roles, true);
    }
}
