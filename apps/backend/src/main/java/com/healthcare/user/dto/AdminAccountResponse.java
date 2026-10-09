package com.healthcare.user.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Explicit inventory; never serialize identity entities or authentication material. */
public record AdminAccountResponse(UUID id, String email, String displayName, String status,
    List<String> roles, boolean emailVerified, OffsetDateTime emailVerifiedAt, boolean demo,
    OffsetDateTime createdAt, OffsetDateTime updatedAt, long version, DoctorProfile doctorProfile,
    UUID patientProfileId, boolean googleLinked, String phone, UUID doctorProfileId) {
    public record DoctorProfile(UUID id, String slug, String fullName, boolean active) { }
}
