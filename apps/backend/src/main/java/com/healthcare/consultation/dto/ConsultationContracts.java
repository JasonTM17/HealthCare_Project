package com.healthcare.consultation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

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

    /**
     * The object-store key is intentionally not a client contract.  The
     * five-argument constructor is retained only for source compatibility
     * with the pre-Wave3 Java callers; its final argument is ignored.
     */
    public record AttachmentIntentRequest(
            @NotNull UUID messageId,
            @NotBlank @Size(max = 120) String mimeType,
            @NotNull Long sizeBytes,
            @NotBlank @Size(min = 64, max = 64) String sha256Hash) {
        public AttachmentIntentRequest(UUID messageId, String mimeType, Long sizeBytes,
                                       String sha256Hash, String ignoredObjectKey) {
            this(messageId, mimeType, sizeBytes, sha256Hash);
        }
    }

    /** Browser completion never decides whether bytes are clean. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AttachmentCompleteRequest() {
        /** Compatibility constructor; the client-provided value is ignored. */
        public AttachmentCompleteRequest(Boolean ignoredClean) { this(); }
    }

    /**
     * Read state is monotonic through a message in the same thread.  Older
     * clients may continue sending {@code lastReadMessageId}; Jackson accepts
     * that alias while the public response/request vocabulary is throughId.
     */
    public record ReadRequest(
            @JsonAlias("lastReadMessageId") UUID throughMessageId) {
        /** Source compatibility for the previous Java accessor. */
        @Deprecated
        public UUID lastReadMessageId() { return throughMessageId; }
    }

    public record HandoffRequest(@NotNull UUID doctorId) {}

    /** Active, appointment-compatible doctors shown by the handoff picker. */
    public record HandoffDoctor(
            UUID doctorId,
            String fullName,
            String specialtySlug,
            String branchSlug) {}

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

    /**
     * Coordinator/admin queue projection. It intentionally contains only
     * operational metadata: no subject, transcript, attachment, appointment,
     * patient/user identity, person name, email, phone, or profile id.
     */
    public record AdminQueueItem(
            UUID threadId,
            String status,
            OffsetDateTime firstResponseDueAt,
            OffsetDateTime firstRespondedAt,
            OffsetDateTime consultationOpenUntil,
            OffsetDateTime updatedAt,
            String specialtySlug,
            String assignmentRole,
            String assignmentPermission,
            OffsetDateTime assignedAt) {}

    public record Message(
            UUID id,
            UUID authorUserId,
            String authorRole,
            String body,
            String status,
            OffsetDateTime createdAt,
            List<Attachment> attachments) {}

    /** Ascending keyset page.  Cursor values are opaque to callers. */
    public record MessagePage(
            List<Message> items,
            String nextCursor,
            boolean hasMore) {}

    public record Attachment(
            UUID id,
            String mimeType,
            long sizeBytes,
            String scanStatus,
            String downloadUrl,
            String uploadStatus,
            String uploadUrl,
            OffsetDateTime uploadExpiresAt) {
        /** Compatibility constructor for existing response mappers/tests. */
        public Attachment(UUID id, String mimeType, long sizeBytes, String scanStatus,
                          String downloadUrl) {
            this(id, mimeType, sizeBytes, scanStatus, downloadUrl,
                "PENDING", null, null);
        }
    }

    public record Detail(ConsultationSummary consultation, List<Message> messages) {}
}
