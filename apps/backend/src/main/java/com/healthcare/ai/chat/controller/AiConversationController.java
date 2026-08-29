package com.healthcare.ai.chat.controller;

import com.healthcare.ai.chat.dto.ChatContracts.ChatExchangeResponse;
import com.healthcare.ai.chat.dto.ChatContracts.ConsentRequest;
import com.healthcare.ai.chat.dto.ChatContracts.ConversationResponse;
import com.healthcare.ai.chat.dto.ChatContracts.CreateConversationRequest;
import com.healthcare.ai.chat.dto.ChatContracts.FeedbackRequest;
import com.healthcare.ai.chat.dto.ChatContracts.FeedbackResponse;
import com.healthcare.ai.chat.dto.ChatContracts.MessagePageResponse;
import com.healthcare.ai.chat.dto.ChatContracts.SendMessageRequest;
import com.healthcare.ai.chat.service.AiConversationService;
import jakarta.validation.Valid;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/conversations")
@PreAuthorize("hasRole('PATIENT')")
public class AiConversationController {

    private final AiConversationService conversationService;
    private final ObjectMapper objectMapper;

    public AiConversationController(AiConversationService conversationService, ObjectMapper objectMapper) {
        this.conversationService = conversationService;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    public ResponseEntity<ConversationResponse> create(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody(required = false) CreateConversationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(conversationService.create(principal, request));
    }

    @GetMapping
    public ResponseEntity<List<ConversationResponse>> list(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(conversationService.list(principal));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> get(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId) {
        return ResponseEntity.ok(conversationService.get(principal, conversationId));
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<MessagePageResponse> messages(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") int limit) {
        return ResponseEntity.ok(conversationService.messages(principal, conversationId, cursor, limit));
    }

    @PostMapping("/{conversationId}/messages")
    public ResponseEntity<ChatExchangeResponse> send(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(
            conversationService.send(principal, conversationId, idempotencyKey, request.content())
        );
    }

    @PostMapping(value = "/{conversationId}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter sendStream(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SendMessageRequest request) throws Exception {
        if (!conversationService.isChunkedDeliveryEnabled()) {
            throw new com.healthcare.exception.BusinessException(
                404,
                com.healthcare.exception.ErrorCodes.RESOURCE_NOT_FOUND,
                "Chunked chat delivery is disabled"
            );
        }
        ChatExchangeResponse exchange = conversationService.send(
            principal, conversationId, idempotencyKey, request.content());
        SseEmitter emitter = new SseEmitter(15_000L);
        String answer = exchange.assistantMessage().content() == null ? "" : exchange.assistantMessage().content();
        for (String slice : com.healthcare.ai.chat.service.ChatAnswerChunker.slices(answer)) {
            emitter.send(SseEmitter.event().name("delta").data(slice));
        }
        emitter.send(SseEmitter.event().name("done").data(objectMapper.writeValueAsString(exchange)));
        emitter.complete();
        return emitter;
    }

    @PutMapping("/{conversationId}/consent")
    public ResponseEntity<ConversationResponse> consent(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @Valid @RequestBody ConsentRequest request) {
        return ResponseEntity.ok(conversationService.acceptConsent(principal, conversationId, request));
    }

    @PutMapping("/{conversationId}/messages/{messageId}/feedback")
    public ResponseEntity<FeedbackResponse> feedback(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @Valid @RequestBody FeedbackRequest request) {
        return ResponseEntity.ok(conversationService.setFeedback(
            principal, conversationId, messageId, request.rating()));
    }

    @DeleteMapping("/{conversationId}/messages/{messageId}/feedback")
    public ResponseEntity<Void> deleteFeedback(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId) {
        conversationService.deleteFeedback(principal, conversationId, messageId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId) {
        conversationService.delete(principal, conversationId);
        return ResponseEntity.noContent().build();
    }
}
