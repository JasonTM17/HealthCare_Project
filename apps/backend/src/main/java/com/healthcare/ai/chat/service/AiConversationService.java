package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.dto.ChatContracts.ChatExchangeResponse;
import com.healthcare.ai.chat.dto.ChatContracts.ConversationResponse;
import com.healthcare.ai.chat.dto.ChatContracts.MessagePageResponse;
import com.healthcare.ai.chat.dto.ChatContracts.MessageResponse;
import com.healthcare.ai.chat.entity.AiConversation;
import com.healthcare.ai.chat.entity.AiConversationStatus;
import com.healthcare.ai.chat.entity.AiMessage;
import com.healthcare.ai.chat.entity.AiMessageRole;
import com.healthcare.ai.chat.entity.AiMessageStatus;
import com.healthcare.ai.chat.repository.AiConversationRepository;
import com.healthcare.ai.chat.repository.AiMessageRepository;
import com.healthcare.ai.service.AiService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AiConversationService {

    private static final String DEFAULT_TITLE = "Cuoc tro chuyen moi";
    private static final String SAFE_DISCLAIMER =
        "Thong tin tu tro ly AI chi mang tinh tham khao va khong thay the tu van cua bac si.";
    private static final int MAX_TITLE_LENGTH = 160;
    private static final int MAX_ANSWER_LENGTH = 4_000;
    private static final int MAX_CITATIONS = 20;
    private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[A-Za-z0-9._:-]{8,128}$");
    private static final Pattern SOURCE_ID = Pattern.compile("^[A-Za-z0-9._:-]{1,200}$");
    private static final Set<String> SOURCE_TYPES = Set.of(
        "specialty", "doctor", "service", "package", "article", "faq"
    );
    private static final Set<String> PROVENANCE = Set.of(
        "local_provider", "remote_provider", "local_fallback"
    );

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final AiService aiService;
    private final TransactionTemplate transactions;
    private final int retentionDays;
    private final boolean cleanupEnabled;
    private final int cleanupBatchSize;
    private final int cleanupMaxBatches;
    private final int processingLeaseSeconds;

    public AiConversationService(
            AiConversationRepository conversationRepository,
            AiMessageRepository messageRepository,
            UserRepository userRepository,
            AiService aiService,
            PlatformTransactionManager transactionManager,
            @Value("${ai.chat.retention-days:90}") int retentionDays,
            @Value("${ai.chat.cleanup-enabled:true}") boolean cleanupEnabled,
            @Value("${ai.chat.cleanup-batch-size:200}") int cleanupBatchSize,
            @Value("${ai.chat.cleanup-max-batches:20}") int cleanupMaxBatches,
            @Value("${ai.chat.processing-lease-seconds:120}") int processingLeaseSeconds) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.aiService = aiService;
        this.transactions = new TransactionTemplate(transactionManager);
        this.retentionDays = Math.max(1, Math.min(retentionDays, 365));
        this.cleanupEnabled = cleanupEnabled;
        this.cleanupBatchSize = Math.max(1, Math.min(cleanupBatchSize, 1_000));
        this.cleanupMaxBatches = Math.max(1, Math.min(cleanupMaxBatches, 100));
        this.processingLeaseSeconds = Math.max(30, Math.min(processingLeaseSeconds, 900));
    }

    @Transactional
    public ConversationResponse create(UserDetails principal, String requestedTitle) {
        User user = currentUser(principal);
        OffsetDateTime now = now();
        AiConversation conversation = new AiConversation();
        conversation.setUser(user);
        conversation.setTitle(normalizeTitle(requestedTitle));
        conversation.setStatus(AiConversationStatus.ACTIVE);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversation.setExpiresAt(expiry(now));
        return toConversation(conversationRepository.save(conversation));
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> list(UserDetails principal) {
        UUID userId = currentUserId(principal);
        return conversationRepository
            .findTop50ByUserIdAndExpiresAtAfterOrderByUpdatedAtDesc(userId, now())
            .stream()
            .map(this::toConversation)
            .toList();
    }

    @Transactional(readOnly = true)
    public ConversationResponse get(UserDetails principal, UUID conversationId) {
        return toConversation(requireOwned(conversationId, currentUserId(principal)));
    }

    @Transactional(readOnly = true)
    public MessagePageResponse messages(
            UserDetails principal,
            UUID conversationId,
            String rawCursor,
            int requestedLimit) {
        UUID userId = currentUserId(principal);
        requireOwned(conversationId, userId);
        int limit = Math.max(1, Math.min(requestedLimit, 100));
        long before = parseCursor(rawCursor);
        List<AiMessage> descending = messageRepository.findHistory(
            conversationId,
            before,
            PageRequest.of(0, limit + 1)
        );
        boolean hasMore = descending.size() > limit;
        if (hasMore) {
            descending = new ArrayList<>(descending.subList(0, limit));
        } else {
            descending = new ArrayList<>(descending);
        }
        String nextCursor = hasMore && !descending.isEmpty()
            ? Long.toString(descending.get(descending.size() - 1).getSequenceNumber())
            : null;
        Collections.reverse(descending);
        return new MessagePageResponse(descending.stream().map(this::toMessage).toList(), nextCursor, hasMore);
    }

    public ChatExchangeResponse send(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String rawContent) {
        UUID userId = currentUserId(principal);
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        String content = normalizeContent(rawContent);

        PreparedMessage prepared = transactions.execute(status ->
            prepare(userId, conversationId, idempotencyKey, content)
        );
        if (prepared == null) {
            throw new BusinessException(500, ErrorCodes.INTERNAL_ERROR, "Could not prepare chat request");
        }
        if (prepared.replay() != null) {
            return prepared.replay();
        }

        try {
            Map<String, Object> response = aiService.chat(Map.of(
                "message", content,
                "recent_turns", recentTurns(conversationId)
            ));
            SanitizedAiResponse sanitized = sanitize(response);
            ChatExchangeResponse completed = transactions.execute(status ->
                complete(
                    userId,
                    conversationId,
                    prepared.userMessageId(),
                    prepared.processingToken(),
                    sanitized
                )
            );
            if (completed == null) {
                throw new BusinessException(500, ErrorCodes.INTERNAL_ERROR, "Could not persist AI response");
            }
            return completed;
        } catch (BusinessException ex) {
            markFailed(userId, conversationId, prepared.userMessageId(), prepared.processingToken());
            throw ex;
        } catch (RuntimeException ex) {
            markFailed(userId, conversationId, prepared.userMessageId(), prepared.processingToken());
            throw new BusinessException(
                503,
                ErrorCodes.AI_UNAVAILABLE,
                "AI assistant is temporarily unavailable. Please try again."
            );
        }
    }

    @Transactional
    public void delete(UserDetails principal, UUID conversationId) {
        UUID userId = currentUserId(principal);
        AiConversation conversation = conversationRepository.findOwnedForUpdate(conversationId, userId)
            .orElseThrow(this::notFound);
        conversationRepository.delete(conversation);
    }

    @Scheduled(cron = "${ai.chat.cleanup-cron:0 20 3 * * *}")
    @Transactional
    public void purgeExpired() {
        if (!cleanupEnabled) {
            return;
        }
        OffsetDateTime cutoff = now();
        for (int batch = 0; batch < cleanupMaxBatches; batch++) {
            List<AiConversation> expired = conversationRepository.findByExpiresAtBeforeOrderByExpiresAtAsc(
                cutoff,
                PageRequest.of(0, cleanupBatchSize)
            );
            if (expired.isEmpty()) {
                return;
            }
            conversationRepository.deleteAllInBatch(expired);
            if (expired.size() < cleanupBatchSize) {
                return;
            }
        }
    }

    private PreparedMessage prepare(
            UUID userId,
            UUID conversationId,
            String idempotencyKey,
            String content) {
        AiConversation conversation = requireOwnedForUpdate(conversationId, userId);
        recoverStaleInFlight(conversation);
        var existing = messageRepository.findByConversationIdAndIdempotencyKey(
            conversationId,
            idempotencyKey
        );
        if (existing.isPresent()) {
            AiMessage request = existing.get();
            if (!request.getContent().equals(content)) {
                throw new BusinessException(
                    409,
                    ErrorCodes.CHAT_IDEMPOTENCY_CONFLICT,
                    "Idempotency-Key was already used with different content"
                );
            }
            if (request.getStatus() == AiMessageStatus.PENDING) {
                throw inProgress();
            }
            AiMessage reply = messageRepository.findByRequestMessageId(request.getId()).orElse(null);
            if (reply != null) {
                return new PreparedMessage(
                    request.getId(),
                    null,
                    new ChatExchangeResponse(toMessage(request), toMessage(reply), true)
                );
            }
            throw new BusinessException(
                503,
                ErrorCodes.AI_UNAVAILABLE,
                "The previous attempt failed. Retry with a new Idempotency-Key."
            );
        }
        if (conversation.isInFlight()) {
            throw inProgress();
        }

        OffsetDateTime now = now();
        UUID processingToken = UUID.randomUUID();
        conversation.setInFlight(true);
        conversation.setInFlightStartedAt(now);
        conversation.setInFlightToken(processingToken);
        conversation.setUpdatedAt(now);
        conversation.setExpiresAt(expiry(now));
        conversationRepository.save(conversation);

        AiMessage request = new AiMessage();
        request.setConversation(conversation);
        request.setRole(AiMessageRole.USER);
        request.setStatus(AiMessageStatus.PENDING);
        request.setContent(content);
        request.setSequenceNumber(messageRepository.findMaxSequence(conversationId) + 1);
        request.setIdempotencyKey(idempotencyKey);
        request.setCreatedAt(now);
        messageRepository.save(request);
        return new PreparedMessage(request.getId(), processingToken, null);
    }

    private ChatExchangeResponse complete(
            UUID userId,
            UUID conversationId,
            UUID userMessageId,
            UUID processingToken,
            SanitizedAiResponse response) {
        AiConversation conversation = requireOwnedForUpdate(conversationId, userId);
        OffsetDateTime completedAt = now();
        if (!conversation.isInFlight()
                || !processingToken.equals(conversation.getInFlightToken())
                || processingLeaseExpired(conversation, completedAt)) {
            throw new BusinessException(
                503,
                ErrorCodes.AI_UNAVAILABLE,
                "The AI response arrived after its processing lease expired. Please retry."
            );
        }
        AiMessage request = messageRepository.findById(userMessageId)
            .filter(message -> message.getConversation().getId().equals(conversationId))
            .orElseThrow(() -> new BusinessException(
                404,
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                "Conversation not found"
            ));
        AiMessage existingReply = messageRepository.findByRequestMessageId(userMessageId).orElse(null);
        if (existingReply != null) {
            conversation.setInFlight(false);
            conversation.setInFlightStartedAt(null);
            conversation.setInFlightToken(null);
            return new ChatExchangeResponse(toMessage(request), toMessage(existingReply), true);
        }

        request.setStatus(AiMessageStatus.COMPLETED);
        request.setCompletedAt(completedAt);
        messageRepository.save(request);

        AiMessage reply = new AiMessage();
        reply.setConversation(conversation);
        reply.setRequestMessage(request);
        reply.setRole(AiMessageRole.ASSISTANT);
        reply.setStatus(AiMessageStatus.COMPLETED);
        reply.setContent(response.answer());
        reply.setSequenceNumber(messageRepository.findMaxSequence(conversationId) + 1);
        reply.setDisclaimer(response.disclaimer());
        reply.setProvenance(response.provenance());
        reply.setCitations(response.citations());
        reply.setCreatedAt(completedAt);
        reply.setCompletedAt(completedAt);
        messageRepository.save(reply);

        if (DEFAULT_TITLE.equals(conversation.getTitle())) {
            conversation.setTitle(deriveTitle(request.getContent()));
        }
        conversation.setInFlight(false);
        conversation.setInFlightStartedAt(null);
        conversation.setInFlightToken(null);
        conversation.setLastMessageAt(completedAt);
        conversation.setUpdatedAt(completedAt);
        conversation.setExpiresAt(expiry(completedAt));
        conversationRepository.save(conversation);
        return new ChatExchangeResponse(toMessage(request), toMessage(reply), false);
    }

    private void markFailed(
            UUID userId,
            UUID conversationId,
            UUID userMessageId,
            UUID processingToken) {
        try {
            transactions.executeWithoutResult(status -> {
                AiConversation conversation = conversationRepository
                    .findOwnedForUpdate(conversationId, userId)
                    .orElse(null);
                if (conversation == null) {
                    return;
                }
                if (!conversation.isInFlight()
                    || processingToken == null
                    || !processingToken.equals(conversation.getInFlightToken())) {
                    return;
                }
                messageRepository.findById(userMessageId).ifPresent(message -> {
                    if (message.getStatus() == AiMessageStatus.PENDING) {
                        message.setStatus(AiMessageStatus.FAILED);
                        message.setCompletedAt(now());
                        messageRepository.save(message);
                    }
                });
                conversation.setInFlight(false);
                conversation.setInFlightStartedAt(null);
                conversation.setInFlightToken(null);
                conversation.setUpdatedAt(now());
                conversationRepository.save(conversation);
            });
        } catch (RuntimeException ignored) {
            // Preserve the safe client error even when best-effort failure marking cannot complete.
        }
    }

    private void recoverStaleInFlight(AiConversation conversation) {
        if (!conversation.isInFlight()) {
            return;
        }
        OffsetDateTime recoveredAt = now();
        if (!processingLeaseExpired(conversation, recoveredAt)) {
            return;
        }

        for (AiMessage pending : messageRepository.findByConversationIdAndStatus(
                conversation.getId(), AiMessageStatus.PENDING)) {
            pending.setStatus(AiMessageStatus.FAILED);
            pending.setCompletedAt(recoveredAt);
        }
        conversation.setInFlight(false);
        conversation.setInFlightStartedAt(null);
        conversation.setInFlightToken(null);
        conversation.setUpdatedAt(recoveredAt);
        messageRepository.flush();
        conversationRepository.save(conversation);
    }

    private boolean processingLeaseExpired(AiConversation conversation, OffsetDateTime referenceTime) {
        OffsetDateTime startedAt = conversation.getInFlightStartedAt();
        return startedAt == null
            || !startedAt.isAfter(referenceTime.minusSeconds(processingLeaseSeconds));
    }

    private List<Map<String, String>> recentTurns(UUID conversationId) {
        List<AiMessage> descending = messageRepository
            .findByConversationIdAndStatusOrderBySequenceNumberDesc(
                conversationId,
                AiMessageStatus.COMPLETED,
                PageRequest.of(0, 6)
            );
        List<AiMessage> chronological = new ArrayList<>(descending);
        Collections.reverse(chronological);
        return chronological.stream()
            .map(message -> Map.of(
                "role", message.getRole() == AiMessageRole.USER ? "user" : "assistant",
                "content", trim(message.getContent(), 2_000)
            ))
            .toList();
    }

    private SanitizedAiResponse sanitize(Map<String, Object> response) {
        if (response == null || !(response.get("answer") instanceof String rawAnswer)) {
            throw invalidAiResponse();
        }
        String answer = rawAnswer.strip();
        if (answer.isEmpty() || answer.length() > MAX_ANSWER_LENGTH) {
            throw invalidAiResponse();
        }
        String provenance = response.get("provenance") instanceof String value ? value : "";
        if (!PROVENANCE.contains(provenance)) {
            throw invalidAiResponse();
        }
        String disclaimer = response.get("disclaimer") instanceof String value
            ? trim(value.strip(), 1_000)
            : SAFE_DISCLAIMER;
        if (disclaimer.isBlank()) {
            disclaimer = SAFE_DISCLAIMER;
        }
        return new SanitizedAiResponse(answer, disclaimer, provenance, sanitizeCitations(response.get("citations")));
    }

    private List<Map<String, String>> sanitizeCitations(Object rawCitations) {
        if (!(rawCitations instanceof List<?> values)) {
            return List.of();
        }
        List<Map<String, String>> citations = new ArrayList<>();
        for (Object value : values) {
            if (citations.size() >= MAX_CITATIONS || !(value instanceof Map<?, ?> item)) {
                break;
            }
            Object typeValue = item.get("source_type");
            Object idValue = item.get("source_id");
            Object titleValue = item.get("title");
            if (!(typeValue instanceof String type)
                || !SOURCE_TYPES.contains(type)
                || !(idValue instanceof String sourceId)
                || !SOURCE_ID.matcher(sourceId).matches()
                || !(titleValue instanceof String title)) {
                continue;
            }
            String cleanTitle = title.strip();
            if (cleanTitle.isEmpty() || cleanTitle.length() > 300) {
                continue;
            }
            Map<String, String> citation = new LinkedHashMap<>();
            citation.put("source_type", type);
            citation.put("source_id", sourceId);
            citation.put("title", cleanTitle);
            citations.add(Map.copyOf(citation));
        }
        return List.copyOf(citations);
    }

    private AiConversation requireOwned(UUID conversationId, UUID userId) {
        AiConversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
            .orElseThrow(this::notFound);
        ensureNotExpired(conversation);
        return conversation;
    }

    private AiConversation requireOwnedForUpdate(UUID conversationId, UUID userId) {
        AiConversation conversation = conversationRepository.findOwnedForUpdate(conversationId, userId)
            .orElseThrow(this::notFound);
        ensureNotExpired(conversation);
        return conversation;
    }

    private void ensureNotExpired(AiConversation conversation) {
        if (!conversation.getExpiresAt().isAfter(now())) {
            throw new BusinessException(
                410,
                ErrorCodes.CHAT_RETENTION_EXPIRED,
                "Conversation retention period has expired"
            );
        }
    }

    private User currentUser(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return userRepository.findById(healthcarePrincipal.getUserId())
                .orElseThrow(this::authenticationRequired);
        }
        if (principal == null || principal.getUsername() == null) {
            throw authenticationRequired();
        }
        return userRepository.findByEmail(principal.getUsername())
            .orElseThrow(this::authenticationRequired);
    }

    private UUID currentUserId(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            return healthcarePrincipal.getUserId();
        }
        return currentUser(principal).getId();
    }

    private ConversationResponse toConversation(AiConversation value) {
        return new ConversationResponse(
            value.getId(),
            value.getTitle(),
            value.getStatus().name(),
            value.isInFlight(),
            value.getCreatedAt(),
            value.getUpdatedAt(),
            value.getLastMessageAt(),
            value.getExpiresAt()
        );
    }

    private MessageResponse toMessage(AiMessage value) {
        return new MessageResponse(
            value.getId(),
            value.getRole().name(),
            value.getStatus().name(),
            value.getContent(),
            value.getSequenceNumber(),
            value.getDisclaimer(),
            value.getProvenance(),
            value.getCitations() == null ? List.of() : List.copyOf(value.getCitations()),
            value.getCreatedAt(),
            value.getCompletedAt()
        );
    }

    private long parseCursor(String rawCursor) {
        if (rawCursor == null || rawCursor.isBlank()) {
            return Long.MAX_VALUE;
        }
        try {
            long cursor = Long.parseLong(rawCursor);
            if (cursor < 1) {
                throw new NumberFormatException("negative cursor");
            }
            return cursor;
        } catch (NumberFormatException ex) {
            throw new BusinessException(400, ErrorCodes.CHAT_INPUT_INVALID, "Invalid message cursor");
        }
    }

    private String normalizeTitle(String rawTitle) {
        if (rawTitle == null || rawTitle.isBlank()) {
            return DEFAULT_TITLE;
        }
        return trim(rawTitle.strip(), MAX_TITLE_LENGTH);
    }

    private String deriveTitle(String content) {
        String firstLine = content.lines().findFirst().orElse(content).strip();
        return trim(firstLine, 72);
    }

    private String normalizeContent(String rawContent) {
        String content = rawContent == null ? "" : rawContent.strip();
        if (content.length() < 2 || content.length() > 10_000) {
            throw new BusinessException(
                400,
                ErrorCodes.CHAT_INPUT_INVALID,
                "Message must be between 2 and 10000 characters"
            );
        }
        return content;
    }

    private String normalizeIdempotencyKey(String rawKey) {
        String key = rawKey == null ? "" : rawKey.strip();
        if (!IDEMPOTENCY_KEY.matcher(key).matches()) {
            throw new BusinessException(
                400,
                ErrorCodes.CHAT_INPUT_INVALID,
                "Idempotency-Key must contain 8 to 128 safe characters"
            );
        }
        return key;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private OffsetDateTime expiry(OffsetDateTime value) {
        return value.plusDays(retentionDays);
    }

    private String trim(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private BusinessException notFound() {
        return new BusinessException(
            404,
            ErrorCodes.AI_CONVERSATION_NOT_FOUND,
            "Conversation not found"
        );
    }

    private BusinessException inProgress() {
        return new BusinessException(
            409,
            ErrorCodes.CHAT_MESSAGE_IN_PROGRESS,
            "A message is already being processed for this conversation"
        );
    }

    private BusinessException invalidAiResponse() {
        return new BusinessException(
            502,
            ErrorCodes.AI_RESPONSE_INVALID,
            "AI service returned an invalid response"
        );
    }

    private BusinessException authenticationRequired() {
        return new BusinessException(
            401,
            ErrorCodes.AUTHENTICATION_REQUIRED,
            "Authentication required"
        );
    }

    private record PreparedMessage(
        UUID userMessageId,
        UUID processingToken,
        ChatExchangeResponse replay
    ) {
    }

    private record SanitizedAiResponse(
        String answer,
        String disclaimer,
        String provenance,
        List<Map<String, String>> citations
    ) {
    }
}
