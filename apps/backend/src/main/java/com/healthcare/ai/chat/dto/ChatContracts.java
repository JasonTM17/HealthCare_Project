package com.healthcare.ai.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ChatContracts {

    private ChatContracts() {
    }

    public record CreateConversationRequest(@Size(max = 160) String title) {
    }

    public record SendMessageRequest(
        @NotBlank @Size(min = 2, max = 10_000) String content
    ) {
    }

    public record ConversationResponse(
        UUID id,
        String title,
        String status,
        boolean inFlight,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime lastMessageAt,
        OffsetDateTime expiresAt
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
        OffsetDateTime createdAt,
        OffsetDateTime completedAt
    ) {
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
