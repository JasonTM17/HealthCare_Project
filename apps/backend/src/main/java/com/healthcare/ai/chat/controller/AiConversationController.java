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
    private com.healthcare.ai.service.AiCreditService aiCreditService;
    private com.healthcare.user.repository.UserRepository userRepository;

    public AiConversationController(AiConversationService conversationService, ObjectMapper objectMapper) {
        this.conversationService = conversationService;
        this.objectMapper = objectMapper;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public void setAiCreditService(com.healthcare.ai.service.AiCreditService aiCreditService) {
        this.aiCreditService = aiCreditService;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public void setUserRepository(com.healthcare.user.repository.UserRepository userRepository) {
        this.userRepository = userRepository;
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
        if (userRepository != null && aiCreditService != null) {
            com.healthcare.user.entity.User user = userRepository.findByEmail(principal.getUsername()).orElse(null);
            if (user != null) {
                aiCreditService.deductPatientCredit(user.getId(), "Hỏi Trợ lý AI Y khoa: " + request.content());
            }
        }
        return ResponseEntity.ok(
            conversationService.send(principal, conversationId, idempotencyKey, request.content())
        );
    }

    @PostMapping(value = "/{conversationId}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<String> sendStream(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SendMessageRequest request) throws Exception {
        if (userRepository != null && aiCreditService != null) {
            com.healthcare.user.entity.User user = userRepository.findByEmail(principal.getUsername()).orElse(null);
            if (user != null) {
                aiCreditService.deductPatientCredit(user.getId(), "Hỏi Trợ lý AI Y khoa (Stream): " + request.content());
            }
        }
        if (!conversationService.isChunkedDeliveryEnabled()) {
            // Return an empty response directly. The route only produces SSE,
            // so routing this state through the JSON exception handler causes
            // content negotiation to replace the intended 404 with a 500.
            return ResponseEntity.notFound().build();
        }
        ChatExchangeResponse exchange = conversationService.send(
            principal, conversationId, idempotencyKey, request.content());
        String answer = exchange.assistantMessage().content() == null ? "" : exchange.assistantMessage().content();
        StringBuilder events = new StringBuilder();
        for (String slice : com.healthcare.ai.chat.service.ChatAnswerChunker.slices(answer)) {
            appendSseEvent(events, "delta", slice);
        }
        appendSseEvent(events, "done", objectMapper.writeValueAsString(exchange));
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .header("X-Accel-Buffering", "no")
            .body(events.toString());
    }

    private void appendSseEvent(StringBuilder target, String eventName, String data) {
        target.append("event: ").append(eventName).append('\n');
        String normalized = data == null ? "" : data.replace("\r\n", "\n").replace('\r', '\n');
        for (String line : normalized.split("\\n", -1)) {
            target.append("data: ").append(line).append('\n');
        }
        target.append('\n');
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
