package com.healthcare.ai.chat.controller;

import com.healthcare.ai.chat.dto.ChatContracts.ChatExchangeResponse;
import com.healthcare.ai.chat.dto.ChatContracts.ConsentRequest;
import com.healthcare.ai.chat.dto.ChatContracts.ConversationResponse;
import com.healthcare.ai.chat.dto.ChatContracts.CreateConversationRequest;
import com.healthcare.ai.chat.dto.ChatContracts.FeedbackRequest;
import com.healthcare.ai.chat.dto.ChatContracts.FeedbackResponse;
import com.healthcare.ai.chat.dto.ChatContracts.MessagePageResponse;
import com.healthcare.ai.chat.dto.ChatContracts.PreparedChatCommitRequest;
import com.healthcare.ai.chat.dto.ChatContracts.PreparedChatExchangeResponse;
import com.healthcare.ai.chat.dto.ChatContracts.SendMessageRequest;
import com.healthcare.ai.chat.service.AiConversationService;
import com.healthcare.ai.chat.service.ChatCommitPermitService;
import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry;
import com.healthcare.auth.security.BffRequestVerifier;
import com.healthcare.observability.RequestTrace;
import jakarta.validation.Valid;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "AI Health Assistant", description = "Trợ lý trí tuệ nhân tạo y tế phân luồng triệu chứng và tư vấn")
@RestController
@RequestMapping("/api/v1/ai/conversations")
@PreAuthorize("hasRole('PATIENT')")
public class AiConversationController {

    private final AiConversationService conversationService;
    private final ObjectMapper objectMapper;
    private final ChatRequestCancellationRegistry cancellations;
    private final BffRequestVerifier bffVerifier;
    private final ChatCommitPermitService commitPermits;

    public AiConversationController(
            AiConversationService conversationService,
            ObjectMapper objectMapper,
            ChatRequestCancellationRegistry cancellations,
            BffRequestVerifier bffVerifier,
            ChatCommitPermitService commitPermits) {
        this.conversationService = conversationService;
        this.objectMapper = objectMapper;
        this.cancellations = cancellations;
        this.bffVerifier = bffVerifier;
        this.commitPermits = commitPermits;
    }

    @Operation(summary = "Tạo cuộc hội thoại AI mới", description = "Khởi tạo phiên tư vấn sức khỏe bảo mật dành cho người bệnh")
    @PostMapping
    public ResponseEntity<ConversationResponse> create(
            @AuthenticationPrincipal UserDetails principal,
            @Valid @RequestBody(required = false) CreateConversationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(conversationService.create(principal, request));
    }

    @Operation(summary = "Danh sách phiên hội thoại AI", description = "Lấy danh sách các phiên trò chuyện tư vấn sức khỏe trước đây của người bệnh")
    @GetMapping
    public ResponseEntity<List<ConversationResponse>> list(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(conversationService.list(principal));
    }

    @Operation(summary = "Chi tiết phiên hội thoại AI", description = "Lấy siêu dữ liệu và trạng thái của một phiên hội thoại cụ thể")
    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> get(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId) {
        return ResponseEntity.ok(conversationService.get(principal, conversationId));
    }

    @Operation(summary = "Lịch sử tin nhắn trong phiên", description = "Truy xuất danh sách các tin nhắn hỏi đáp trong phiên có phân trang con trỏ")
    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<MessagePageResponse> messages(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") int limit) {
        return ResponseEntity.ok(conversationService.messages(principal, conversationId, cursor, limit));
    }

    @Operation(summary = "Gửi tin nhắn hỏi đáp AI", description = "Gửi câu hỏi của bệnh nhân tới mô hình AI lâm sàng và nhận câu trả lời đồng bộ")
    @PostMapping("/{conversationId}/messages")
    public ResponseEntity<ChatExchangeResponse> send(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SendMessageRequest request,
            HttpServletRequest servletRequest) {
        try (var registration = cancellations.register(requestId(servletRequest))) {
            return ResponseEntity.ok(conversationService.send(
                principal, conversationId, idempotencyKey, request.content(), registration.cancellation()));
        } catch (CancellationException exception) {
            throw cancelledRequest(exception);
        } catch (IllegalStateException exception) {
            throw cancellationStateUnavailable(exception);
        }
    }

