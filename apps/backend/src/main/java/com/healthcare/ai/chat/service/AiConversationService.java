package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.dto.ChatContracts.ChatExchangeResponse;
import com.healthcare.ai.chat.dto.ChatContracts.ChatPolicyResponse;
import com.healthcare.ai.chat.dto.ChatContracts.ConsentRequest;
import com.healthcare.ai.chat.dto.ChatContracts.ConversationResponse;
import com.healthcare.ai.chat.dto.ChatContracts.CreateConversationRequest;
import com.healthcare.ai.chat.dto.ChatContracts.FeedbackResponse;
import com.healthcare.ai.chat.dto.ChatContracts.MessagePageResponse;
import com.healthcare.ai.chat.dto.ChatContracts.MessageResponse;
import com.healthcare.ai.chat.dto.ChatContracts.SuggestedAction;
import com.healthcare.ai.chat.dto.ChatContracts.TriageSummary;
import com.healthcare.ai.chat.entity.AiMessageFeedback;
import com.healthcare.ai.chat.entity.AiConversation;
import com.healthcare.ai.chat.entity.AiConversationStatus;
import com.healthcare.ai.chat.entity.AiMessage;
import com.healthcare.ai.chat.entity.AiMessageRole;
import com.healthcare.ai.chat.entity.AiMessageStatus;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.entity.ChatSafetyAction;
import com.healthcare.ai.chat.entity.FeedbackRating;
import com.healthcare.ai.chat.repository.AiConversationRepository;
import com.healthcare.ai.chat.repository.AiMessageFeedbackRepository;
import com.healthcare.ai.chat.repository.AiMessageRepository;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.ai.service.AiService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.observability.RequestTrace;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

    private static final Logger log = LoggerFactory.getLogger(AiConversationService.class);
    private static final String DEFAULT_TITLE = "Cuộc trò chuyện mới";
    private static final String SAFE_DISCLAIMER =
        "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn của bác sĩ.";
    private static final int MAX_TITLE_LENGTH = 160;
    private static final int MAX_ANSWER_LENGTH = 4_000;
    private static final int MAX_CITATIONS = 20;
    private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[A-Za-z0-9._:-]{8,128}$");
    private static final Pattern SOURCE_ID = Pattern.compile("^[A-Za-z0-9._:-]{1,200}$");
    private static final Set<String> SOURCE_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package", "article", "faq"
    );
    private static final Set<String> PROVENANCE = Set.of(
        "local_provider", "remote_provider", "local_fallback"
    );
    private static final Set<String> TRIAGE_URGENCY = Set.of("EMERGENCY", "HIGH", "NORMAL");
    private static final Set<String> TRIAGE_SPECIALTIES = Set.of(
        "Tim Mạch & Can Thiệp Mạch Máu",
        "Thần Kinh & Đột Quỵ",
        "Tiêu Hóa - Gan Mật - Tụy",
        "Cơ Xương Khớp & Phục Hồi Chức Năng",
        "Sản Phụ Khoa",
        "Nhi Khoa",
        "Da Liễu",
        "Nội Tổng Quát",
        "Gói Khám Sức Khỏe Tổng Quát Toàn Diện"
    );
    private static final String POLICY_VERSION = "patient-chat-v1";
    private static final String CONSENT_TEXT =
        "Chat được lưu tối đa 90 ngày; AI chỉ cung cấp thông tin tham khảo, "
        + "không chẩn đoán/kê đơn và có thể chuyển bạn tới nhân viên y tế.";
    private static final String PATIENT_CHAT_CREDIT_DESCRIPTION = "Lượt sử dụng Trợ lý AI Y khoa";
    private static final String PATIENT_CHAT_REFUND_DESCRIPTION =
        "Hoàn credit cho lượt hỏi AI không thành công";

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final AiMessageFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final AiService aiService;
    private final AiCreditService aiCreditService;
    private final AiChatSourceResolver sourceResolver;
    private final TransactionTemplate transactions;
    private final int retentionDays;
    private final boolean cleanupEnabled;
    private final int cleanupBatchSize;
    private final int cleanupMaxBatches;
    private final int processingLeaseSeconds;
    private final boolean remoteProviderEnabled;
    private final boolean symptomTriageEnabled;
    private final boolean healthEducationEnabled;
    private final boolean syntheticBetaAsserted;
    private final SyntheticBetaGuardService syntheticBetaGuard;

    @Value("${ai.chat.chunked-enabled:false}")
    private boolean chunkedEnabled = false;

    @Value("${ai.chat.two-week-cleanup-days:14}")
    private int twoWeekCleanupDays = 14;

    @Autowired
    public AiConversationService(
            AiConversationRepository conversationRepository,
            AiMessageRepository messageRepository,
            AiMessageFeedbackRepository feedbackRepository,
            UserRepository userRepository,
            AiService aiService,
            AiCreditService aiCreditService,
            AiChatSourceResolver sourceResolver,
            PlatformTransactionManager transactionManager,
            @Value("${ai.chat.retention-days:90}") int retentionDays,
            @Value("${ai.chat.cleanup-enabled:true}") boolean cleanupEnabled,
            @Value("${ai.chat.cleanup-batch-size:200}") int cleanupBatchSize,
            @Value("${ai.chat.cleanup-max-batches:20}") int cleanupMaxBatches,
            @Value("${ai.chat.processing-lease-seconds:120}") int processingLeaseSeconds,
            @Value("${ai.chat.remote-provider-enabled:true}") boolean remoteProviderEnabled,
            @Value("${ai.chat.symptom-triage-enabled:false}") boolean symptomTriageEnabled,
            @Value("${ai.chat.health-education-enabled:false}") boolean healthEducationEnabled,
            @Value("${ai.chat.synthetic-beta-asserted:false}") boolean syntheticBetaAsserted,
            SyntheticBetaGuardService syntheticBetaGuard) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
        this.aiService = aiService;
        this.aiCreditService = aiCreditService;
        this.sourceResolver = sourceResolver;
        this.transactions = new TransactionTemplate(transactionManager);
        this.retentionDays = Math.max(1, Math.min(retentionDays, 365));
        this.cleanupEnabled = cleanupEnabled;
        this.cleanupBatchSize = Math.max(1, Math.min(cleanupBatchSize, 1_000));
        this.cleanupMaxBatches = Math.max(1, Math.min(cleanupMaxBatches, 100));
        this.processingLeaseSeconds = Math.max(30, Math.min(processingLeaseSeconds, 900));
        this.remoteProviderEnabled = remoteProviderEnabled;
        this.symptomTriageEnabled = symptomTriageEnabled;
        this.healthEducationEnabled = healthEducationEnabled;
        this.syntheticBetaAsserted = syntheticBetaAsserted;
        this.syntheticBetaGuard = syntheticBetaGuard == null
            ? SyntheticBetaGuardService.disabled() : syntheticBetaGuard;
    }

    /** Compatibility constructor for focused unit tests and older callers. */
    public AiConversationService(
            AiConversationRepository conversationRepository,
            AiMessageRepository messageRepository,
            AiMessageFeedbackRepository feedbackRepository,
            UserRepository userRepository,
            AiService aiService,
            AiChatSourceResolver sourceResolver,
            PlatformTransactionManager transactionManager,
            int retentionDays,
            boolean cleanupEnabled,
            int cleanupBatchSize,
            int cleanupMaxBatches,
            int processingLeaseSeconds) {
        this(
            conversationRepository,
            messageRepository,
            feedbackRepository,
            userRepository,
            aiService,
            null,
            sourceResolver,
            transactionManager,
            retentionDays,
            cleanupEnabled,
            cleanupBatchSize,
            cleanupMaxBatches,
            processingLeaseSeconds,
            false,
            true,
            true,
            false,
            SyntheticBetaGuardService.disabled()
        );
    }

    /** Compatibility constructor retaining the pre-synthetic-beta flag shape. */
    public AiConversationService(
            AiConversationRepository conversationRepository,
            AiMessageRepository messageRepository,
            AiMessageFeedbackRepository feedbackRepository,
            UserRepository userRepository,
            AiService aiService,
            AiChatSourceResolver sourceResolver,
            PlatformTransactionManager transactionManager,
            int retentionDays,
            boolean cleanupEnabled,
            int cleanupBatchSize,
            int cleanupMaxBatches,
            int processingLeaseSeconds,
            boolean remoteProviderEnabled,
            boolean symptomTriageEnabled,
            boolean healthEducationEnabled) {
        this(
            conversationRepository,
            messageRepository,
            feedbackRepository,
            userRepository,
            aiService,
            null,
            sourceResolver,
            transactionManager,
            retentionDays,
            cleanupEnabled,
            cleanupBatchSize,
            cleanupMaxBatches,
            processingLeaseSeconds,
            remoteProviderEnabled,
            symptomTriageEnabled,
            healthEducationEnabled,
            false,
            SyntheticBetaGuardService.disabled()
        );
    }

    /** Compatibility constructor retaining the synthetic-beta guard shape. */
    public AiConversationService(
            AiConversationRepository conversationRepository,
            AiMessageRepository messageRepository,
            AiMessageFeedbackRepository feedbackRepository,
            UserRepository userRepository,
            AiService aiService,
            AiChatSourceResolver sourceResolver,
            PlatformTransactionManager transactionManager,
            int retentionDays,
            boolean cleanupEnabled,
            int cleanupBatchSize,
            int cleanupMaxBatches,
            int processingLeaseSeconds,
            boolean remoteProviderEnabled,
            boolean symptomTriageEnabled,
            boolean healthEducationEnabled,
            boolean syntheticBetaAsserted,
            SyntheticBetaGuardService syntheticBetaGuard) {
        this(
            conversationRepository,
            messageRepository,
            feedbackRepository,
            userRepository,
            aiService,
            null,
            sourceResolver,
            transactionManager,
            retentionDays,
            cleanupEnabled,
            cleanupBatchSize,
            cleanupMaxBatches,
            processingLeaseSeconds,
            remoteProviderEnabled,
            symptomTriageEnabled,
            healthEducationEnabled,
            syntheticBetaAsserted,
            syntheticBetaGuard
        );
    }

    @Transactional
    public ConversationResponse create(UserDetails principal, CreateConversationRequest request) {
        User user = currentUser(principal);
        String requestedTitle = request == null ? null : request.title();
        ChatMode mode = request == null || request.mode() == null
            ? ChatMode.HOSPITAL_SUPPORT : request.mode();
        ensureModeEnabled(mode);
        OffsetDateTime now = now();
        AiConversation conversation = new AiConversation();
        conversation.setUser(user);
        conversation.setTitle(normalizeTitle(requestedTitle));
        conversation.setMode(mode);
        if (request != null && Boolean.TRUE.equals(request.consentAccepted())) {
            conversation.setConsentVersion(POLICY_VERSION);
            conversation.setConsentedAt(now);
        }
        conversation.setStatus(AiConversationStatus.ACTIVE);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversation.setExpiresAt(expiry(now));
        return toConversation(conversationRepository.save(conversation));
    }

    /** Compatibility overload for existing service callers. */
    @Transactional
    public ConversationResponse create(UserDetails principal, String requestedTitle) {
        return create(principal, new CreateConversationRequest(requestedTitle));
    }

    @Transactional(readOnly = true)
    public ChatPolicyResponse policy(UserDetails principal) {
        currentUserId(principal);
        return new ChatPolicyResponse(POLICY_VERSION, retentionDays, CONSENT_TEXT, remoteProviderEnabled);
    }

    @Transactional
    public ConversationResponse acceptConsent(
            UserDetails principal,
            UUID conversationId,
            ConsentRequest request) {
        UUID userId = currentUserId(principal);
        if (request == null || !Boolean.TRUE.equals(request.accepted())) {
            throw new BusinessException(400, "CHAT_CONSENT_REQUIRED", "Consent must be accepted");
        }
        if (!POLICY_VERSION.equals(request.policyVersion())) {
            throw new BusinessException(409, "CHAT_CONSENT_VERSION_STALE", "Chat consent policy has changed");
        }
        AiConversation conversation = requireOwnedForUpdate(conversationId, userId);
        conversation.setConsentVersion(POLICY_VERSION);
        conversation.setConsentedAt(now());
        conversation.setUpdatedAt(now());
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
        return sendInternal(principal, conversationId, rawIdempotencyKey, rawContent, false);
    }

    /**
     * Chunked-delivery entry point. Identical validated pipeline to
     * {@link #send}: retrieval, source reauthorization, generation and
     * persistence all complete before the caller replays the finished answer
     * as SSE slices (decision D-02). The flag only asks the upstream provider
     * to transport the already-computed answer incrementally so the wire
     * behaves like an event stream; it is not token streaming and never emits
     * unvalidated content.
     */
    public ChatExchangeResponse sendForChunkedDelivery(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String rawContent) {
        return sendInternal(principal, conversationId, rawIdempotencyKey, rawContent, true);
    }

    private ChatExchangeResponse sendInternal(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String rawContent,
            boolean chunkedDeliveryGeneration) {
        UUID userId = currentUserId(principal);
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        String content = normalizeContent(rawContent);

        long preparationStartedAt = System.nanoTime();
        PreparedMessage prepared = transactions.execute(status ->
            prepare(userId, conversationId, idempotencyKey, content)
        );
        if (prepared == null) {
            recordChatStage("preparation", "failed", preparationStartedAt);
            throw new BusinessException(500, ErrorCodes.INTERNAL_ERROR, "Could not prepare chat request");
        }
        if (prepared.replay() != null) {
            recordChatStage("preparation", "replay", preparationStartedAt);
            return prepared.replay();
        }
        recordChatStage("preparation", "completed", preparationStartedAt);

        try {
            AiConversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(this::notFound);
            SanitizedAiResponse sanitized = groundedResponse(
                userId, conversation.getMode(), content, recentTurns(conversationId), chunkedDeliveryGeneration);
            long persistenceStartedAt = System.nanoTime();
            ChatExchangeResponse completed;
            try {
                completed = transactions.execute(status ->
                    complete(
                        userId,
                        conversationId,
                        prepared.userMessageId(),
                        prepared.processingToken(),
                        sanitized,
                        conversation.getMode()
                    )
                );
            } catch (RuntimeException ex) {
                recordChatStage("persistence", "failed", persistenceStartedAt);
                throw ex;
            }
            if (completed == null) {
                recordChatStage("persistence", "failed", persistenceStartedAt);
                throw new BusinessException(500, ErrorCodes.INTERNAL_ERROR, "Could not persist AI response");
            }
            recordChatStage("persistence", "completed", persistenceStartedAt);
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

    public boolean isChunkedDeliveryEnabled() {
        return chunkedEnabled;
    }

    public ChatExchangeResponse sendPersisted(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String content) {
        return send(principal, conversationId, rawIdempotencyKey, content);
    }

    /**
     * Execute retrieval and generation as two distinct provider calls.  Every
     * candidate is re-authorized against SQL before it enters the allowlist;
     * the response is then checked again before persistence.
     */
    private SanitizedAiResponse groundedResponse(
            UUID userId,
            ChatMode mode,
            String content,
            List<Map<String, String>> turns) {
        return groundedResponse(userId, mode, content, turns, false);
    }

    private SanitizedAiResponse groundedResponse(
            UUID userId,
            ChatMode mode,
            String content,
            List<Map<String, String>> turns,
            boolean chunkedDeliveryGeneration) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("message", content);
        request.put("mode", mode.name());
        request.put("recent_turns", turns);
        // This assertion is a server-owned conjunction: the deployment flag
        // must be enabled and the current database guard must authorize this
        // user's complete synthetic fixture graph. Browsers cannot set it
        // through the public request body.
        request.put("synthetic_beta", syntheticBetaAsserted && syntheticBetaGuard.eligible(userId));
        Map<String, Object> retrieved = null;
        long retrievalStartedAt = System.nanoTime();
        try {
            retrieved = aiService.retrieveChat(request);
        } catch (RuntimeException ex) {
            log.warn(
                "AI candidate retrieval deferred requestId={} errorType={}",
                RequestTrace.currentId(), ex.getClass().getSimpleName()
            );
        } finally {
            recordChatStage(
                "retrieval-result", retrieved == null ? "unavailable" : "completed", retrievalStartedAt
            );
        }

        if (retrieved == null) {
            return supportAwareFallback(mode, content);
        }

        String safety = stringValue(retrieved.get("safety_action"));
        if (safety != null && !"ANSWER".equals(safety)) {
            return safetyResponse(mode, safety, content);
        }
        long authorizationStartedAt = System.nanoTime();
        List<AiChatSourceResolver.ResolvedSource> authorized;
        try {
            authorized = sourceResolver.authorize(mode, retrieved.get("candidates"));
        } catch (RuntimeException ex) {
            recordChatStage("source-authorization", "failed", authorizationStartedAt);
            throw ex;
        }
        recordChatStage(
            "source-authorization", authorized.isEmpty() ? "empty" : "completed", authorizationStartedAt
        );
        if (authorized.isEmpty()) {
            return supportAwareFallback(mode, content);
        }

        Map<String, Object> generation = new LinkedHashMap<>();
        generation.put("message", content);
        generation.put("mode", mode.name());
        generation.put("recent_turns", turns);
        generation.put("synthetic_beta", syntheticBetaAsserted && syntheticBetaGuard.eligible(userId));
        generation.put("authorized_sources", sourceResolver.authorizedPayload(authorized));
        // The upstream transport may deliver the answer incrementally, but the
        // FastAPI side only streams slices of a fully generated, fully
        // validated answer (D-02): these deltas are a consistency log used to
        // prove the delivered slices equal the persisted answer below.
        List<String> upstreamDeliverySlices = new ArrayList<>();
        long generationStartedAt = System.nanoTime();
        Map<String, Object> generated;
        try {
            generated = chunkedDeliveryGeneration
                ? aiService.generateChatStream(generation, upstreamDeliverySlices::add)
                : aiService.generateChat(generation);
        } catch (RuntimeException ex) {
            recordChatStage("generation-result", "failed", generationStartedAt);
            throw ex;
        }
        recordChatStage("generation-result", "completed", generationStartedAt);
        if (!upstreamDeliverySlices.isEmpty()
                && generated.get("answer") instanceof String answer
                && !String.join("", upstreamDeliverySlices).equals(answer)) {
            throw invalidAiResponse();
        }
        return sanitize(generated, mode, authorized, content);
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

    /**
     * Periodic cleanup running every 5 days to permanently purge
     * conversations older than 2 weeks (14 days).
     * Default cron triggers at 03:00 every 5 days.
     */
    @Scheduled(cron = "${ai.chat.two-week-cleanup-cron:0 0 3 1/5 * *}")
    @Transactional
    public int purgeConversationsOlderThanTwoWeeks() {
        if (!cleanupEnabled) {
            return 0;
        }
        OffsetDateTime cutoff = now().minusDays(twoWeekCleanupDays);
        int totalDeleted = 0;
        for (int batch = 0; batch < cleanupMaxBatches; batch++) {
            List<AiConversation> older = conversationRepository.findOlderThanCutoff(
                cutoff,
                PageRequest.of(0, cleanupBatchSize)
            );
            if (older.isEmpty()) {
                break;
            }
            conversationRepository.deleteAllInBatch(older);
            totalDeleted += older.size();
            if (older.size() < cleanupBatchSize) {
                break;
            }
        }
        if (totalDeleted > 0) {
            log.info("Purged {} AI conversations older than {} days (cutoff: {})", totalDeleted, twoWeekCleanupDays, cutoff);
        }
        return totalDeleted;
    }

    /**
     * A crash between the committed credit charge and the persisted exchange
     * leaves a PENDING message that no caller ever retries; without this sweep
     * the patient keeps the charge with no ledger compensation. Reuses the
     * exact recovery path (flip to FAILED + refund) that prepare() applies to
     * stale leases, so live traffic and the sweep cannot double-refund: the
     * PENDING guard inside the recovery is the idempotency point.
     */
    @Scheduled(cron = "${ai.chat.lease-repair-cron:0 */10 * * * *}")
    @Transactional
    public void repairStaleInFlight() {
        if (!cleanupEnabled) {
            return;
        }
        OffsetDateTime cutoff = now().minusSeconds(processingLeaseSeconds);
        List<AiConversation> stale = conversationRepository.findStaleInFlightForUpdate(
            cutoff,
            PageRequest.of(0, cleanupBatchSize)
        );
        for (AiConversation conversation : stale) {
            if (!processingLeaseExpired(conversation, now())) {
                continue;
            }
            recoverStaleInFlight(conversation);
        }
    }

    private PreparedMessage prepare(
            UUID userId,
            UUID conversationId,
            String idempotencyKey,
            String content) {
        AiConversation conversation = requireOwnedForUpdate(conversationId, userId);
        ensureModeEnabled(conversation.getMode());
        requireCurrentConsent(conversation);
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

        if (aiCreditService != null) {
            aiCreditService.requirePatientCredits(userId);
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

    private void chargeAcceptedPatientExchange(UUID userId) {
        if (aiCreditService != null) {
            aiCreditService.deductPatientCredit(userId, PATIENT_CHAT_CREDIT_DESCRIPTION);
        }
    }

    private ChatExchangeResponse complete(
            UUID userId,
            UUID conversationId,
            UUID userMessageId,
            UUID processingToken,
            SanitizedAiResponse response,
            ChatMode mode) {
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

        // Final linearization point: source/review rows are revalidated while
        // this transaction owns the conversation lock. Clinical edit, revoke,
        // or expiry either happened before this check (and fail closed) or
        // waits on the same source fence until after persistence.
        if (!response.finalSources().isEmpty()) {
            List<AiChatSourceResolver.ResolvedSource> currentSources =
                sourceResolver.revalidateForPersistence(mode, response.finalSources());
            if (currentSources.isEmpty() || !sameSourceSet(response.finalSources(), currentSources)) {
                response = insufficient(mode);
            } else {
                // Refresh SQL-owned labels/actions for operational sources;
                // clinical metadata remains byte-for-byte equivalent.
                response = response.withSources(
                    currentSources,
                    sourceResolver.citations(currentSources),
                    sourceResolver.actions(currentSources));
            }
        }

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
        reply.setSafetyAction(response.safetyAction());
        if (response.triage() != null) {
            Map<String, Object> triage = new LinkedHashMap<>();
            triage.put("urgency_level", response.triage().urgencyLevel());
            if (response.triage().recommendedSpecialty() != null) {
                triage.put("recommended_specialty", response.triage().recommendedSpecialty());
            }
            reply.setTriage(triage);
        }
        reply.setCreatedAt(completedAt);
        reply.setCompletedAt(completedAt);
        messageRepository.save(reply);

        if (DEFAULT_TITLE.equals(conversation.getTitle()) || "Cuoc tro chuyen moi".equals(conversation.getTitle())) {
            conversation.setTitle(deriveTitle(request.getContent()));
        }
        conversation.setInFlight(false);
        conversation.setInFlightStartedAt(null);
        conversation.setInFlightToken(null);
        conversation.setLastMessageAt(completedAt);
        conversation.setUpdatedAt(completedAt);
        conversation.setExpiresAt(expiry(completedAt));
        conversationRepository.save(conversation);
        chargeAcceptedPatientExchange(userId);
        return new ChatExchangeResponse(toMessage(request), toMessage(reply), false);
    }

    private boolean sameSourceSet(
            List<AiChatSourceResolver.ResolvedSource> expected,
            List<AiChatSourceResolver.ResolvedSource> actual) {
        if (expected.size() != actual.size()) return false;
        for (int index = 0; index < expected.size(); index++) {
            AiChatSourceResolver.ResolvedSource left = expected.get(index);
            AiChatSourceResolver.ResolvedSource right = actual.get(index);
            if (!java.util.Objects.equals(left.type(), right.type())
                    || !java.util.Objects.equals(left.id(), right.id())
                    || !java.util.Objects.equals(left.projectionKind(), right.projectionKind())
                    || !java.util.Objects.equals(left.contentRevision(), right.contentRevision())
                    || !java.util.Objects.equals(left.eligibilityRevision(), right.eligibilityRevision())
                    || !java.util.Objects.equals(left.contentHash(), right.contentHash())
                    || !java.util.Objects.equals(left.approvalId(), right.approvalId())) {
                return false;
            }
        }
        return true;
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

    private void refundFailedPatientExchange(UUID userId) {
        if (aiCreditService != null) {
            aiCreditService.refundPatientCredit(userId, PATIENT_CHAT_REFUND_DESCRIPTION);
        }
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

    private SanitizedAiResponse sanitize(
            Map<String, Object> response,
            ChatMode mode,
            List<AiChatSourceResolver.ResolvedSource> authorized) {
        return sanitize(response, mode, authorized, null);
    }

    private SanitizedAiResponse sanitize(
            Map<String, Object> response,
            ChatMode mode,
            List<AiChatSourceResolver.ResolvedSource> authorized,
            String userContent) {
        if (response == null || !(response.get("answer") instanceof String rawAnswer)) {
            throw invalidAiResponse();
        }
        String answer = rawAnswer.strip();
        if (answer.isEmpty() || answer.length() > MAX_ANSWER_LENGTH) {
            throw invalidAiResponse();
        }
        ChatMedicalSafety.rejectDiagnoseOrPrescribe(answer);
        String provenance = response.get("provenance") instanceof String value ? value : "";
        if (!PROVENANCE.contains(provenance)) {
            throw invalidAiResponse();
        }
        // DeepSeek/other remote providers are opt-in at the Spring boundary.
        // This prevents an upstream configuration drift from turning a local
        // or production patient-chat request into an unapproved remote call.
        if ("remote_provider".equals(provenance) && !remoteProviderEnabled) {
            throw invalidAiResponse();
        }
        String disclaimer = response.get("disclaimer") instanceof String value
            ? trim(value.strip(), 1_000)
            : SAFE_DISCLAIMER;
        if (disclaimer.isBlank()) {
            disclaimer = SAFE_DISCLAIMER;
        }
        ChatSafetyAction safetyAction = parseSafety(response.get("safety_action"));
        TriageSummary triage = parseTriage(response.get("triage"), mode);
        List<AiChatSourceResolver.ResolvedSource> finalSources = new ArrayList<>();
        if (!authorized.isEmpty()) {
            if (!usedSourcesMatch(response.get("used_sources"), authorized)) {
                throw invalidAiResponse();
            }
            for (AiChatSourceResolver.ResolvedSource source : authorized) {
                AiChatSourceResolver.ResolvedSource current = sourceResolver.revalidate(
                    mode, source.type(), source.id());
                if (current == null
                    || !sameRevision(source, current)) {
                    return insufficient(mode);
                }
                finalSources.add(current);
            }
        }
        boolean suppressSources = safetyAction == ChatSafetyAction.REFUSE
            || safetyAction == ChatSafetyAction.HUMAN_HANDOFF;
        List<Map<String, String>> citations = suppressSources
            ? List.of()
            : finalSources.isEmpty()
                ? sanitizeCitations(response.get("citations"))
                : sourceResolver.citations(finalSources);
        // An emergency response has one deterministic action only.  It must
        // never be crowded out by catalog CTAs, even when triage used an
        // approved specialty as supporting context.
        List<Map<String, String>> actions = safetyAction == ChatSafetyAction.EMERGENCY
            ? emergencyActions()
            : suppressSources || finalSources.isEmpty() ? List.of() : sourceResolver.actions(finalSources);
        if (actions.isEmpty()
                && mode == ChatMode.HOSPITAL_SUPPORT
                && safetyAction != ChatSafetyAction.EMERGENCY
                && safetyAction != ChatSafetyAction.REFUSE
                && safetyAction != ChatSafetyAction.HUMAN_HANDOFF) {
            actions = ChatSuggestedActionResolver.hospitalSupportFallback(userContent);
        }
        return new SanitizedAiResponse(
            answer,
            disclaimer,
            provenance,
            citations,
            safetyAction,
            triage,
            actions,
            finalSources.isEmpty() ? "UNAVAILABLE" : "CURRENT",
            List.copyOf(finalSources)
        );
    }

    private boolean usedSourcesMatch(
            Object raw,
            List<AiChatSourceResolver.ResolvedSource> authorized) {
        if (!(raw instanceof List<?> values) || values.size() != authorized.size()) return false;
        Map<String, AiChatSourceResolver.ResolvedSource> expectedByKey = authorized.stream()
            .collect(java.util.stream.Collectors.toMap(
                AiChatSourceResolver.ResolvedSource::key, item -> item));
        Set<String> actual = new java.util.HashSet<>();
        for (Object value : values) {
            if (!(value instanceof Map<?, ?> item)) return false;
            String type = stringValue(item.get("source_type"));
            String id = stringValue(item.get("source_id"));
            if (type == null) type = stringValue(item.get("sourceType"));
            if (id == null) id = stringValue(item.get("sourceId"));
            if (type == null || id == null) return false;
            String key = type.toLowerCase(java.util.Locale.ROOT) + ":" + id;
            if (!actual.add(key)) return false;
            AiChatSourceResolver.ResolvedSource expected = expectedByKey.get(key);
            if (expected == null) return false;
            String projection = stringValue(item.get("projection_kind"));
            if (projection == null) projection = stringValue(item.get("projectionKind"));
            if (!java.util.Objects.equals(expected.projectionKind(), projection)) return false;
            if (!numberMatches(item, "content_revision", "contentRevision", expected.contentRevision())
                || !numberMatches(item, "eligibility_revision", "eligibilityRevision", expected.eligibilityRevision())
                || !textMatches(item, "content_hash", "contentHash", expected.contentHash())
                || !textMatches(item, "approval_id", "approvalId", expected.approvalId())) return false;
        }
        return expectedByKey.keySet().equals(actual);
    }

    private boolean numberMatches(Map<?, ?> item, String snake, String camel, Long expected) {
        Object raw = item.containsKey(snake) ? item.get(snake) : item.get(camel);
        if (expected == null) return raw == null;
        if (raw instanceof Number number) return number.longValue() == expected;
        try { return raw != null && Long.parseLong(String.valueOf(raw)) == expected; }
        catch (NumberFormatException ex) { return false; }
    }

    private boolean textMatches(Map<?, ?> item, String snake, String camel, String expected) {
        Object raw = item.containsKey(snake) ? item.get(snake) : item.get(camel);
        if (expected == null) return raw == null;
        return expected.equals(raw == null ? null : String.valueOf(raw));
    }

    private boolean sameRevision(
            AiChatSourceResolver.ResolvedSource expected,
            AiChatSourceResolver.ResolvedSource actual) {
        return java.util.Objects.equals(expected.projectionKind(), actual.projectionKind())
            && java.util.Objects.equals(expected.contentRevision(), actual.contentRevision())
            && java.util.Objects.equals(expected.eligibilityRevision(), actual.eligibilityRevision())
            && java.util.Objects.equals(expected.contentHash(), actual.contentHash())
            && java.util.Objects.equals(expected.approvalId(), actual.approvalId());
    }

    private ChatSafetyAction parseSafety(Object raw) {
        String value = stringValue(raw);
        if (value == null) return ChatSafetyAction.ANSWER;
        try { return ChatSafetyAction.valueOf(value); }
        catch (IllegalArgumentException ex) { throw invalidAiResponse(); }
    }

    private TriageSummary parseTriage(Object raw, ChatMode mode) {
        if (raw == null) return null;
        // Triage is a mode-specific contract.  Never persist or expose a
        // provider-supplied triage object for operational/educational chats.
        if (mode != ChatMode.SYMPTOM_TRIAGE || !(raw instanceof Map<?, ?> value)) {
            throw invalidAiResponse();
        }
        for (Object key : value.keySet()) {
            if (!(key instanceof String name)
                    || !(name.equals("urgency_level") || name.equals("urgencyLevel")
                        || name.equals("recommended_specialty") || name.equals("recommendedSpecialty"))) {
                throw invalidAiResponse();
            }
        }
        if ((value.containsKey("urgency_level") && value.containsKey("urgencyLevel")
                && !java.util.Objects.equals(value.get("urgency_level"), value.get("urgencyLevel")))
            || (value.containsKey("recommended_specialty") && value.containsKey("recommendedSpecialty")
                && !java.util.Objects.equals(value.get("recommended_specialty"), value.get("recommendedSpecialty")))) {
            throw invalidAiResponse();
        }
        if ((value.containsKey("urgency_level") && !(value.get("urgency_level") instanceof String))
                || (value.containsKey("urgencyLevel") && !(value.get("urgencyLevel") instanceof String))
                || (value.containsKey("recommended_specialty") && value.get("recommended_specialty") != null
                    && (!(value.get("recommended_specialty") instanceof String specialtyValue)
                        || specialtyValue.isBlank()))
                || (value.containsKey("recommendedSpecialty") && value.get("recommendedSpecialty") != null
                    && (!(value.get("recommendedSpecialty") instanceof String specialtyValue)
                        || specialtyValue.isBlank()))) {
            throw invalidAiResponse();
        }
        String urgency = stringValue(value.get("urgency_level"));
        if (urgency == null) urgency = stringValue(value.get("urgencyLevel"));
        String specialty = stringValue(value.get("recommended_specialty"));
        if (specialty == null) specialty = stringValue(value.get("recommendedSpecialty"));
        if (urgency == null || !TRIAGE_URGENCY.contains(urgency)
                || (specialty != null && !TRIAGE_SPECIALTIES.contains(specialty))) {
            throw invalidAiResponse();
        }
        return new TriageSummary(urgency, specialty);
    }

    private SanitizedAiResponse safetyResponse(ChatMode mode, String rawSafety, String userContent) {
        ChatSafetyAction action;
        try { action = ChatSafetyAction.valueOf(rawSafety); }
        catch (IllegalArgumentException ex) { throw invalidAiResponse(); }
        String answer = switch (action) {
            case EMERGENCY -> "Nếu bạn đang có dấu hiệu nguy hiểm, hãy gọi 115 ngay hoặc đến cơ sở y tế gần nhất. Tôi không tự động gọi thay bạn.";
            case REFUSE -> isIdentityOrDataRequest(userContent)
                ? "Tôi không thể tìm kiếm hoặc chia sẻ thông tin nhận dạng, hồ sơ bệnh án hay dữ liệu cá nhân của bất kỳ ai. Nếu bạn cần trích sao hồ sơ của chính mình, hãy liên hệ bộ phận Quản lý hồ sơ của bệnh viện qua mục Liên hệ."
                : "Tôi không thể chẩn đoán hoặc kê đơn. Bạn nên trao đổi trực tiếp với bác sĩ.";
            case HUMAN_HANDOFF -> "Tôi chưa thể xử lý an toàn yêu cầu này. Bạn có thể trao đổi với nhân viên y tế.";
            default -> "Tôi chưa tìm thấy thông tin đủ tin cậy để trả lời.";
        };
        return new SanitizedAiResponse(
            answer,
            SAFE_DISCLAIMER,
            "local_fallback",
            List.of(),
            action,
            null,
            action == ChatSafetyAction.EMERGENCY ? emergencyActions() : List.of(),
            "CURRENT",
            List.of()
        );
    }

    /**
     * A refusal that names an identifier or record kind should say so.  The
     * generic diagnose/prescribe refusal otherwise reads as a non-sequitur
     * when the rejected request was for someone else's data.
     */
    private static final java.util.regex.Pattern IDENTITY_OR_DATA_REQUEST =
        java.util.regex.Pattern.compile(
            "(?iu)(?:m[ãa]\\s+(?:b[eệ]nh\\s+nh[âa]n|h[eồ]\\s+s[eơ]|\\u0111[ặa]t\\s+l[ịi]ch)"
                + "|(?:patient|medical\\s+record|appointment)\\s*(?:id|number)"
                + "|h[eồ]\\s+s[eơ][^.]{0,20}?c[ủu]a\\s+(?:ng[ưu]ời|ai|t[ôo]i|b[eệ]nh\\s+nh[âa]n)"
                + "|(?:t[iì]m|tra\\s+c[ứu]|li[eệ]t\\s+k[êe]|xem|show|list|reveal|give|cho\\s+t[ôo]i)"
                + "[^.]{0,40}?(?:h[eồ]\\s+s[eơ]|d[ữ]\\s+li[eệ]u|th[ôo]ng\\s+tin)"
                + "|(?:data|information|records?)\\s+(?:of|for)\\s+\\w+"
                + ")"
        );

    private boolean isIdentityOrDataRequest(String userContent) {
        return userContent != null && IDENTITY_OR_DATA_REQUEST.matcher(userContent).find();
    }

    private SanitizedAiResponse insufficient(ChatMode mode) {
        return new SanitizedAiResponse(
            "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời để tránh suy đoán. Bạn có thể chọn mode khác hoặc trao đổi trực tiếp với nhân viên y tế.",
            SAFE_DISCLAIMER,
            "local_fallback",
            List.of(),
            ChatSafetyAction.INSUFFICIENT_EVIDENCE,
            null,
            List.of(),
            "UNAVAILABLE",
            List.of()
        );
    }

    private SanitizedAiResponse supportAwareFallback(ChatMode mode, String content) {
        return mode == ChatMode.HOSPITAL_SUPPORT
            ? hospitalSupportResponse(content)
            : insufficient(mode);
    }

    /**
     * Keep the deterministic hospital-support copy available for focused
     * contract checks and future local UX fallbacks. It is explicitly marked
     * as insufficient evidence because it is navigation guidance, not a
     * HealthCare-curated answer or citation-bearing RAG response.
     */
    private SanitizedAiResponse hospitalSupportResponse(String content) {
        ChatSuggestedActionResolver.HospitalSupportIntent intent =
            ChatSuggestedActionResolver.classify(content);
        if (intent == ChatSuggestedActionResolver.HospitalSupportIntent.CATALOG) {
            SanitizedAiResponse catalog = catalogOverviewResponse(content);
            if (catalog != null) return catalog;
        }
        if (intent == ChatSuggestedActionResolver.HospitalSupportIntent.BRANCH) {
            SanitizedAiResponse branch = branchDetailsResponse(content);
            if (branch != null) return branch;
        }

        String answer = switch (intent) {
            case GREETING ->
                "Xin chào! Mình có thể hỗ trợ bạn tra cứu Chuyên khoa, Bác sĩ, Cơ sở & giờ làm việc "
                    + "hoặc hướng dẫn bắt đầu đặt lịch khám tại HealthCare.";
            case SPECIALTY_GUIDANCE ->
                "Mình chưa thể xác định chuyên khoa phù hợp chỉ từ mô tả hiện tại. "
                    + "Bạn hãy cho biết triệu chứng chính, thời gian xuất hiện và mức độ ảnh hưởng; "
                    + "hoặc mở danh sách Chuyên khoa để xem thông tin chính thức của HealthCare.";
            case BOOKING ->
                "Bạn có thể bắt đầu tại trang Đặt lịch khám: chọn chuyên khoa hoặc bác sĩ, "
                    + "sau đó chọn cơ sở và khung giờ còn trống. Nếu chưa biết nên bắt đầu từ đâu, "
                    + "hãy mở danh sách Chuyên khoa.";
            case CATALOG ->
                "Bạn muốn tra cứu mục nào? Hãy chọn Chuyên khoa, Bác sĩ hoặc Cơ sở & giờ làm việc "
                    + "bên dưới để xem thông tin chính thức của HealthCare.";
            case DOCTOR ->
                "Để tìm bác sĩ phù hợp, bạn có thể mở danh sách Bác sĩ để xem thông tin hiện có; "
                    + "sau đó chọn Đặt lịch khám nếu muốn tiếp tục.";
            case PACKAGE ->
                "Bạn có thể xem các Gói khám của HealthCare và chọn gói phù hợp trước khi đặt lịch.";
            case SERVICE ->
                "Bạn có thể xem danh mục Dịch vụ của HealthCare để kiểm tra thông tin trước khi đặt lịch.";
            case BRANCH ->
                "Giờ làm việc có thể khác theo từng cơ sở. Hãy mở mục Cơ sở & giờ làm việc "
                    + "để xem thông tin hiện tại trước khi đến khám.";
            case PREPARATION ->
                "Trước khi đi khám, bạn nên kiểm tra hướng dẫn của cơ sở, mang giấy tờ cần thiết "
                    + "và các kết quả hoặc đơn thuốc liên quan nếu có. Yêu cầu chuẩn bị có thể khác "
                    + "theo dịch vụ; hãy xác nhận lại khi đặt lịch hoặc với cơ sở.";
            case GENERAL ->
                "Mình có thể hỗ trợ tra cứu Chuyên khoa, Bác sĩ, Gói khám, Dịch vụ, "
                    + "Cơ sở & giờ làm việc và hướng dẫn Đặt lịch. Bạn đang muốn tìm mục nào?";
        };

        return new SanitizedAiResponse(
            answer,
            SAFE_DISCLAIMER,
            "local_fallback",
            List.of(),
            ChatSafetyAction.INSUFFICIENT_EVIDENCE,
            null,
            ChatSuggestedActionResolver.hospitalSupportFallback(content),
            "UNAVAILABLE",
            List.of()
        );
    }

    /**
     * Give broad catalog questions a useful answer during a RAG cold start or
     * retrieval outage.  This path is deliberately deterministic and marked
     * local_fallback: it reports only live Spring catalog identities that are
     * also carried as citations, never a guessed LLM answer.
     */
    private SanitizedAiResponse catalogOverviewResponse(String content) {
        AiChatSourceResolver.CatalogOverview overview;
        try {
            overview = sourceResolver.catalogOverview();
        } catch (RuntimeException ex) {
            return null;
        }
        if (overview == null || !overview.hasData()) return null;

        List<AiChatSourceResolver.ResolvedSource> sources = overview.sources();
        if (sources.isEmpty()) return null;
        List<Map<String, String>> citations = sourceResolver.citations(sources);
        if (citations == null || citations.isEmpty()) return null;

        String answer = overview.summary()
            + " Bạn có thể mở các mục bên dưới để xem thông tin chi tiết và đặt lịch.";

        return new SanitizedAiResponse(
            answer,
            SAFE_DISCLAIMER,
            "local_fallback",
            citations,
            ChatSafetyAction.ANSWER,
            null,
            ChatSuggestedActionResolver.hospitalSupportFallback(content),
            "CURRENT",
            sources
        );
    }

    /**
     * Answer a uniquely identified branch question from the live operational
     * catalog during a RAG cold start.  Ambiguous branch numbers and missing
     * rows intentionally return null so the normal insufficient-evidence path
     * remains the safe outcome.
     */
    private SanitizedAiResponse branchDetailsResponse(String content) {
        List<AiChatSourceResolver.BranchDetails> matches;
        try {
            matches = sourceResolver.branchDetails(content);
        } catch (RuntimeException ex) {
            return null;
        }
        if (matches == null || matches.size() != 1 || matches.get(0) == null
                || matches.get(0).source() == null) {
            return null;
        }

        AiChatSourceResolver.BranchDetails branch = matches.get(0);
        AiChatSourceResolver.ResolvedSource source = branch.source();
        List<Map<String, String>> citations;
        try {
            citations = sourceResolver.citations(List.of(source));
        } catch (RuntimeException ex) {
            return null;
        }
        if (citations == null || citations.isEmpty()) return null;

        String address = branch.address() == null
            ? "Địa chỉ đang cập nhật."
            : "Địa chỉ: " + branch.address() + ".";
        String hours = branch.workingHours() == null
            ? "Giờ làm việc đang cập nhật; bạn nên kiểm tra lại trước khi đến."
            : "Giờ làm việc: " + branch.workingHours() + ".";
        List<Map<String, String>> actions = sourceResolver.actions(List.of(source));
        if (actions == null || actions.isEmpty()) {
            actions = ChatSuggestedActionResolver.hospitalSupportFallback(content);
        }

        return new SanitizedAiResponse(
            "Theo dữ liệu cơ sở đang hoạt động, " + source.title() + ". "
                + address + " " + hours
                + " Bạn có thể mở nguồn bên dưới để xem chi tiết và đặt lịch.",
            SAFE_DISCLAIMER,
            "local_fallback",
            citations,
            ChatSafetyAction.ANSWER,
            null,
            actions,
            "CURRENT",
            List.of(source)
        );
    }

    private List<Map<String, String>> emergencyActions() {
        return List.of(Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115"));
    }

    private String stringValue(Object value) {
        return value instanceof String text && !text.isBlank() ? text.strip() : null;
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

    private void requireCurrentConsent(AiConversation conversation) {
        if (!POLICY_VERSION.equals(conversation.getConsentVersion())
                || conversation.getConsentedAt() == null) {
            throw new BusinessException(428, "CHAT_CONSENT_REQUIRED", "Current chat consent is required");
        }
    }

    private void ensureModeEnabled(ChatMode mode) {
        boolean enabled = switch (mode) {
            case HOSPITAL_SUPPORT -> true;
            case SYMPTOM_TRIAGE -> symptomTriageEnabled;
            case HEALTH_EDUCATION -> healthEducationEnabled;
        };
        if (!enabled) {
            throw new BusinessException(
                503,
                ErrorCodes.AI_UNAVAILABLE,
                "This clinical chat mode is temporarily unavailable"
            );
        }
    }

    @Transactional
    public FeedbackResponse setFeedback(
            UserDetails principal,
            UUID conversationId,
            UUID messageId,
            FeedbackRating rating) {
        UUID userId = currentUserId(principal);
        if (rating == null) {
            throw new BusinessException(400, "CHAT_FEEDBACK_INVALID", "Feedback rating is required");
        }
        AiConversation conversation = requireOwned(conversationId, userId);
        AiMessage message = messageRepository.findById(messageId)
            .filter(value -> value.getConversation().getId().equals(conversationId))
            .filter(value -> value.getRole() == AiMessageRole.ASSISTANT)
            .filter(value -> value.getStatus() == AiMessageStatus.COMPLETED)
            .orElseThrow(this::feedbackNotFound);
        AiMessageFeedback feedback = feedbackRepository.findById(message.getId()).orElseGet(() -> {
            AiMessageFeedback created = new AiMessageFeedback();
            created.setAssistantMessageId(message.getId());
            created.setCreatedAt(now());
            return created;
        });
        feedback.setRating(rating);
        feedback.setUpdatedAt(now());
        AiMessageFeedback saved = feedbackRepository.save(feedback);
        return new FeedbackResponse(saved.getRating(), saved.getCreatedAt(), saved.getUpdatedAt());
    }

    @Transactional
    public void deleteFeedback(UserDetails principal, UUID conversationId, UUID messageId) {
        UUID userId = currentUserId(principal);
        requireOwned(conversationId, userId);
        AiMessage message = messageRepository.findById(messageId)
            .filter(value -> value.getConversation().getId().equals(conversationId))
            .filter(value -> value.getRole() == AiMessageRole.ASSISTANT)
            .filter(value -> value.getStatus() == AiMessageStatus.COMPLETED)
            .orElseThrow(this::feedbackNotFound);
        feedbackRepository.deleteById(message.getId());
    }

    private BusinessException feedbackNotFound() {
        return new BusinessException(404, "AI_CONVERSATION_NOT_FOUND", "Message not found");
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
        ChatMode mode = value.getMode() == null ? ChatMode.HOSPITAL_SUPPORT : value.getMode();
        return new ConversationResponse(
            value.getId(),
            value.getTitle(),
            value.getStatus().name(),
            mode,
            value.isInFlight(),
            value.getConsentVersion(),
            value.getConsentedAt(),
            !POLICY_VERSION.equals(value.getConsentVersion()) || value.getConsentedAt() == null,
            value.getCreatedAt(),
            value.getUpdatedAt(),
            value.getLastMessageAt(),
            value.getExpiresAt()
        );
    }

    private MessageResponse toMessage(AiMessage value) {
        List<Map<String, String>> storedCitations = value.getCitations() == null
            ? List.of() : List.copyOf(value.getCitations());
        // Revision/hash metadata is persisted for fail-closed history reloads,
        // but remains an internal provenance detail rather than a public
        // citation field.
        List<Map<String, String>> citations = publicCitations(storedCitations);
        List<AiChatSourceResolver.ResolvedSource> currentSources = new ArrayList<>();
        boolean stale = false;
        ChatMode mode = value.getConversation().getMode() == null
            ? ChatMode.HOSPITAL_SUPPORT : value.getConversation().getMode();
        for (Map<String, String> citation : storedCitations) {
            AiChatSourceResolver.ResolvedSource source = sourceResolver.revalidate(
                mode, citation.get("source_type"), citation.get("source_id"));
            if (source == null || !citationMatchesCurrent(source, citation)) stale = true;
            else currentSources.add(source);
        }
        String requestContent = value.getRole() == AiMessageRole.ASSISTANT
            && value.getRequestMessage() != null
            ? value.getRequestMessage().getContent() : null;
        List<AiChatSourceResolver.ResolvedSource> displaySources =
            AiChatHistorySanitizer.focusSourcesForQuestion(requestContent, currentSources);
        List<Map<String, String>> actions = value.getSafetyAction() == ChatSafetyAction.EMERGENCY
            ? emergencyActions()
            : stale ? List.of() : sourceResolver.actions(displaySources);
        if (actions.isEmpty()
                && !stale
                && value.getRole() == AiMessageRole.ASSISTANT
                && value.getStatus() == AiMessageStatus.COMPLETED
                && mode == ChatMode.HOSPITAL_SUPPORT
                && value.getSafetyAction() != ChatSafetyAction.EMERGENCY
                && value.getSafetyAction() != ChatSafetyAction.REFUSE
                && value.getSafetyAction() != ChatSafetyAction.HUMAN_HANDOFF) {
            actions = ChatSuggestedActionResolver.hospitalSupportFallback(requestContent);
        }
        FeedbackResponse feedback = feedbackRepository.findById(value.getId())
            .map(item -> new FeedbackResponse(item.getRating(), item.getCreatedAt(), item.getUpdatedAt()))
            .orElse(null);
        TriageSummary triage = parseTriage(value.getTriage(), mode);
        String sourceStatus = stale
            ? "STALE"
            : value.getSafetyAction() == ChatSafetyAction.INSUFFICIENT_EVIDENCE
                ? "UNAVAILABLE"
                : "CURRENT";
        if (!stale && value.getRole() == AiMessageRole.ASSISTANT && !currentSources.isEmpty()) {
            // Reuse current catalog labels on history reload so branch-aware
            // doctor identities are not lost in legacy persisted citations.
            citations = publicCitations(sourceResolver.citations(displaySources));
        }
        String content = AiChatHistorySanitizer.sanitize(
            value.getRole(), value.getContent(), requestContent, displaySources, value.getProvenance());
        return new MessageResponse(
            value.getId(),
            value.getRole().name(),
            value.getStatus().name(),
            content,
            value.getSequenceNumber(),
            value.getDisclaimer(),
            value.getProvenance(),
            citations,
            value.getSafetyAction(),
            triage,
            actions.stream().map(item -> new SuggestedAction(
                item.get("kind"), item.get("label"), item.get("href"))).toList(),
            feedback,
            sourceStatus,
            value.getCreatedAt(),
            value.getCompletedAt()
        );
    }

    private boolean citationMatchesCurrent(
            AiChatSourceResolver.ResolvedSource source,
            Map<String, String> citation) {
        if (!java.util.Objects.equals(source.type(), citation.get("source_type"))
                || !java.util.Objects.equals(source.id(), citation.get("source_id"))
                || !java.util.Objects.equals(source.projectionKind(), citation.get("projection_kind"))) {
            return false;
        }
        return optionalMetadataMatches(citation, "content_revision", source.contentRevision())
            && optionalMetadataMatches(citation, "eligibility_revision", source.eligibilityRevision())
            && optionalMetadataMatches(citation, "content_hash", source.contentHash())
            && optionalMetadataMatches(citation, "approval_id", source.approvalId());
    }

    private boolean optionalMetadataMatches(
            Map<String, String> citation,
            String key,
            Object expected) {
        String actual = citation.get(key);
        if (expected == null) {
            // Operational projections intentionally omit clinical metadata;
            // accepting a non-empty unexpected value would hide provenance
            // drift or a forged citation.
            return actual == null || actual.isBlank();
        }
        return actual != null && actual.equals(String.valueOf(expected));
    }

    private List<Map<String, String>> publicCitations(List<Map<String, String>> stored) {
        List<Map<String, String>> result = new ArrayList<>();
        for (Map<String, String> citation : stored) {
            Map<String, String> clean = new LinkedHashMap<>();
            if (citation.get("source_type") != null) clean.put("source_type", citation.get("source_type"));
            if (citation.get("source_id") != null) clean.put("source_id", citation.get("source_id"));
            if (citation.get("title") != null) clean.put("title", citation.get("title"));
            result.add(Map.copyOf(clean));
        }
        return List.copyOf(result);
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

    private void recordChatStage(String stage, String outcome, long startedAt) {
        String requestId = RequestTrace.currentId();
        if (requestId == null) return;
        long durationMillis = Math.max(0L, (System.nanoTime() - startedAt) / 1_000_000L);
        log.info(
            "AI chat stage requestId={} stage={} outcome={} durationMs={}",
            requestId, stage, outcome, durationMillis
        );
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
        List<Map<String, String>> citations,
        ChatSafetyAction safetyAction,
        TriageSummary triage,
        List<Map<String, String>> suggestedActions,
        String sourceStatus,
        List<AiChatSourceResolver.ResolvedSource> finalSources
    ) {
        SanitizedAiResponse withSources(
                List<AiChatSourceResolver.ResolvedSource> sources,
                List<Map<String, String>> refreshedCitations,
                List<Map<String, String>> refreshedActions) {
            return new SanitizedAiResponse(
                answer,
                disclaimer,
                provenance,
                refreshedCitations,
                safetyAction,
                triage,
                refreshedActions,
                sourceStatus,
                List.copyOf(sources)
            );
        }
    }
}
