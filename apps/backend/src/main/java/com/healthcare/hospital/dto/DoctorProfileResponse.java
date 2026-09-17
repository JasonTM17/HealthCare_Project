package com.healthcare.hospital.dto;

import java.util.List;

/**
 * A doctor's own profile, including the AI credit balance they are entitled to
 * see.
 *
 * <p>The balance used to live on {@link DoctorResponse}, which the public
 * catalog, the appointment portal and the care-plan surfaces all share — so
 * every doctor's remaining quota was published to anonymous visitors on
 * {@code /api/v1/hospital/doctors}. Quota is internal accounting for the one
 * clinician it belongs to, so it moved here and only the authenticated profile
 * endpoints return this shape.
 */
public record DoctorProfileResponse(
    String id,
    String fullName,
    String slug,
    String bio,
    String photoUrl,
    String specialtyName,
    String branchId,
    List<String> branchIds,
    List<String> branchNames,
    List<String> specialtySlugs,
    String achievements,
    boolean demo,
    Integer aiCredits
) {

    /** Widen a public projection with the balance for the owning doctor. */
    public static DoctorProfileResponse of(DoctorResponse doctor, Integer aiCredits) {
        return new DoctorProfileResponse(
            doctor.id(),
            doctor.fullName(),
            doctor.slug(),
            doctor.bio(),
            doctor.photoUrl(),
            doctor.specialtyName(),
            doctor.branchId(),
            doctor.branchIds(),
            doctor.branchNames(),
            doctor.specialtySlugs(),
            doctor.achievements(),
            doctor.demo(),
            aiCredits
        );
    }
}
