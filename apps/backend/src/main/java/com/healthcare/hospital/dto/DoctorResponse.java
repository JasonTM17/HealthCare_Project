package com.healthcare.hospital.dto;

import java.util.List;

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
    String achievements
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
        List<String> specialtySlugs
    ) {
        this(id, fullName, slug, bio, photoUrl, specialtyName, branchId, branchIds, branchNames, specialtySlugs, null);
    }
}