    /** Private first stage used only by the authenticated same-origin BFF. */
    @Hidden
    @PostMapping("/{conversationId}/messages/prepare")
    public ResponseEntity<PreparedChatExchangeResponse> prepareForBffCommit(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SendMessageRequest request,
            @RequestHeader(value = "X-Healthcare-Chat-Delivery", required = false) String delivery,
            HttpServletRequest servletRequest) throws Exception {
        requireTrustedBff(servletRequest);
        boolean chunkedDelivery = "chunked".equals(delivery);
        if (chunkedDelivery && !conversationService.isChunkedDeliveryEnabled()) {
            return ResponseEntity.notFound().build();
        }
        AiConversationService.PatientChatLeaseBinding patientBinding =
            conversationService.authorizePatientChatLease(principal, conversationId, idempotencyKey);
        ChatRequestCancellationRegistry.LeaseBinding leaseBinding = ChatRequestCancellationRegistry.LeaseBinding.patient(
            patientBinding.patientId(),
            patientBinding.conversationId(),
            patientBinding.idempotencyKey());
        try (var registration = cancellations.registerBffLease(requestId(servletRequest), leaseBinding)) {
            AiConversationService.PreparedChatResult result = conversationService.prepareForBffCommit(
                principal,
                conversationId,
                idempotencyKey,
                request.content(),
                chunkedDelivery,
                registration.cancellation());
            if (result.replayed()) {
                return ResponseEntity.ok(new PreparedChatExchangeResponse(true, result.exchange(), null, null));
            }
            String exactPayload = objectMapper.writeValueAsString(result.payload());
            registration.cancellation().throwIfCancelled();
            String permit = commitPermits.issue(
                registration.cancellation().requestId(),
                result.payload().patientId(),
                conversationId,
                result.payload().idempotencyKey(),
                exactPayload);
            return ResponseEntity.ok(new PreparedChatExchangeResponse(false, null, exactPayload, permit));
        } catch (CancellationException exception) {
            throw cancelledRequest(exception);
        } catch (IllegalStateException exception) {
            throw cancellationStateUnavailable(exception);
        }
    }

    /** Private second stage; the signed permit authorizes this exact answer and request tuple. */
    @Hidden
    @PostMapping("/{conversationId}/messages/commit")
    public ResponseEntity<ChatExchangeResponse> commitPreparedForBff(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody PreparedChatCommitRequest request,
            HttpServletRequest servletRequest) throws Exception {
        requireTrustedBff(servletRequest);
        AiConversationService.PreparedChatCommitPayload payload;
        try {
            payload = objectMapper.readValue(
                request.preparedPayload(), AiConversationService.PreparedChatCommitPayload.class);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prepared AI response is invalid", exception);
        }
        String operationId = requestId(servletRequest);
        if (payload == null || payload.idempotencyKey() == null
                || !commitPermits.verifies(
                    request.commitPermit(),
                    operationId,
                    payload.patientId(),
                    conversationId,
                    idempotencyKey.strip(),
                    request.preparedPayload())
                || !idempotencyKey.strip().equals(payload.idempotencyKey())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Prepared chat authorization is invalid");
        }
        return ResponseEntity.ok(conversationService.commitPreparedForBff(
            principal, operationId, conversationId, idempotencyKey, payload));
    }

