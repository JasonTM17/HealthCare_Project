package com.healthcare.hospital.dto;

public record DoctorSummaryResponse(
    String id,
    String fullName,
    String slug,
    String photoUrl,
    String specialtyName,
    String branchId,
    boolean demo
) {
    /** Seed migrations label synthetic profiles with the demo-bs- slug prefix. */
    public static boolean isDemoSlug(String slug) {
        return slug != null && slug.startsWith("demo-bs-");
    }
}
