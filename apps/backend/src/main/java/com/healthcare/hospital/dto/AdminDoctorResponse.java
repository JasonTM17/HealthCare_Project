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
 * achievements, active} — and adds {@code branchIds}/{@code specialtyIds},
 * sourced from the same {@code doctor_branches}/{@code doctor_specialties}
 * link tables the public catalog uses ({@link
 * com.healthcare.hospital.repository.DoctorBranchRepository}).
 *
 * <p>{@code linkedUser} carries the attached login account so the admin
 * account-picker can show and change the current link — legitimate on this
 * ADMIN-only surface (the same identifiers are already exposed by
 * {@code GET /api/v1/admin/users}). It stays out of every public/protected
 * projection, per {@code DoctorQuotaExposureTest}, along with the AI credit
 * accounting.
 */
public record AdminDoctorResponse(
    String id,
    String fullName,
    String slug,
    String bio,
    String photoUrl,
    String achievements,
    boolean active,
    List<String> branchIds,
    List<String> specialtyIds,
    LinkedDoctorAccount linkedUser
) {
    /** The login account a doctor catalog entry is bound to. */
    public record LinkedDoctorAccount(String id, String email, String displayName) {}

    public static AdminDoctorResponse from(Doctor doctor, List<String> branchIds, List<String> specialtyIds) {
        return from(doctor, branchIds, specialtyIds, null);
    }

    public static AdminDoctorResponse from(
            Doctor doctor,
            List<String> branchIds,
            List<String> specialtyIds,
            LinkedDoctorAccount linkedUser) {
        return new AdminDoctorResponse(
            doctor.getId() == null ? null : doctor.getId().toString(),
            doctor.getFullName(),
            doctor.getSlug(),
            doctor.getBio(),
            doctor.getPhotoUrl(),
            doctor.getAchievements(),
            doctor.isActive(),
            branchIds == null ? List.of() : List.copyOf(branchIds),
            specialtyIds == null ? List.of() : List.copyOf(specialtyIds),
            linkedUser
        );
    }
}
