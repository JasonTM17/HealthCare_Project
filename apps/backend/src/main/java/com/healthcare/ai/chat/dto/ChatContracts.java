package com.healthcare.ai.chat.dto;

import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.entity.ChatSafetyAction;
import com.healthcare.ai.chat.entity.FeedbackRating;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ChatContracts {

    private ChatContracts() {
    }

    public record CreateConversationRequest(
        @Size(max = 160) String title,
        ChatMode mode,
        Boolean consentAccepted
    ) {
        public CreateConversationRequest(String title) {
            this(title, ChatMode.HOSPITAL_SUPPORT, null);
        }
    }

    public record ConsentRequest(
        @NotNull Boolean accepted,
        @NotBlank @Size(max = 64) String policyVersion
    ) {
    }

    public record FeedbackRequest(@NotNull FeedbackRating rating) {
    }

    public record FeedbackResponse(
        FeedbackRating rating,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
    ) {
    }

    public record ChatPolicyResponse(
        String policyVersion,
        int retentionDays,
        String consentText,
        boolean remoteProviderEnabled
    ) {
    }

    public record SendMessageRequest(
        @NotBlank @Size(min = 2, max = 10_000) String content
    ) {
    }

    public record ConversationResponse(
        UUID id,
        String title,
        String status,
        ChatMode mode,
        boolean inFlight,
        String consentVersion,
        OffsetDateTime consentedAt,
        boolean consentRequired,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime lastMessageAt,
        OffsetDateTime expiresAt
    ) {
        public ConversationResponse(
                UUID id,
                String title,
                String status,
                boolean inFlight,
                OffsetDateTime createdAt,
                OffsetDateTime updatedAt,
                OffsetDateTime lastMessageAt,
                OffsetDateTime expiresAt) {
            this(id, title, status, ChatMode.HOSPITAL_SUPPORT, inFlight, null, null, true,
                createdAt, updatedAt, lastMessageAt, expiresAt);
        }
    }

    public record TriageSummary(
        String urgencyLevel,
        String recommendedSpecialty
    ) {
    }

    public record SuggestedAction(
        String kind,
        String label,
        String href
    ) {
    }

    public record MessageResponse(
        UUID id,
        String role,
        String status,
        String content,
        long sequence,
        String disclaimer,
        String provenance,
        List<Map<String, String>> citations,
        ChatSafetyAction safetyAction,
        TriageSummary triage,
        List<SuggestedAction> suggestedActions,
        FeedbackResponse feedback,
        String sourceStatus,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt
    ) {
        public MessageResponse(
                UUID id,
                String role,
                String status,
                String content,
                long sequence,
                String disclaimer,
                String provenance,
                List<Map<String, String>> citations,
                OffsetDateTime createdAt,
                OffsetDateTime completedAt) {
            this(id, role, status, content, sequence, disclaimer, provenance, citations,
                null, null, List.of(), null, "CURRENT", createdAt, completedAt);
        }
    }

    public record MessagePageResponse(
        List<MessageResponse> content,
        String nextCursor,
        boolean hasMore
    ) {
    }

    public record ChatExchangeResponse(
        MessageResponse userMessage,
        MessageResponse assistantMessage,
        boolean replayed
    ) {
    }
}
