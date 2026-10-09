package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * @param branchIds    replacement set for {@code doctor_branches} links;
 *                     {@code null} leaves assignments untouched, an empty list
 *                     clears them.
 * @param specialtyIds same semantics for {@code doctor_specialties}.
 * @param userId       link this catalog record to a login account holding the
 *                     DOCTOR role; {@code null} leaves the current link
 *                     untouched.
 * @param unlinkUser   explicitly clears the account link — needed because a
 *                     {@code null} {@code userId} means "keep as is", not
 *                     "remove". Rejected when combined with {@code userId}.
 */
public record DoctorRequest(
    @NotBlank @Size(max = 160) String fullName,
    @NotBlank @Size(max = 180) String slug,
    @Size(max = 4000) String bio,
    @Size(max = 500) String photoUrl,
    boolean active,
    UUID userId,
    boolean unlinkUser,
    List<UUID> branchIds,
    List<UUID> specialtyIds
) {
}
