package com.healthcare.ai.chat.controller;

import com.healthcare.ai.chat.dto.ChatContracts.ChatExchangeResponse;
import com.healthcare.ai.chat.dto.ChatContracts.ConversationResponse;
import com.healthcare.ai.chat.dto.ChatContracts.CreateConversationRequest;
import com.healthcare.ai.chat.dto.ChatContracts.MessagePageResponse;
import com.healthcare.ai.chat.dto.ChatContracts.SendMessageRequest;
import com.healthcare.ai.chat.service.AiConversationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

    public AiConversationController(AiConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping
    public ResponseEntity<ConversationResponse> create(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody(required = false) CreateConversationRequest request) {
        String title = request == null ? null : request.title();
        return ResponseEntity.status(HttpStatus.CREATED).body(conversationService.create(principal, title));
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

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId) {
        conversationService.delete(principal, conversationId);
        return ResponseEntity.noContent().build();
    }
}
