package com.healthcare.user.dto;

import java.util.List;

public record UserProfileResponse(
    String id,
    String email,
    String displayName,
    String status,
    List<String> roles
) {
}
