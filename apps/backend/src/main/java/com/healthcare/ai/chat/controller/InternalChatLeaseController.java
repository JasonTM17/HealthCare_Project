package com.healthcare.ai.chat.controller;

import com.healthcare.ai.chat.dto.ChatContracts.ChatLeaseOpenRequest;
import com.healthcare.ai.chat.dto.ChatContracts.ChatLeaseRenewRequest;
import com.healthcare.ai.chat.dto.ChatContracts.ChatLeaseRenewResponse;
import com.healthcare.ai.chat.dto.ChatContracts.ChatLeaseScope;
import com.healthcare.ai.chat.service.AiConversationService;
import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry;
import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry.LeaseBinding;
import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry.LeaseScope;
import com.healthcare.auth.security.BffRequestVerifier;
import com.healthcare.observability.RequestTrace;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/** Private BFF-only request-liveness lease endpoints; request content is never accepted or stored. */
@RestController
@RequestMapping("/api/v1/internal/ai/chat-leases")
public class InternalChatLeaseController {

    private final BffRequestVerifier bffVerifier;
    private final ChatRequestCancellationRegistry cancellations;
    private final AiConversationService conversations;

    public InternalChatLeaseController(
            BffRequestVerifier bffVerifier,
            ChatRequestCancellationRegistry cancellations,
            AiConversationService conversations) {
        this.bffVerifier = bffVerifier;
        this.cancellations = cancellations;
        this.conversations = conversations;
    }

    @PostMapping("/{requestId}/open")
    public ResponseEntity<ChatLeaseRenewResponse> open(
            HttpServletRequest request,
            @PathVariable UUID requestId,
            @Valid @RequestBody ChatLeaseOpenRequest leaseRequest,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal UserDetails principal) {
        requireTrustedBff(request);
        requireMatchingTrace(request, requestId);
        LeaseBinding binding;
        if (leaseRequest.scope() == ChatLeaseScope.PUBLIC_CHAT) {
            if (leaseRequest.conversationId() != null) {
                throw invalidLeaseRequest();
            }
            binding = LeaseBinding.publicChat();
        } else {
            if (leaseRequest.conversationId() == null || !isPatient(principal)) {
                throw invalidLeaseRequest();
            }
            AiConversationService.PatientChatLeaseBinding patient = conversations.authorizePatientChatLease(
                principal,
                leaseRequest.conversationId(),
                idempotencyKey);
            binding = LeaseBinding.patient(patient.patientId(), patient.conversationId(), patient.idempotencyKey());
        }
        try {
            String permit = cancellations.openLease(requestId.toString(), binding);
            return noStore(new ChatLeaseRenewResponse(permit));
        } catch (java.util.concurrent.CancellationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chat request lease is unavailable", exception);
        } catch (IllegalStateException exception) {
            throw unavailable(exception);
        }
    }

    @PostMapping("/{requestId}/renew")
    public ResponseEntity<ChatLeaseRenewResponse> renew(
            HttpServletRequest request,
            @PathVariable UUID requestId,
            @Valid @RequestBody ChatLeaseRenewRequest renewal) {
        requireTrustedBff(request);
        requireMatchingTrace(request, requestId);
        LeaseScope scope = renewal.scope() == ChatLeaseScope.PUBLIC_CHAT
            ? LeaseScope.PUBLIC_CHAT
            : LeaseScope.PATIENT;
        try {
            String permit = cancellations.renewLease(requestId.toString(), scope, renewal.renewalPermit());
            return noStore(new ChatLeaseRenewResponse(permit));
        } catch (java.util.concurrent.CancellationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chat request lease renewal was rejected", exception);
        } catch (IllegalStateException exception) {
            throw unavailable(exception);
        }
    }

    private ResponseEntity<ChatLeaseRenewResponse> noStore(ChatLeaseRenewResponse body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    private void requireTrustedBff(HttpServletRequest request) {
        if (!bffVerifier.isTrusted(request)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Trusted BFF credential is required");
        }
    }

    private void requireMatchingTrace(HttpServletRequest request, UUID requestId) {
        String traceId = RequestTrace.currentId();
        if (traceId == null || !requestId.toString().equals(traceId)
                || !requestId.toString().equals(request.getHeader(RequestTrace.HEADER))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chat request trace does not match its lease");
        }
    }

    private boolean isPatient(UserDetails principal) {
        return principal != null && principal.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch("ROLE_PATIENT"::equals);
    }

    private ResponseStatusException invalidLeaseRequest() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chat request lease binding is invalid");
    }

    private ResponseStatusException unavailable(IllegalStateException exception) {
        return new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "Shared chat cancellation state is unavailable",
            exception
        );
    }
}
