package com.healthcare.career.entity;

/**
 * Review states of a job application.
 *
 * <p>Adding, renaming or removing a constant here changes the accepted values of
 * {@code PATCH /api/v1/admin/careers/applications/{id}/status}. The OpenAPI
 * description on {@code AdminCareerController#updateStatus} lists these values
 * as a literal string because an annotation cannot enumerate an enum, so that
 * annotation must be updated in the same change. A stale list is not cosmetic:
 * generated clients then send values this enum rejects.
 */
public enum ApplicationStatus {
    SUBMITTED,
    UNDER_REVIEW,
    INTERVIEW,
    OFFERED,
    REJECTED,
    WITHDRAWN
}
