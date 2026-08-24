package com.healthcare.consultation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Public, deliberately small contracts for the patient-to-doctor channel. */
public final class ConsultationContracts {
    private ConsultationContracts() {}

    public record CreateRequest(
            @NotNull UUID appointmentId,
            @NotBlank @Size(max = 240) String subject,
            @NotNull Boolean consentAccepted,
            @Size(max = 64) String consentVersion) {}

    public record MessageRequest(@NotBlank @Size(max = 4000) String body) {}

    public record AttachmentIntentRequest(
            @NotNull UUID messageId,
            @NotBlank @Size(max = 120) String mimeType,
            @NotNull Long sizeBytes,
            @NotBlank @Size(min = 64, max = 64) String sha256Hash,
            @NotBlank @Size(max = 512) String objectKey) {}

    public record AttachmentCompleteRequest(@NotNull Boolean clean) {}

    public record ReadRequest(UUID lastReadMessageId) {}

    public record HandoffRequest(@NotNull UUID doctorId) {}

    public record ConsultationSummary(
            UUID id,
            UUID appointmentId,
            UUID doctorId,
            String doctorName,
            String subject,
            String status,
            OffsetDateTime openUntil,
            OffsetDateTime updatedAt,
            long unreadCount) {}

    public record Message(
            UUID id,
            UUID authorUserId,
            String authorRole,
            String body,
            String status,
            OffsetDateTime createdAt,
            List<Attachment> attachments) {}

    public record Attachment(
            UUID id,
            String mimeType,
            long sizeBytes,
            String scanStatus,
            String downloadUrl) {}

    public record Detail(ConsultationSummary consultation, List<Message> messages) {}
}
