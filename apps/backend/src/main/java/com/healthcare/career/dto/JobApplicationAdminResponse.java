package com.healthcare.career.dto;

import java.time.OffsetDateTime;

public record JobApplicationAdminResponse(
    String id,
    String applicationCode,
    String jobId,
    String jobTitle,
    String fullName,
    String email,
    String phone,
    Integer yearsExperience,
    String coverLetter,
    String resumeUrl,
    String status,
    OffsetDateTime submittedAt,
    OffsetDateTime updatedAt
) {
    @com.fasterxml.jackson.annotation.JsonProperty("demonstrationNotice")
    public String demonstrationNotice() { return com.healthcare.demo.DashboardDemonstration.noticeForText(id); }
}
