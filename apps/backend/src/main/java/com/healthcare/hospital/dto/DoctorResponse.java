package com.healthcare.hospital.dto;

import java.util.List;

/**
 * Public projection of a doctor.
 *
 * <p>Carries no internal accounting: the AI credit balance moved to
 * {@link DoctorProfileResponse}, which only the authenticated profile endpoints
 * return. This shape is served by the public catalog and by the portal
 * appointment and care-plan surfaces, so anything added here is visible to
 * anonymous visitors.
 */
public record DoctorResponse(
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
    boolean demo
) {
    public DoctorResponse(
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
        String achievements
    ) {
        this(id, fullName, slug, bio, photoUrl, specialtyName, branchId, branchIds, branchNames, specialtySlugs, achievements, false);
    }
    public DoctorResponse(
        String id,
        String fullName,
        String slug,
        String bio,
        String photoUrl,
        String specialtyName,
        String branchId,
        List<String> branchIds,
        List<String> branchNames,
        List<String> specialtySlugs
    ) {
        this(id, fullName, slug, bio, photoUrl, specialtyName, branchId, branchIds, branchNames, specialtySlugs, null, false);
    }
}