    /**
     * Validated chunked delivery (decision D-02), not token streaming: the
     * complete answer is generated, validated against the authorized source
     * allowlist and persisted first; only afterwards is the finished text
     * replayed to the browser as SSE slices. There is no time-to-first-token
     * gain and no unvalidated partial content ever leaves the server. The
     * route path stays {@code /messages/stream} for client compatibility.
     */
    @Operation(summary = "Gửi tin nhắn nhận luồng dữ liệu SSE", description = "Gửi câu hỏi và nhận câu trả lời theo từng đoạn Server-Sent Events (SSE)")
    @PostMapping(value = "/{conversationId}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<String> sendValidatedChunks(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SendMessageRequest request,
            HttpServletRequest servletRequest) throws Exception {
        if (!conversationService.isChunkedDeliveryEnabled()) {
            // Return an empty response directly. The route only produces SSE,
            // so routing this state through the JSON exception handler causes
            // content negotiation to replace the intended 404 with a 500.
            return ResponseEntity.notFound().build();
        }
        ChatExchangeResponse exchange;
        try (var registration = cancellations.register(requestId(servletRequest))) {
            exchange = conversationService.sendForChunkedDelivery(
                principal,
                conversationId,
                idempotencyKey,
                request.content(),
                registration.cancellation());
        } catch (CancellationException exception) {
            throw cancelledRequest(exception);
        } catch (IllegalStateException exception) {
            throw cancellationStateUnavailable(exception);
        } catch (com.healthcare.exception.BusinessException exception) {
            // This route can only produce SSE (produces=text/event-stream). Letting
            // a BusinessException escape hands it to the JSON exception handler,
            // whose ApiError cannot be negotiated against text/event-stream and
            // turns the failure into an opaque 500. Answer with the structured
            // error as JSON so the client's non-OK branch surfaces the real code.
            com.healthcare.exception.ApiError error = new com.healthcare.exception.ApiError(
                exception.getStatus(),
                HttpStatus.valueOf(exception.getStatus()).getReasonPhrase(),
                exception.getMessage(),
                servletRequest.getRequestURI(),
                java.util.List.of(),
                exception.getCode()
            );
            return ResponseEntity.status(exception.getStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(objectMapper.writeValueAsString(error));
        }
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

    private String requestId(HttpServletRequest request) {
        Object requestId = request.getAttribute(RequestTrace.REQUEST_ATTRIBUTE);
        if (requestId instanceof String value && !value.isBlank()) return value;
        return RequestTrace.currentId();
    }

    private void requireTrustedBff(HttpServletRequest request) {
        if (!bffVerifier.isTrusted(request)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Trusted BFF credential is required");
        }
    }

    private ResponseStatusException cancelledRequest(CancellationException exception) {
        return new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "Chat request was cancelled",
            exception
        );
    }

    private ResponseStatusException cancellationStateUnavailable(IllegalStateException exception) {
        return new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "Shared chat cancellation state is unavailable",
            exception
        );
    }

    @Operation(summary = "Xác nhận đồng ý điều khoản AI", description = "Ghi nhận sự đồng ý của bệnh nhân về miễn trừ trách nhiệm y khoa AI")
    @PutMapping("/{conversationId}/consent")
    public ResponseEntity<ConversationResponse> consent(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @Valid @RequestBody ConsentRequest request) {
        return ResponseEntity.ok(conversationService.acceptConsent(principal, conversationId, request));
    }

    @Operation(summary = "Đánh giá câu trả lời AI", description = "Gửi phản hồi hữu ích (HELPFUL) hoặc chưa chính xác (NOT_HELPFUL)")
    @PutMapping("/{conversationId}/messages/{messageId}/feedback")
    public ResponseEntity<FeedbackResponse> feedback(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @Valid @RequestBody FeedbackRequest request) {
        return ResponseEntity.ok(conversationService.setFeedback(
            principal, conversationId, messageId, request.rating()));
    }

    @Operation(summary = "Xóa đánh giá câu trả lời AI", description = "Hủy bỏ đánh giá phản hồi đã gửi trước đó")
    @DeleteMapping("/{conversationId}/messages/{messageId}/feedback")
    public ResponseEntity<Void> deleteFeedback(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId) {
        conversationService.deleteFeedback(principal, conversationId, messageId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Xóa phiên hội thoại AI", description = "Xóa toàn bộ lịch sử của phiên trò chuyện")
    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable UUID conversationId) {
        conversationService.delete(principal, conversationId);
        return ResponseEntity.noContent().build();
    }
}
