package com.healthcare.ai.chat.controller;

import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry;
import com.healthcare.auth.security.BffRequestVerifier;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/** Private BFF-only cancellation control plane; never accepts chat content. */
@RestController
@RequestMapping("/api/v1/internal/ai/chat-cancellations")
public class InternalChatCancellationController {

    private final BffRequestVerifier bffVerifier;
    private final ChatRequestCancellationRegistry cancellations;

    public InternalChatCancellationController(
            BffRequestVerifier bffVerifier,
            ChatRequestCancellationRegistry cancellations) {
        this.bffVerifier = bffVerifier;
        this.cancellations = cancellations;
    }

    /** A 204 confirms that the shared cancellation intent was accepted. */
    @PostMapping("/{requestId}")
    public ResponseEntity<Void> cancel(
            HttpServletRequest request,
            @PathVariable UUID requestId) {
        if (!bffVerifier.isTrusted(request)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Trusted BFF credential is required");
        }
        try {
            cancellations.cancel(requestId.toString());
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Shared chat cancellation state is unavailable",
                exception
            );
        }
        return ResponseEntity.noContent().build();
    }
}
