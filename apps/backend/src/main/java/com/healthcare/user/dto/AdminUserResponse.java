package com.healthcare.user.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Admin account-inventory row. Identity comes from {@code users}; the optional
 * profile ids and phone come from the linked {@code patient_profiles}/{@code
 * doctors} row when one exists, so operators can see which real-world record a
 * credential belongs to.
 */
public record AdminUserResponse(
    UUID id,
    String email,
    String displayName,
    String status,
    List<String> roles,
    boolean emailVerified,
    boolean demo,
    String phone,
    UUID patientProfileId,
    UUID doctorProfileId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
