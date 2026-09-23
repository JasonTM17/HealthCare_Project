package com.healthcare.hospital.dto;

import com.healthcare.hospital.entity.Doctor;

import java.util.List;

/**
 * Admin projection of a doctor, returned by {@code GET /api/v1/admin/doctors}.
 *
 * <p>The admin schedules page filters the branch dropdown of its "Tạo lịch"
 * form by {@code doctor.branchIds} (see apps/frontend/app/admin/schedules/page.tsx);
 * the raw {@link Doctor} entity carries no such association, so the previous
 * entity-as-response shape collapsed that dropdown to zero options and made
 * schedule creation impossible. This DTO keeps every key the entity already
 * serialised for the admin UI — {@code id, fullName, slug, bio, photoUrl,
 * achievements, active} — and adds {@code branchIds}, sourced from the same
 * {@code doctor_branches} link table the public catalog uses
 * ({@link com.healthcare.hospital.repository.DoctorBranchRepository}).
 *
 * <p>Deliberately excluded, matching the entity's current hidden fields
 * (see {@code DoctorQuotaExposureTest}): the internal {@code userId} linkage and
 * the AI credit accounting. Only {@code branchIds} is added relative to the
 * entity's previous JSON.
 */
public record AdminDoctorResponse(
    String id,
    String fullName,
    String slug,
    String bio,
    String photoUrl,
    String achievements,
    boolean active,
    List<String> branchIds
) {
    public static AdminDoctorResponse from(Doctor doctor, List<String> branchIds) {
        return new AdminDoctorResponse(
            doctor.getId() == null ? null : doctor.getId().toString(),
            doctor.getFullName(),
            doctor.getSlug(),
            doctor.getBio(),
            doctor.getPhotoUrl(),
            doctor.getAchievements(),
            doctor.isActive(),
            branchIds == null ? List.of() : List.copyOf(branchIds)
        );
    }
}
