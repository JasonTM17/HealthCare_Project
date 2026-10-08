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
import com.healthcare.ai.chat.dto.ChatContracts.UsedSourceSummary;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
        + "không chẩn đoán/kê đơn và có thể chuyển bạn tới nhân viên y tế. "
        + "Nội dung báo hiệu nguy cơ khẩn cấp (tự tử, cấp cứu) vẫn được lưu và "
        + "trả lời hướng dẫn gọi 115 theo nghĩa vụ an toàn, kể cả khi chưa đồng ý "
        + "hoặc đồng ý đã hết hạn.";
    private static final String PATIENT_CHAT_CREDIT_DESCRIPTION = "Lượt sử dụng Trợ lý AI Y khoa";
    private static final String PATIENT_CHAT_REFUND_DESCRIPTION =
        "Hoàn credit cho lượt hỏi AI không thành công";
    private static final String PATIENT_CHAT_WAIVED_DESCRIPTION =
        "Không tính credit: câu trả lời thiếu nguồn đủ tin cậy";
    private static final String PATIENT_SAFETY_CHAT_WAIVED_DESCRIPTION =
        "Không tính credit: câu trả lời an toàn cố định của hệ thống";
    private static final String PATIENT_LOCAL_CHAT_WAIVED_DESCRIPTION =
        "Không tính credit: câu trả lời tra cứu danh mục cục bộ của hệ thống";
    /** Ledger marker that attributes charge/refund/waiver rows to one attempt. */
    private static final String CHAT_ATTEMPT_MARKER_PREFIX = "[chat:";

    // Field injection on purpose: this service has four constructor overloads
    // (three are test-compat shims), and personalization must degrade to the
    // default tuning — not break construction — when a test builds the service
    // by hand without the collaborator.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private AiPatientContextService patientContextService;

    // Same field-injection contract as patientContextService above: hand-built
    // test instances must still construct without the collaborator, and a
    // missing service only means no admin fan-out — never a failed chat turn.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.healthcare.notification.service.NotificationService notificationService;

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final AiMessageFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final AiService aiService;
    private final AiCreditService aiCreditService;
    private final AiChatSourceResolver sourceResolver;
    private final TransactionTemplate transactions;
    private final TransactionTemplate alertTransactions;
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
    private final ChatRequestCancellationRegistry cancellationRegistry;

    @Value("${ai.chat.chunked-enabled:false}")
    private boolean chunkedEnabled = false;

    /**
     * @deprecated Legacy window of the periodic stale-chat sweep. The sweep
     * now cuts off at the full {@code ai.chat.retention-days} window: purging
     * conversations that were idle for only 14 days silently broke the consent
     * promise "Chat được lưu tối đa 90 ngày" (76 days of early deletion, and
     * it also destroyed the credit-ledger attempt markers before reconciliation
     * could run). The property stays bindable so existing deployments that set
     * {@code ai.chat.two-week-cleanup-days} start cleanly; its value is ignored.
     */
    @Deprecated(forRemoval = true)
    @Value("${ai.chat.two-week-cleanup-days:14}")
    @SuppressWarnings("unused")
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
            @Value("${ai.chat.remote-provider-enabled:false}") boolean remoteProviderEnabled,
            @Value("${ai.chat.symptom-triage-enabled:false}") boolean symptomTriageEnabled,
            @Value("${ai.chat.health-education-enabled:false}") boolean healthEducationEnabled,
            @Value("${ai.chat.synthetic-beta-asserted:false}") boolean syntheticBetaAsserted,
            SyntheticBetaGuardService syntheticBetaGuard,
            ChatRequestCancellationRegistry cancellationRegistry) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
        this.aiService = aiService;
        this.aiCreditService = aiCreditService;
        this.sourceResolver = sourceResolver;
        this.transactions = new TransactionTemplate(transactionManager);
        // afterCommit work runs while the completed transaction's context is
        // still bound: a REQUIRED template would join the dying transaction
        // and its EntityManager would see no live JDBC transaction. The alert
        // fan-out therefore suspends that context and starts a real one.
        this.alertTransactions = new TransactionTemplate(transactionManager);
        this.alertTransactions.setPropagationBehavior(
            org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
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
        this.cancellationRegistry = cancellationRegistry;
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
            SyntheticBetaGuardService.disabled(),
            null
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
            SyntheticBetaGuardService.disabled(),
            null
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
            syntheticBetaGuard,
            null
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
        List<ChatMode> enabledModes = new ArrayList<>();
        enabledModes.add(ChatMode.HOSPITAL_SUPPORT);
        if (symptomTriageEnabled) enabledModes.add(ChatMode.SYMPTOM_TRIAGE);
        if (healthEducationEnabled) enabledModes.add(ChatMode.HEALTH_EDUCATION);
        return new ChatPolicyResponse(POLICY_VERSION, retentionDays, CONSENT_TEXT, remoteProviderEnabled, enabledModes);
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
        return send(principal, conversationId, rawIdempotencyKey, rawContent, null);
    }

    public ChatExchangeResponse send(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String rawContent,
            ChatRequestCancellation cancellation) {
        return sendInternal(principal, conversationId, rawIdempotencyKey, rawContent, false, cancellation);
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
        return sendForChunkedDelivery(principal, conversationId, rawIdempotencyKey, rawContent, null);
    }

    public ChatExchangeResponse sendForChunkedDelivery(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String rawContent,
            ChatRequestCancellation cancellation) {
        return sendInternal(principal, conversationId, rawIdempotencyKey, rawContent, true, cancellation);
    }

    /** Validates the authenticated owner and normalizes the idempotency binding before lease creation. */
    @Transactional(readOnly = true)
    public PatientChatLeaseBinding authorizePatientChatLease(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey) {
        UUID userId = currentUserId(principal);
        requireOwned(conversationId, userId);
        return new PatientChatLeaseBinding(
            userId,
            conversationId,
            normalizeIdempotencyKey(rawIdempotencyKey)
        );
    }

    /** Generates and validates a patient reply while leaving persistence behind the private BFF commit gate. */
    public PreparedChatResult prepareForBffCommit(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String rawContent,
            boolean chunkedDeliveryGeneration,
            ChatRequestCancellation cancellation) {
        if (cancellation == null || cancellationRegistry == null) {
            throw new IllegalStateException("Shared chat cancellation state is not configured");
        }
        cancellation.throwIfCancelled();
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
            cancellationRegistry.complete(cancellation);
            recordChatStage("preparation", "replay", preparationStartedAt);
            return new PreparedChatResult(prepared.replay(), null);
        }
        recordChatStage("preparation", "completed", preparationStartedAt);

        try {
            GeneratedChatDraft generated = generatePreparedAnswer(
                userId, conversationId, content, prepared, chunkedDeliveryGeneration, cancellation);
            cancellation.throwIfCancelled();
            return new PreparedChatResult(null, new PreparedChatCommitPayload(
                cancellation.requestId(),
                userId,
                conversationId,
                idempotencyKey,
                prepared.userMessageId(),
                prepared.processingToken(),
                generated.mode(),
                generated.response()
            ));
        } catch (BusinessException exception) {
            markFailed(userId, conversationId, prepared.userMessageId(), prepared.processingToken());
            cancellationRegistry.fail(cancellation.requestId());
            throw exception;
        } catch (RuntimeException exception) {
            markFailed(userId, conversationId, prepared.userMessageId(), prepared.processingToken());
            cancellationRegistry.fail(cancellation.requestId());
            throw new BusinessException(
                503,
                ErrorCodes.AI_UNAVAILABLE,
                "AI assistant is temporarily unavailable. Please try again."
            );
        }
    }

    /** Verifies the private payload bindings, then claims Redis before the existing SQL commit transaction. */
    public ChatExchangeResponse commitPreparedForBff(
            UserDetails principal,
            String requestId,
            UUID conversationId,
            String rawIdempotencyKey,
            PreparedChatCommitPayload payload) {
        UUID userId = currentUserId(principal);
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        if (payload == null
                || payload.requestId() == null
                || !payload.requestId().equals(requestId)
                || !userId.equals(payload.patientId())
                || !conversationId.equals(payload.conversationId())
                || !idempotencyKey.equals(payload.idempotencyKey())
                || payload.userMessageId() == null
                || payload.processingToken() == null
                || payload.mode() == null
                || payload.response() == null) {
            throw new BusinessException(400, ErrorCodes.CHAT_INPUT_INVALID, "Prepared AI response is invalid");
        }
        if (cancellationRegistry == null) {
            throw new IllegalStateException("Shared chat cancellation state is not configured");
        }

        try {
            cancellationRegistry.claimCommit(
                requestId,
                ChatRequestCancellationRegistry.LeaseBinding.patient(userId, conversationId, idempotencyKey));
            long persistenceStartedAt = System.nanoTime();
            ChatExchangeResponse completed;
            try {
                completed = transactions.execute(status ->
                    complete(
                        userId,
                        conversationId,
                        payload.userMessageId(),
                        payload.processingToken(),
                        payload.response(),
                        payload.mode()
                    )
                );
            } catch (RuntimeException exception) {
                recordChatStage("persistence", "failed", persistenceStartedAt);
                throw exception;
            }
            if (completed == null) {
                recordChatStage("persistence", "failed", persistenceStartedAt);
                throw new BusinessException(500, ErrorCodes.INTERNAL_ERROR, "Could not persist AI response");
            }
            recordChatStage("persistence", "completed", persistenceStartedAt);
            cancellationRegistry.complete(requestId);
            return completed;
        } catch (BusinessException exception) {
            markFailed(userId, conversationId, payload.userMessageId(), payload.processingToken());
            cancellationRegistry.fail(requestId);
            throw exception;
        } catch (RuntimeException exception) {
            markFailed(userId, conversationId, payload.userMessageId(), payload.processingToken());
            cancellationRegistry.fail(requestId);
            throw new BusinessException(
                503,
                ErrorCodes.AI_UNAVAILABLE,
                "AI assistant is temporarily unavailable. Please try again."
            );
        }
    }

    private ChatExchangeResponse sendInternal(
            UserDetails principal,
            UUID conversationId,
            String rawIdempotencyKey,
            String rawContent,
            boolean chunkedDeliveryGeneration,
            ChatRequestCancellation cancellation) {
        if (cancellation != null) cancellation.throwIfCancelled();
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
            if (cancellation != null && cancellationRegistry != null) cancellationRegistry.complete(cancellation);
            recordChatStage("preparation", "replay", preparationStartedAt);
            return prepared.replay();
        }
        recordChatStage("preparation", "completed", preparationStartedAt);

        try {
            GeneratedChatDraft generated = generatePreparedAnswer(
                userId, conversationId, content, prepared, chunkedDeliveryGeneration, cancellation);
            if (cancellation != null) {
                cancellation.throwIfCancelled();
                if (cancellationRegistry == null) {
                    throw new IllegalStateException("Shared chat cancellation state is not configured");
                }
                cancellationRegistry.claimCommit(cancellation);
            }
            long persistenceStartedAt = System.nanoTime();
            ChatExchangeResponse completed;
            try {
                completed = transactions.execute(status ->
                    complete(
                        userId,
                        conversationId,
                        prepared.userMessageId(),
                        prepared.processingToken(),
                        generated.response(),
                        generated.mode()
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
            if (cancellation != null) cancellationRegistry.complete(cancellation);
            return completed;
        } catch (BusinessException ex) {
            markFailed(userId, conversationId, prepared.userMessageId(), prepared.processingToken());
            if (cancellation != null && cancellationRegistry != null) {
                cancellationRegistry.fail(cancellation.requestId());
            }
            throw ex;
        } catch (RuntimeException ex) {
            markFailed(userId, conversationId, prepared.userMessageId(), prepared.processingToken());
            if (cancellation != null && cancellationRegistry != null) {
                cancellationRegistry.fail(cancellation.requestId());
            }
            throw new BusinessException(
                503,
                ErrorCodes.AI_UNAVAILABLE,
                "AI assistant is temporarily unavailable. Please try again."
            );
        }
    }

    private GeneratedChatDraft generatePreparedAnswer(
            UUID userId,
            UUID conversationId,
            String content,
            PreparedMessage prepared,
            boolean chunkedDeliveryGeneration,
            ChatRequestCancellation cancellation) {
        if (cancellation != null) cancellation.throwIfCancelled();
        AiConversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
            .orElseThrow(this::notFound);
        // Credit-gated answers are final and source-less, so no provider call is made.
        SanitizedAiResponse sanitized = prepared.freeAnswer() != null
            ? prepared.freeAnswer()
            : groundedResponse(
                userId, conversation.getMode(), content, recentTurns(conversationId),
                chunkedDeliveryGeneration, cancellation);
        if (cancellation != null) cancellation.throwIfCancelled();
        return new GeneratedChatDraft(conversation.getMode(), sanitized);
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
        return groundedResponse(userId, mode, content, turns, false, null);
    }

    private SanitizedAiResponse groundedResponse(
            UUID userId,
            ChatMode mode,
            String content,
            List<Map<String, String>> turns,
            boolean chunkedDeliveryGeneration,
            ChatRequestCancellation cancellation) {
        SanitizedAiResponse deterministicBranch = deterministicBranchResponse(mode, content, turns);
        if (deterministicBranch != null) return deterministicBranch;

        // A greeting needs no upstream retrieval: the server-owned welcome
        // copy is complete and cannot hallucinate. The public lane already
        // short-circuits GREETING the same way (PublicAiChatController), so
        // this keeps the patient lane from paying a provider round-trip for
        // "xin chào" — observed ~6s on production for a static answer.
        if (mode == ChatMode.HOSPITAL_SUPPORT
                && !ChatMedicalSafety.containsProtectedInputCue(content)
                && ChatSuggestedActionResolver.classify(content)
                    == ChatSuggestedActionResolver.HospitalSupportIntent.GREETING) {
            return hospitalSupportResponse(content);
        }

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
            retrieved = cancellation == null
                ? aiService.retrieveChat(request)
                : aiService.retrieveChat(request, cancellation);
        } catch (RuntimeException ex) {
            if (cancellation != null && cancellation.isCancelled()) throw ex;
            log.warn(
                "AI candidate retrieval deferred requestId={} errorType={}",
                RequestTrace.currentId(), ex.getClass().getSimpleName()
            );
        } finally {
            recordChatStage(
                "retrieval-result", retrieved == null ? "unavailable" : "completed", retrievalStartedAt
            );
        }
        if (cancellation != null) cancellation.throwIfCancelled();

        if (retrieved == null) {
            SanitizedAiResponse uncited = uncitedGeneralGuidanceSafely(
                userId, mode, content, turns, chunkedDeliveryGeneration, cancellation);
            return uncited != null ? uncited : supportAwareFallback(mode, content);
        }

        String safety = stringValue(retrieved.get("safety_action"));
        if (safety != null && !"ANSWER".equals(safety)) {
            return safetyResponse(mode, safety, content, stringValue(retrieved.get("routing_reason")));
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
            SanitizedAiResponse uncited = uncitedGeneralGuidanceSafely(
                userId, mode, content, turns, chunkedDeliveryGeneration, cancellation);
            return uncited != null ? uncited : supportAwareFallback(mode, content);
        }
        if (cancellation != null) cancellation.throwIfCancelled();

        Map<String, Object> generation = new LinkedHashMap<>();
        generation.put("message", content);
        generation.put("mode", mode.name());
        generation.put("recent_turns", turns);
        generation.put("synthetic_beta", syntheticBetaAsserted && syntheticBetaGuard.eligible(userId));
        generation.put("authorized_sources", sourceResolver.authorizedPayload(authorized));
        // Per-account tuning is read from this user's preferences on the
        // server: tone is a validated register, and the opt-in patient context
        // lines are built from the user's own records — never from the
        // request body, so a browser cannot widen or spoof them.
        AiPatientContextService.AssistantTuning tuning = patientContextService != null
            ? patientContextService.tuningFor(userId)
            : AiPatientContextService.AssistantTuning.DEFAULT;
        generation.put("tone", tuning.tone());
        if (!tuning.patientContext().isEmpty()) {
            generation.put("patient_context", tuning.patientContext());
        }
        Map<String, Object> generated = dispatchChatGeneration(
            generation, chunkedDeliveryGeneration, cancellation);
        return sanitize(generated, mode, authorized, content);
    }

    /**
     * Answer a source-less question with a bounded remote answer when the
     * retrieved candidates authorized nothing. Patient chat normally requires
     * at least one authorized source so Spring can revalidate every citation,
     * but a general wellness question ("Uống bao nhiêu nước mỗi ngày?") or a
     * clinical-education/triage question without an approved catalog row has
     * nothing to cite, and the public surface already answers that lane under
     * the same output gates. This path mirrors the public condition and never
     * widens it:
     *
     * <ul>
     *   <li>{@code HOSPITAL_SUPPORT} only for intent {@code GENERAL} —
     *       catalog, booking, education and navigation questions keep their
     *       deterministic fallback;</li>
     *   <li>{@code HEALTH_EDUCATION} and {@code SYMPTOM_TRIAGE} when no
     *       approved source authorized — the ai-service still applies the
     *       shared clinical floor, so diagnosis, prescription and treatment
     *       asks continue to fail closed;</li>
     *   <li>only when remote providers are enabled for this deployment, and
     *       only a {@code remote_provider} answer is ever displayed. A local
     *       fallback or an insufficient upstream answer returns {@code null},
     *       so the caller keeps today's insufficient-evidence outcome and the
     *       ledger keeps waiving it.</li>
     * </ul>
     *
     * <p>The answer still flows through {@link #sanitize} with an empty
     * authorized list, so the shape/length bounds, the provenance allowlist,
     * the diagnose/prescribe reject and the safety-action rules all apply
     * unchanged. No patient context line is sent: a general question needs no
     * patient record to answer.
     */
    private SanitizedAiResponse uncitedGeneralGuidance(
            UUID userId,
            ChatMode mode,
            String content,
            List<Map<String, String>> turns,
            boolean chunkedDeliveryGeneration,
            ChatRequestCancellation cancellation) {
        // Hospital-support keeps its GENERAL-intent gate so catalog, booking,
        // education and navigation questions retain their deterministic
        // fallback. Clinical modes carry no intent classifier; the ai-service
        // re-applies the shared clinical floor (treatment/diagnosis/
        // medication asks stay denied) before any remote call is made, and
        // the answer still passes through sanitize below with an empty
        // authorized list.
        boolean supportLane = mode == ChatMode.HOSPITAL_SUPPORT
                && ChatSuggestedActionResolver.classify(content)
                    == ChatSuggestedActionResolver.HospitalSupportIntent.GENERAL;
        boolean clinicalLane = mode == ChatMode.HEALTH_EDUCATION
                || mode == ChatMode.SYMPTOM_TRIAGE;
        if (!(supportLane || clinicalLane) || !remoteProviderEnabled) {
            return null;
        }
        Map<String, Object> generation = new LinkedHashMap<>();
        generation.put("message", content);
        generation.put("mode", mode.name());
        generation.put("recent_turns", turns);
        generation.put("synthetic_beta", syntheticBetaAsserted && syntheticBetaGuard.eligible(userId));
        // Tone is a validated server-side register read from this user's
        // preferences; no catalog allowlist and no patient record travel on
        // this turn.
        AiPatientContextService.AssistantTuning tuning = patientContextService != null
            ? patientContextService.tuningFor(userId)
            : AiPatientContextService.AssistantTuning.DEFAULT;
        generation.put("tone", tuning.tone());
        Map<String, Object> generated = dispatchChatGeneration(
            generation, chunkedDeliveryGeneration, cancellation);
        SanitizedAiResponse sanitized = sanitize(generated, mode, List.of(), content);
        return "remote_provider".equals(sanitized.provenance()) ? sanitized : null;
    }

    /**
     * The remote escalation is best-effort: a provider failure, timeout or
     * contract violation must degrade to the deterministic local fallback —
     * the behavior every turn had before the uncited branch existed — instead
     * of propagating a long hang to the caller. Returning null sends the
     * caller to {@code supportAwareFallback}. A 422 safety rejection
     * (diagnosis/prescription claim in the generated answer) is NOT degraded:
     * it propagates so the blocked content never reaches the user.
     */
    private SanitizedAiResponse uncitedGeneralGuidanceSafely(
            UUID userId,
            ChatMode mode,
            String content,
            List<Map<String, String>> turns,
            boolean chunkedDeliveryGeneration,
            ChatRequestCancellation cancellation) {
        long escalationStartedAt = System.nanoTime();
        try {
            return uncitedGeneralGuidance(
                userId, mode, content, turns, chunkedDeliveryGeneration, cancellation);
        } catch (BusinessException ex) {
            if (ex.getStatus() == 422) throw ex;
            recordChatStage("uncited-general-guidance", "failed", escalationStartedAt);
            return null;
        } catch (RuntimeException ex) {
            recordChatStage("uncited-general-guidance", "failed", escalationStartedAt);
            return null;
        }
    }

    /**
     * Dispatch one generation call and enforce the D-02 slice contract. The
     * upstream transport may deliver the answer incrementally, but the FastAPI
     * side only streams slices of a fully generated, fully validated answer:
     * these deltas are a consistency log used to prove the delivered slices
     * equal the answer about to be persisted.
     */
    private Map<String, Object> dispatchChatGeneration(
            Map<String, Object> generation,
            boolean chunkedDeliveryGeneration,
            ChatRequestCancellation cancellation) {
        List<String> upstreamDeliverySlices = new ArrayList<>();
        long generationStartedAt = System.nanoTime();
        Map<String, Object> generated;
        try {
            generated = cancellation == null
                ? (chunkedDeliveryGeneration
                    ? aiService.generateChatStream(generation, upstreamDeliverySlices::add)
                    : aiService.generateChat(generation))
                : (chunkedDeliveryGeneration
                    ? aiService.generateChatStream(generation, upstreamDeliverySlices::add, cancellation)
                    : aiService.generateChat(generation, cancellation));
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
        return generated;
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
     * Periodic stale-chat sweep running every 5 days. It purges conversations
     * whose last activity is older than the FULL retention window
     * ({@code ai.chat.retention-days}, i.e. the 90 days promised by the
     * consent text and returned by {@code policy()}) — a defense-in-depth net
     * behind {@link #purgeExpired()}, which already deletes rows once
     * {@code expiresAt} passes. The legacy 14-day window was dropped: it
     * deleted idle patients' history 76 days before the advertised retention
     * and took the credit-ledger attempt markers with it. The method name is
     * kept for call-site and configuration compatibility; the cutoff is
     * retention-based. Default cron triggers at 03:00 every 5 days.
     */
    @Scheduled(cron = "${ai.chat.two-week-cleanup-cron:0 0 3 1/5 * *}")
    @Transactional
    public int purgeConversationsOlderThanTwoWeeks() {
        if (!cleanupEnabled) {
            return 0;
        }
        OffsetDateTime cutoff = now().minusDays(retentionDays);
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
            log.info("Purged {} AI conversations idle beyond the {}-day retention (cutoff: {})", totalDeleted, retentionDays, cutoff);
        }
        return totalDeleted;
    }

    /**
     * A crash between the committed credit charge and the persisted exchange
     * leaves a PENDING message that no caller ever retries; without this sweep
     * the patient keeps the charge with no ledger compensation. Reuses the
     * exact recovery path (flip to FAILED + guarded refund) that prepare()
     * applies to stale leases, so live traffic and the sweep cannot
     * double-refund: the PENDING status guard keeps one attempt from being
     * recovered twice, and the per-attempt ledger guard
     * ({@code AI_CHAT_USAGE} present, {@code AI_CHAT_REFUND} absent) keeps one
     * attempt from being refunded twice.
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
        // Crisis bypass ahead of the mode and consent gates (same ordering
        // invariant as the public endpoints): the canned 115 guidance is a
        // fixed safety answer, not the provider processing those gates
        // protect — a disabled mode or a stale consent version must not turn
        // a crisis message into a bare 503/428. Ownership still runs first:
        // nothing is emitted for a conversation the caller does not own, and
        // the idempotency/in-flight gates below still apply — a replayed
        // crisis key returns its stored exchange, and a genuinely in-flight
        // send still conflicts.
        SanitizedAiResponse freeAnswer = ChatMedicalSafety.containsEmergencyInputCue(content)
            ? safetyResponse(conversation.getMode(), "EMERGENCY", content)
            : null;
        if (freeAnswer == null) {
            ensureModeEnabled(conversation.getMode());
            requireCurrentConsent(conversation);
        }
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
                    new ChatExchangeResponse(toMessage(request), toMessage(reply), true),
                    null
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

        // Credit gate. Rule, in one sentence: a chat answer costs one credit,
        // except the answers the platform can produce without contacting any
        // provider — the static safety answers, the degraded
        // INSUFFICIENT_EVIDENCE reply, and the deterministic local catalog
        // lookups (catalog overview / branch details) — which are free to
        // everyone including a patient who is out of credits.
        //
        // Rationale: these answers are system outcomes, not products the
        // patient is buying — an insufficient-evidence answer cites no source
        // and exists to say "I stopped rather than guess", an emergency
        // answer is the fixed call-115 guidance, and a catalog overview is a
        // plain SQL read of the live specialty/branch tables that carries
        // provenance local_fallback and costTier local_free. Gating them
        // behind a paid balance (the old unconditional 402 here) meant the
        // patients they protect most could never see them, and the waiver
        // path that records them could only ever run for someone who already
        // had a credit to spare. Billing them was worse than refusing them:
        // the ledger said "purchased answer" while the payload the client saw
        // said local_free.
        //
        // Boundary: the exemption is only available when the free answer is
        // already in hand before the gate releases, so an unpaid request can
        // never spend provider work (see localProviderFreeAnswer). A
        // zero-credit patient whose question needs the provider still gets the
        // 402 INSUFFICIENT_AI_CREDITS here, before generation, exactly as
        // before. Ordinary paid use is unchanged, and the free exchange is
        // audited by complete() writing a zero-amount AI_CHAT_WAIVED ledger row
        // instead of a charge.
        //
        // Fail-closed on the missing profile (credit-leak audit): an account
        // with no PatientProfile at all — what AuthService leaves behind after
        // a no-phone registration — is gated exactly like the zero-credit
        // patient, because its charge path (deductPatientCredit) can only
        // silently no-op and the old permissive branch answered every such
        // turn on the platform's provider budget with no ledger row. The
        // provider-free safety outcomes above remain reachable; only the paid
        // pipeline is closed behind the 402.
        //
        // Crisis bypass (audit A4): the emergency guidance must never be
        // paywalled, so a message carrying an acute term is evaluated before
        // the credit check using the same detection the public controller and
        // the local fallback already trust
        // (ChatMedicalSafety#containsEmergencyInputCue — no second lexicon).
        // The check itself now sits further up — before the mode/consent
        // gates — and its canned EMERGENCY answer arrives here as the
        // prepared free answer with zero provider work; complete() waives the
        // EMERGENCY outcome, so no credit is charged for it even when the
        // patient can pay.
        // Weekly refill (V108), after the crisis bypass: an emergency answer
        // never touches credits, so it does not need — and must not trigger —
        // a grant. Placing the refill right before the balance gate is what
        // makes "ran out last week" chat again this week without an admin
        // grant: it runs in its own physical transaction (REQUIRES_NEW on
        // refillPatientCreditsWeekly) and commits before returning, so the
        // gate below reads the topped-up balance as committed fact. The
        // grant is a conditional atomic update (once per ISO week per
        // patient) with the ux_ai_credit_refill_patient_week index as the
        // database backstop, so concurrent sends, retries, and a second
        // instance cannot double-grant. It is also strictly best-effort: the
        // refill is a topping, not a billing dependency, so every runtime
        // failure of the inner transaction (inconsistent ledger history, a
        // constraint race, an UnexpectedRollbackException from its commit)
        // is logged and swallowed HERE — the outer prepare transaction never
        // sees the abort, the chat turn is not poisoned, and the gate runs
        // against the balance as it is. AiCreditService#
        // refillPatientCreditsWeekly documents the contract.
        if (freeAnswer == null) {
            if (aiCreditService != null) {
                try {
                    aiCreditService.refillPatientCreditsWeekly(userId);
                } catch (RuntimeException refillFailure) {
                    log.warn("weekly credit refill skipped", refillFailure);
                }
            }
            if (aiCreditService != null && !aiCreditService.hasPatientCreditBalance(userId)) {
                freeAnswer = localProviderFreeAnswer(
                    conversation.getMode(), content, recentTurns(conversationId));
                if (freeAnswer == null) {
                    aiCreditService.requirePatientCredits(userId);
                }
            }
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
        return new PreparedMessage(request.getId(), processingToken, null, freeAnswer);
    }

    /**
     * Whether a completed answer was produced entirely from the platform's own
     * state, so there is no purchased provider work behind it to bill.
     *
     * <p>The deterministic local catalog fallbacks — the broad catalog
     * overview, the exact branch answer and its ambiguous-variant disambiguation —
     * carry provenance {@code local_fallback} and cost tier {@code local_free}
     * with a plain {@code ANSWER} action, and the degraded branch-unavailable
     * reply carries the same provenance and tier with
     * {@code INSUFFICIENT_EVIDENCE}. The provenance+tier conjunction is what
     * separates them from provider answers: a provider reply is always
     * {@code local_provider} or {@code remote_provider} (and the tier it
     * reports is not ours to second-guess), so a provider reply normally cannot match; the deliberate exception is the ai-service's own canned fallbacks (provenance local_fallback + cost local_free + ANSWER), which this predicate waives by policy — a canned card is not provider work and must not bill a credit even when it
     * reports a provider-side {@code cost_tier} of {@code local_free}.
     */
    private static boolean isProviderFreeLocalAnswer(SanitizedAiResponse response) {
        if (!"local_fallback".equals(response.provenance())
                || !"local_free".equals(response.costTier())) {
            return false;
        }
        return response.safetyAction() == ChatSafetyAction.ANSWER
            || (response.safetyAction() == ChatSafetyAction.INSUFFICIENT_EVIDENCE
                && response.citations().isEmpty());
    }

    /**
     * The answer a zero-credit patient may receive for free, or {@code null}
     * when nothing can be answered without paying.
     *
     * <p>Two conditions, both required: the reply is produced by a local
     * deterministic path — so no retrieval or generation call is made on the
     * platform's meter — and it is one of the provider-free outcomes, the
     * degraded {@code INSUFFICIENT_EVIDENCE} reply (which carries no citations
     * and no curated content) or a local catalog {@code ANSWER}. A local path
     * that would still need retrieval or generation stays behind the credit
     * gate.
     *
     * <p>Resolved once, here, and carried with the prepared exchange so the
     * patient is shown exactly the answer that was checked at the gate instead
     * of a second lookup that could disagree with the first.
     */
    private SanitizedAiResponse localProviderFreeAnswer(
            ChatMode mode, String content, List<Map<String, String>> turns) {
        SanitizedAiResponse local = deterministicBranchResponse(mode, content, turns);
        if (local == null
                && mode == ChatMode.HOSPITAL_SUPPORT
                && !ChatMedicalSafety.containsProtectedInputCue(content)
                && ChatSuggestedActionResolver.classify(content)
                    == ChatSuggestedActionResolver.HospitalSupportIntent.CATALOG) {
            local = catalogOverviewResponse(content);
        }
        return local != null && isProviderFreeLocalAnswer(local) ? local : null;
    }

    private void chargeAcceptedPatientExchange(UUID userId, UUID requestMessageId) {
        if (aiCreditService != null) {
            aiCreditService.deductPatientCredit(
                userId, PATIENT_CHAT_CREDIT_DESCRIPTION + " " + attemptMarker(requestMessageId));
        }
    }

    /**
     * Outcomes the platform produced as a safety system rather than as a
     * purchased answer: the static emergency / refusal / handoff texts and the
     * degraded insufficient-evidence reply all cite no curated source, and the
     * static ones in particular involve no provider work at all. None of them
     * may be billed — audit A4 found that charging the canned crisis guidance
     * meant a patient in distress paid (or, at zero credits, was refused) for
     * a fixed string.
     */
    private static boolean isUnbilledSafetyOutcome(ChatSafetyAction action) {
        return action == ChatSafetyAction.INSUFFICIENT_EVIDENCE
            || action == ChatSafetyAction.EMERGENCY
            || action == ChatSafetyAction.REFUSE
            || action == ChatSafetyAction.HUMAN_HANDOFF;
    }

    /** The ledger wording that explains why this unbilled outcome was free. */
    private static String waiverDescriptionFor(ChatSafetyAction action) {
        return action == ChatSafetyAction.INSUFFICIENT_EVIDENCE
            ? PATIENT_CHAT_WAIVED_DESCRIPTION
            : PATIENT_SAFETY_CHAT_WAIVED_DESCRIPTION;
    }

    /**
     * An unbilled completion is a service outcome from the patient's point of
     * view: they either spent a credit for "no reliable source found" — or,
     * for a patient whose only route to the answer was the credit-gate
     * exemption, they spent nothing at all. Persist the waiver row instead of
     * the charge so the ledger explains the zero-cost outcome either way. The
     * early replay guard in {@code complete} (an existing reply row
     * short-circuits the completion) means a replayed idempotency key can never
     * reach this method twice for the same attempt.
     */
    private void waiveUnbilledPatientExchange(
            UUID userId,
            UUID requestMessageId,
            String waiverDescription) {
        if (aiCreditService != null) {
            aiCreditService.recordPatientWaiver(
                userId, waiverDescription + " " + attemptMarker(requestMessageId));
        }
    }

    private static String attemptMarker(UUID requestMessageId) {
        return CHAT_ATTEMPT_MARKER_PREFIX + requestMessageId + "]";
    }

    /**
     * Commits one generated answer to the conversation, but only if this caller
     * still owns the in-flight lease for it.
     *
     * <p>The lease is the whole point of this method. A generation can outlive
     * its request (slow provider, dropped connection, retry), and a late answer
     * must never overwrite a newer turn or be charged twice. So the conversation
     * is re-read {@code FOR UPDATE} and the exchange is rejected with 503
     * {@code AI_UNAVAILABLE} unless the conversation is still in flight, the
     * stored processing token equals the caller's token, and the lease has not
     * expired. Losing the race is a normal, retryable outcome, not corruption.
     *
     * <p>Before anything is written, the exact source identities used for the
     * answer are revalidated and refreshed through
     * {@link AiChatSourceResolver#revalidateForPersistence}. A source that was
     * edited, revoked or expired while the answer was being generated degrades
     * the answer to "insufficient evidence" rather than persisting a citation
     * that no longer exists. This is the last point at which the store can be
     * observed as consistent with the answer.
     *
     * <p>The write is idempotent: if a reply already exists for the request
     * message, the lease is simply released and the stored reply returned, so a
     * replayed completion cannot create a second assistant message, charge a
     * second credit, or record a second waiver. On success the request and
     * reply rows are saved, the conversation's title, counters and expiry are
     * advanced, the lease is cleared, and billing is settled once — after the
     * answer exists, never before. A grounded answer charges one patient
     * credit; a safety-system outcome — the static {@code EMERGENCY},
     * {@code REFUSE} or {@code HUMAN_HANDOFF} text, or an answer degraded to
     * {@code INSUFFICIENT_EVIDENCE} — and a deterministic local catalog
     * lookup (provenance {@code local_fallback}, cost tier {@code local_free})
     * charge nothing and instead record a zero-amount {@code AI_CHAT_WAIVED}
     * ledger row so the audit trail shows why no charge happened.
     */
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

        // A persisted self-harm turn alerts the admin queue — afterCommit, so a
        // rolled-back exchange never alerts and a notification failure can
        // never abort the chat transaction the user is waiting on.
        if ("self_harm_crisis".equals(response.routingReason())) {
            registerSelfHarmAlert(userId, conversation, request.getContent());
        }

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
        if (isUnbilledSafetyOutcome(response.safetyAction())) {
            waiveUnbilledPatientExchange(
                userId, request.getId(), waiverDescriptionFor(response.safetyAction()));
        } else if (isProviderFreeLocalAnswer(response)) {
            // The deterministic local catalog lookups bought no provider work,
            // so the ledger must agree with the local_free payload the client
            // sees instead of recording a purchased answer.
            waiveUnbilledPatientExchange(
                userId, request.getId(), PATIENT_LOCAL_CHAT_WAIVED_DESCRIPTION);
        } else {
            chargeAcceptedPatientExchange(userId, request.getId());
        }
        return new ChatExchangeResponse(
            toMessage(request),
            withLiveMetadata(toMessage(reply), response),
            false);
    }

    private MessageResponse withLiveMetadata(MessageResponse message, SanitizedAiResponse response) {
        return new MessageResponse(
            message.id(),
            message.role(),
            message.status(),
            message.content(),
            message.sequence(),
            message.disclaimer(),
            message.provenance(),
            message.citations(),
            message.safetyAction(),
            message.triage(),
            message.suggestedActions(),
            message.feedback(),
            message.sourceStatus(),
            usedSourceSummaries(response.finalSources()),
            response.costTier(),
            response.routingReason(),
            message.createdAt(),
            message.completedAt()
        );
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
                        refundFailedPatientExchange(userId, userMessageId);
                    }
                });
                conversation.setInFlight(false);
                conversation.setInFlightStartedAt(null);
                conversation.setInFlightToken(null);
                conversation.setUpdatedAt(now());
                conversationRepository.save(conversation);
            });
        } catch (RuntimeException compensationFailure) {
            // The safe client error is preserved, but this branch is where a
            // patient can permanently lose a credit with no trace, so it has to
            // reach operators: ERROR level, plus every identifier needed to
            // find the rows again (user, conversation, and the request message
            // id that keys the ledger attempt marker).
            //
            // The throwable's message and stack are deliberately NOT logged.
            // A failure here usually comes from the persistence layer, and a
            // JDBC/Hibernate message can quote the offending statement, which
            // in this table means the patient's own question. Exception types
            // carry the diagnosis without carrying health content.
            log.error(
                "AI chat failure compensation incomplete userId={} conversationId={} requestMessageId={}"
                    + " requestId={} errorType={} causeType={}",
                userId,
                conversationId,
                userMessageId,
                RequestTrace.currentId(),
                compensationFailure.getClass().getSimpleName(),
                compensationFailure.getCause() == null
                    ? "none"
                    : compensationFailure.getCause().getClass().getSimpleName()
            );
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
            // A pending request has no persisted reply (reply insertion flips
            // the request to COMPLETED in the same transaction), so this is
            // exactly the "exchange ended FAILED without an answer" case. The
            // ledger guards make a repeated sweep a no-op rather than a
            // second refund.
            if (messageRepository.findByRequestMessageId(pending.getId()).isEmpty()) {
                refundFailedPatientExchange(conversation.getUser().getId(), pending.getId());
            }
        }
        conversation.setInFlight(false);
        conversation.setInFlightStartedAt(null);
        conversation.setInFlightToken(null);
        conversation.setUpdatedAt(recoveredAt);
        messageRepository.flush();
        conversationRepository.save(conversation);
    }

    /**
     * Compensates a patient for one exchange attempt that ended FAILED.
     *
     * <p>The production ordering cannot actually charge before persisting:
     * {@code complete} charges inside the same transaction that stores the
     * answer, so a rolled-back persistence leaves no charge to refund. The
     * refund is nevertheless wired on every FAILED transition (live
     * {@code markFailed} path and the stale-lease sweep) as a defensive
     * recovery: {@link AiCreditService#refundPatientCredit(UUID, String,
     * String)} refunds only when a charged {@code AI_CHAT_USAGE} row for this
     * attempt exists in the ledger and no {@code AI_CHAT_REFUND} row for it
     * does yet. When nothing was charged — the normal case — the guards make
     * this a bounded read and the ledger is untouched, so the sweep and the
     * live path can both run without ever double-refunding.
     */
    private void refundFailedPatientExchange(UUID userId, UUID requestMessageId) {
        if (aiCreditService != null && requestMessageId != null) {
            aiCreditService.refundPatientCredit(
                userId, PATIENT_CHAT_REFUND_DESCRIPTION, attemptMarker(requestMessageId));
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

    /**
     * Validates one raw provider response and turns it into the only shape that
     * may be stored and shown to a patient.
     *
     * <p>Everything the provider returned is treated as untrusted input. The
     * method throws {@code AI_RESPONSE_INVALID} (surfaced as 502) rather than
     * storing a partial or guessed answer when any of these fail:
     *
     * <ul>
     *   <li><b>Shape and length.</b> A non-empty {@code answer} bounded by
     *       {@code MAX_ANSWER_LENGTH} is required, plus a provenance from the
     *       allowed set. A {@code remote_provider} provenance is accepted only
     *       when remote providers are switched on for this deployment, so a
     *       configuration drift cannot quietly route a patient chat to an
     *       unapproved upstream.</li>
     *   <li><b>Medical safety.</b> Diagnose-or-prescribe phrasing is rejected
     *       outright, and the disclaimer falls back to the server-owned
     *       {@code SAFE_DISCLAIMER} when the provider omitted a usable one.</li>
     *   <li><b>Citation integrity.</b> When sources were authorized, the
     *       provider must have used exactly that set — a mismatch rejects the
     *       answer instead of displaying an uncited or over-cited one. Each
     *       authorized identity is then re-resolved, and any identity whose
     *       revision, hash or projection changed drops the answer to
     *       "insufficient evidence".</li>
     *   <li><b>Safety-action consistency.</b> REFUSE and HUMAN_HANDOFF suppress
     *       citations and catalog actions entirely; EMERGENCY gets exactly one
     *       deterministic action so an urgent answer cannot be crowded out by
     *       promotional CTAs.</li>
     * </ul>
     *
     * <p>{@code userContent} is optional context used only to pick a
     * hospital-support fallback action. The returned {@code SanitizedAiResponse}
     * is the single source of truth for what persistence writes.
     */
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
        // The exact-echo contract only applies when the provider claims an
        // answer: a non-ANSWER turn (INSUFFICIENT_EVIDENCE, REFUSE, HANDOFF,
        // EMERGENCY) legitimately reports used_sources=[] because it declined
        // the authorized candidates. Requiring equality there turned every
        // honest refusal into a 502 instead of a persisted degraded reply.
        if (!authorized.isEmpty() && safetyAction == ChatSafetyAction.ANSWER) {
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
            List.copyOf(finalSources),
            parseCostTier(response.get("cost_tier")),
            parseRoutingReason(response.get("routing_reason"))
        );
    }

    private String parseCostTier(Object raw) {
        if (raw == null) return "local_free";
        String value = stringValue(raw);
        if (value == null || !(value.equals("local_free") || value.equals("remote_llm"))) {
            throw invalidAiResponse();
        }
        return value;
    }

    private String parseRoutingReason(Object raw) {
        if (raw == null) return null;
        String value = stringValue(raw);
        if (value == null) return null;
        value = trim(value.strip(), 500);
        return value.isBlank() ? null : value;
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

    /**
     * The dedicated self-harm crisis reply. Persisted verbatim on the
     * assistant message, so {@code toMessage} can re-derive the
     * {@code self_harm_crisis} marker on history reload even for phrasings
     * only the upstream AI lexicon caught (its routing_reason is not
     * persisted). Byte-identical to the ai-service and BFF canned copies.
     */
    private static final String SELF_HARM_CRISIS_ANSWER =
        "Nghe bạn nói vậy tôi rất lo cho bạn. Nếu bạn đang có ý nghĩ tự làm tổn thương mình, "
            + "hãy gọi 115 ngay hoặc đến cơ sở y tế gần nhất — đừng ở một mình, hãy nói với "
            + "một người bạn tin tưởng. Tôi không tự động gọi thay bạn.";

    private SanitizedAiResponse safetyResponse(ChatMode mode, String rawSafety, String userContent) {
        return safetyResponse(mode, rawSafety, userContent, null);
    }

    private SanitizedAiResponse safetyResponse(
            ChatMode mode, String rawSafety, String userContent, String upstreamRoutingReason) {
        ChatSafetyAction action;
        try { action = ChatSafetyAction.valueOf(rawSafety); }
        catch (IllegalArgumentException ex) { throw invalidAiResponse(); }
        // A self-harm message gets its own wording: the generic "dangerous
        // signs" copy reads as a physical-emergency script and missed what
        // the patient actually said. The routingReason marker lets clients
        // render the dedicated crisis card (and survives history reload via
        // the toMessage re-derivation on the stored request message). The
        // upstream marker is also honoured — the AI lexicon catches obfuscated
        // phrasings this cue has not catalogued, and an EMERGENCY the model
        // labelled self-harm is never downgraded to the generic script.
        boolean selfHarm = action == ChatSafetyAction.EMERGENCY
            && (ChatMedicalSafety.containsSelfHarmCue(userContent)
                || "self_harm_crisis".equals(upstreamRoutingReason));
        String answer = switch (action) {
            case EMERGENCY -> selfHarm
                ? SELF_HARM_CRISIS_ANSWER
                : "Nếu bạn đang có dấu hiệu nguy hiểm, hãy gọi 115 ngay hoặc đến cơ sở y tế gần nhất. Tôi không tự động gọi thay bạn.";
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
            List.of(),
            "local_free",
            selfHarm ? "self_harm_crisis" : "safety_response"
        );
    }

    /** Excerpt cap for the admin alert body — enough to judge severity, not a transcript. */
    private static final int SELF_HARM_ALERT_EXCERPT_CHARS = 200;

    /**
     * Defers the admin fan-out to afterCommit, mirroring {@link
     * com.healthcare.auth.mail.AfterCommitEmailSender#runAfterCommit}: the
     * alert exists only once the crisis exchange is durably committed, and a
     * notification row that fails to insert cannot abort the chat transaction
     * the patient is blocked on. With no active transaction (hand-built tests)
     * the alert runs inline.
     */
    private void registerSelfHarmAlert(UUID userId, AiConversation conversation, String userContent) {
        Runnable alert = () -> notifyAdminsOfSelfHarm(userId, conversation.getId(), userContent);
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    alert.run();
                }
            });
            return;
        }
        alert.run();
    }

    /**
     * Fans the self-harm flag out to every active admin, the same recipient
     * walk the payment review queue uses. The body names the patient and a
     * bounded excerpt so a reviewer can judge severity without reading the
     * thread; {@code referenceId} points at the conversation for follow-up.
     * Strictly best-effort: any failure is logged and swallowed because a
     * dropped alert must never cost the patient their crisis answer.
     */
    private void notifyAdminsOfSelfHarm(UUID patientUserId, UUID conversationId, String userContent) {
        if (notificationService == null) {
            return;
        }
        // afterCommit runs with no transaction; notification preference
        // materialization (NotificationPreferenceRepository#ensureDefaults)
        // is a @Modifying INSERT, so the fan-out needs its own transaction.
        // The catch wraps the commit, not just the inserts: a poisoned
        // transaction throws on the way out and must still be swallowed here —
        // anything reaching afterCommit would fail a request whose crisis
        // exchange already committed.
        try {
            alertTransactions.executeWithoutResult(status ->
                notifyAdminsOfSelfHarmInTransaction(patientUserId, conversationId, userContent));
        } catch (RuntimeException exception) {
            log.warn("self-harm admin alert fan-out failed", exception);
        }
    }

    private void notifyAdminsOfSelfHarmInTransaction(UUID patientUserId, UUID conversationId, String userContent) {
        String patientName = userRepository.findById(patientUserId)
            .map(user -> {
                String display = user.getDisplayName();
                return display != null && !display.isBlank() ? display : user.getEmail();
            })
            .orElse("patient " + patientUserId);
        String excerpt = userContent == null ? ""
            : userContent.length() <= SELF_HARM_ALERT_EXCERPT_CHARS
                ? userContent
                : userContent.substring(0, SELF_HARM_ALERT_EXCERPT_CHARS) + "…";
        String title = "Cảnh báo an toàn AI";
        String body = patientName + " đã gửi tin nhắn có dấu hiệu tự hại trong trò chuyện AI"
            + (excerpt.isBlank() ? "." : ": \"" + excerpt + "\"");
        int notified = 0;
        for (int page = 0; ; page++) {
            List<UUID> adminIds = userRepository.findActiveAdminUserIds(
                PageRequest.of(page, 50));
            if (adminIds.isEmpty()) {
                return;
            }
            for (UUID adminId : adminIds) {
                if (notified >= 500) {
                    return;
                }
                if (adminId.equals(patientUserId)) {
                    continue;
                }
                notificationService.create(
                    adminId,
                    com.healthcare.notification.entity.Notification.EventType.AI_SAFETY_ALERT,
                    title, body, conversationId);
                notified++;
            }
        }
    }

    /** A refusal that names an identifier or record kind should say so.  The
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
            List.of(),
            "local_free",
            "insufficient_evidence"
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
        if (intent == ChatSuggestedActionResolver.HospitalSupportIntent.CATALOG
                && !ChatMedicalSafety.containsProtectedInputCue(content)) {
            SanitizedAiResponse catalog = catalogOverviewResponse(content);
            if (catalog != null) return catalog;
        }
        if (intent == ChatSuggestedActionResolver.HospitalSupportIntent.BRANCH
                && !ChatMedicalSafety.containsProtectedInputCue(content)) {
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
                "Trước khi đi khám, bạn nên mang theo giấy tờ tùy thân (CCCD/CMND), "
                    + "thẻ BHYT nếu có, các kết quả xét nghiệm hoặc chẩn đoán hình ảnh gần nhất "
                    + "và danh sách thuốc đang sử dụng. Nên đến sớm khoảng 15–30 phút để làm thủ tục. "
                    + "Một số xét nghiệm hoặc dịch vụ có yêu cầu riêng (ví dụ nhịn ăn) — "
                    + "bạn nên xác nhận trước khi đặt lịch hoặc gọi cho cơ sở.";
            case EDUCATION ->
                "Mình chưa tìm thấy bài viết hoặc câu hỏi thường gặp phù hợp trong kho kiến thức "
                    + "đã được kiểm duyệt. Bạn có thể mở Cẩm nang sức khỏe hoặc Câu hỏi thường gặp.";
            case AMENITY ->
                "Tiện ích có thể khác theo từng cơ sở (bãi đậu xe, nhà thuốc, Wi-Fi). "
                    + "Hãy mở mục Cơ sở & giờ làm việc để xem tiện ích của từng nơi trước khi đến.";
            case GENERAL ->
                "Mình có thể hỗ trợ tra cứu Chuyên khoa, Bác sĩ, Gói khám, Dịch vụ, "
                    + "Cơ sở & giờ làm việc và hướng dẫn Đặt lịch. Bạn đang muốn tìm mục nào?";
        };

        // A greeting already is the complete deterministic answer — nothing a
        // retry could improve and no retrieval was ever needed — so it reports
        // ANSWER (the "Hướng dẫn nhanh" chip) rather than the INSUFFICIENT
        // retry banner. Every other intent keeps INSUFFICIENT_EVIDENCE: the
        // canned navigation copy is a degraded stand-in for a grounded reply
        // the retrieval path failed to produce.
        ChatSafetyAction safety = intent == ChatSuggestedActionResolver.HospitalSupportIntent.GREETING
            ? ChatSafetyAction.ANSWER
            : ChatSafetyAction.INSUFFICIENT_EVIDENCE;
        return new SanitizedAiResponse(
            answer,
            SAFE_DISCLAIMER,
            "local_fallback",
            List.of(),
            safety,
            null,
            ChatSuggestedActionResolver.hospitalSupportFallback(content),
            "UNAVAILABLE",
            List.of(),
            "local_free",
            "hospital_support_fallback"
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
            sources,
            "local_free",
            "catalog_overview_fallback"
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
        return branchDetailsResponse(content, matches);
    }

    /**
     * Answer a facility question ("bãi đậu xe ở đâu?", "có nhà thuốc
     * không?") from the live {@code branches.amenities} JSON.  The semantic
     * index only carries amenities as stripped raw JSON, so retrieval
     * cannot compose this faithfully — the deterministic catalog answer
     * names only labels the branch row actually advertises.
     */
    private SanitizedAiResponse amenityDeterministicResponse(String content) {
        AiChatSourceResolver.AmenityResolution resolution =
            sourceResolver.resolveAmenity(content);
        if (resolution == null) return null;

        String amenityName = sourceResolver.amenityDisplayName(resolution.amenityType());
        if (resolution.specific() && resolution.resolved().isEmpty()) {
            return branchUnavailableResponse(content);
        }

        List<AiChatSourceResolver.BranchDetails> matches = resolution.matches();
        if (matches.isEmpty()) {
            if (resolution.specific() && resolution.resolved().size() == 1) {
                // The named branch exists but does not advertise the
                // amenity — say so from the live row and offer its phone.
                AiChatSourceResolver.BranchDetails branch = resolution.resolved().get(0);
                AiChatSourceResolver.ResolvedSource source = branch.source();
                List<Map<String, String>> citations = sourceResolver.citations(List.of(source));
                if (citations == null || citations.isEmpty()) return null;
                String phone = branch.phone() == null
                    ? "bộ phận tiếp đón"
                    : branch.phone();
                return new SanitizedAiResponse(
                    "Theo dữ liệu cơ sở đang hoạt động, " + source.title()
                        + " hiện chưa công bố " + amenityName
                        + ". Bạn có thể gọi " + phone
                        + " để xác nhận trước khi đến.",
                    SAFE_DISCLAIMER,
                    "local_fallback",
                    citations,
                    ChatSafetyAction.ANSWER,
                    null,
                    ChatSuggestedActionResolver.hospitalSupportFallback(content),
                    "CURRENT",
                    List.of(source),
                    "local_free",
                    "amenity_fallback"
                );
            }
            if (resolution.specific() && resolution.resolved().size() > 1) {
                // Several named branches resolved — the denial is scoped
                // to those rows only, never a system-wide claim.
                List<AiChatSourceResolver.ResolvedSource> denied = resolution.resolved().stream()
                    .map(AiChatSourceResolver.BranchDetails::source)
                    .filter(java.util.Objects::nonNull)
                    .toList();
                List<Map<String, String>> citations = sourceResolver.citations(denied);
                if (citations == null || citations.isEmpty()) return null;
                String titles = denied.stream()
                    .map(AiChatSourceResolver.ResolvedSource::title)
                    .collect(java.util.stream.Collectors.joining("; "));
                return new SanitizedAiResponse(
                    "Theo dữ liệu cơ sở đang hoạt động, các cơ sở bạn hỏi ("
                        + titles + ") hiện chưa công bố " + amenityName
                        + ". Bạn có thể gọi cơ sở để xác nhận trước khi đến.",
                    SAFE_DISCLAIMER,
                    "local_fallback",
                    citations,
                    ChatSafetyAction.ANSWER,
                    null,
                    ChatSuggestedActionResolver.hospitalSupportFallback(content),
                    "CURRENT",
                    denied,
                    "local_free",
                    "amenity_fallback"
                );
            }
            // No active branch advertises the amenity — an honest "not
            // published" answer, not a fabricated facility list.
            return new SanitizedAiResponse(
                "Hiện chưa có cơ sở nào công bố " + amenityName
                    + ". Bạn có thể mở mục Cơ sở để xem tiện ích từng nơi hoặc gọi cơ sở để xác nhận trước khi đến.",
                SAFE_DISCLAIMER,
                "local_fallback",
                List.of(),
                ChatSafetyAction.ANSWER,
                null,
                ChatSuggestedActionResolver.hospitalSupportFallback(content),
                "CURRENT",
                List.of(),
                "local_free",
                "amenity_fallback"
            );
        }

        List<AiChatSourceResolver.ResolvedSource> sources = matches.stream()
            .map(AiChatSourceResolver.BranchDetails::source)
            .toList();
        List<Map<String, String>> citations = sourceResolver.citations(sources);
        if (citations == null || citations.isEmpty()) return null;

        String answer;
        if (matches.size() == 1) {
            AiChatSourceResolver.BranchDetails branch = matches.get(0);
            String labels = String.join(
                ", ", sourceResolver.matchedAmenityLabels(branch, resolution.amenityType()));
            answer = "Theo dữ liệu cơ sở đang hoạt động, " + branch.source().title()
                + " có " + amenityName + " (" + labels + ")."
                + " Bạn có thể mở nguồn bên dưới để xem chi tiết và đặt lịch.";
        } else {
            String titles = matches.stream()
                .map(match -> match.source().title())
                .collect(java.util.stream.Collectors.joining("; "));
            // The scan caps the named rows; wording must not claim an
            // exhaustive enumeration when the list was truncated.
            answer = "Theo dữ liệu cơ sở đang hoạt động, "
                + (resolution.truncated() ? "một số cơ sở có " : "các cơ sở có ")
                + amenityName + " gồm: " + titles
                + ". Bạn có thể mở nguồn bên dưới để xem chi tiết và đặt lịch.";
        }
        List<Map<String, String>> actions = sourceResolver.actions(sources);
        if (actions == null || actions.isEmpty()) {
            actions = ChatSuggestedActionResolver.hospitalSupportFallback(content);
        }
        return new SanitizedAiResponse(
            answer,
            SAFE_DISCLAIMER,
            "local_fallback",
            citations,
            ChatSafetyAction.ANSWER,
            null,
            actions,
            "CURRENT",
            sources,
            "local_free",
            "amenity_fallback"
        );
    }

    /**
     * Resolve explicit branch identities before the semantic index is asked
     * to generate.  Numeric branch labels are especially prone to nearby-row
     * matches (Cơ sở 13 can look similar to Cơ sở 2), so an exact operational
     * lookup must be unique before any RAG/provider path is allowed.
     */
    private SanitizedAiResponse deterministicBranchResponse(
            ChatMode mode, String content, List<Map<String, String>> turns) {
        if (mode != ChatMode.HOSPITAL_SUPPORT) return null;

        ChatSuggestedActionResolver.HospitalSupportIntent supportIntent =
            ChatSuggestedActionResolver.classify(content);
        // Preparation questions ("nhịn ăn trước xét nghiệm") deliberately
        // reach retrieval now: the governed article/FAQ corpus answers them
        // with citations, and when nothing authorizes the canned checklist
        // still lands via supportAwareFallback — the deterministic copy is
        // the floor, not the ceiling.
        if (supportIntent == ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY
                && !ChatMedicalSafety.containsProtectedInputCue(content)) {
            // Amenity questions resolve against the live amenities JSON —
            // the RAG copy strips serialized JSON from excerpts, so retrieval
            // cannot answer them faithfully anyway.
            try {
                return amenityDeterministicResponse(content);
            } catch (RuntimeException ex) {
                return null;
            }
        }

        if (supportIntent
                != ChatSuggestedActionResolver.HospitalSupportIntent.BRANCH) {
            // A short attribute follow-up ("Còn số điện thoại thì sao?")
            // does not itself name a branch; resolve its referent from
            // stored history so it cannot drift into the numerically
            // fragile RAG path.  Protected clinical input still goes to
            // the provider safety gate first.
            if (!sourceResolver.hasBranchAttributeCue(content)
                    || ChatMedicalSafety.containsProtectedInputCue(content)) {
                return null;
            }
            try {
                // The current message may still name a specific branch by
                // a noun classify() does not know ("chi nhánh", "phòng
                // khám"); only a message without its own explicit identity
                // may borrow the referent from history, and a named-but-
                // unresolvable identity must fail closed.
                boolean specific = sourceResolver.isSpecificBranchQuery(content);
                List<AiChatSourceResolver.BranchDetails> contextual;
                if (specific) {
                    contextual = sourceResolver.branchDetails(content);
                    if (contextual == null || contextual.isEmpty()) {
                        return branchUnavailableResponse(content);
                    }
                } else {
                    String referent = sourceResolver.latestSpecificBranchUserTurn(turns);
                    if (referent == null) return null;
                    contextual = sourceResolver.branchDetails(referent);
                    if (contextual == null || contextual.isEmpty()) {
                        return branchUnavailableResponse(content);
                    }
                }
                List<AiChatSourceResolver.BranchDetails> bounded = contextual.stream()
                    .filter(java.util.Objects::nonNull)
                    .filter(value -> value.source() != null)
                    .limit(3)
                    .toList();
                if (bounded.isEmpty()) return branchUnavailableResponse(content);
                if (bounded.size() == 1) return branchDetailsResponse(content, bounded);
                return ambiguousBranchResponse(content, bounded);
            } catch (RuntimeException ex) {
                return null;
            }
        }

        // Parity with the public lane's protectedInput gate: a message
        // that mixes a clinical cue with a logistics question ("tôi
        // đang sốt, địa chỉ cơ sở 4 là gì") must reach the provider
        // safety screen, not bypass it via deterministic branch lookup.
        if (ChatMedicalSafety.containsProtectedInputCue(content)) {
            return null;
        }
        try {
            if (!sourceResolver.isSpecificBranchQuery(content)) {
                List<AiChatSourceResolver.BranchDetails> own =
                    sourceResolver.branchDetails(content);
                if (own != null && !own.isEmpty()) {
                    List<AiChatSourceResolver.BranchDetails> boundedOwn = own.stream()
                        .filter(java.util.Objects::nonNull)
                        .filter(value -> value.source() != null)
                        .limit(3)
                        .toList();
                    if (!boundedOwn.isEmpty()) {
                        return boundedOwn.size() == 1
                            ? branchDetailsResponse(content, boundedOwn)
                            : ambiguousBranchResponse(content, boundedOwn);
                    }
                }
                return null;
            }
            List<AiChatSourceResolver.BranchDetails> matches = sourceResolver.branchDetails(content);
            if (matches == null || matches.isEmpty()) return branchUnavailableResponse(content);
            List<AiChatSourceResolver.BranchDetails> bounded = matches.stream()
                .filter(java.util.Objects::nonNull)
                .filter(value -> value.source() != null)
                .limit(3)
                .toList();
            if (bounded.isEmpty()) return branchUnavailableResponse(content);
            if (bounded.size() == 1) return branchDetailsResponse(content, bounded);
            return ambiguousBranchResponse(content, bounded);
        } catch (RuntimeException ex) {
            // A catalog failure is not permission to fall through to generic
            // RAG for a specific branch identity.
            return branchUnavailableResponse(content);
        }
    }

    private SanitizedAiResponse branchDetailsResponse(
            String content,
            List<AiChatSourceResolver.BranchDetails> matches) {
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
        String phone = branch.phone() == null
            ? "Điện thoại đang cập nhật."
            : "Điện thoại: " + branch.phone() + ".";
        List<Map<String, String>> actions = sourceResolver.actions(List.of(source));
        if (actions == null || actions.isEmpty()) {
            actions = ChatSuggestedActionResolver.hospitalSupportFallback(content);
        }

        return new SanitizedAiResponse(
            "Theo dữ liệu cơ sở đang hoạt động, " + source.title() + ". "
                + address + " " + phone + " " + hours
                + " Bạn có thể mở nguồn bên dưới để xem chi tiết và đặt lịch.",
            SAFE_DISCLAIMER,
            "local_fallback",
            citations,
            ChatSafetyAction.ANSWER,
            null,
            actions,
            "CURRENT",
            List.of(source),
            "local_free",
            "branch_details_fallback"
        );
    }

    private SanitizedAiResponse ambiguousBranchResponse(
            String content,
            List<AiChatSourceResolver.BranchDetails> matches) {
        List<AiChatSourceResolver.ResolvedSource> sources = matches.stream()
            .map(AiChatSourceResolver.BranchDetails::source)
            .toList();
        List<Map<String, String>> citations;
        try {
            citations = sourceResolver.citations(sources);
        } catch (RuntimeException ex) {
            return branchUnavailableResponse(content);
        }
        if (citations == null || citations.size() != sources.size()) {
            return branchUnavailableResponse(content);
        }
        String labels = sources.stream()
            .map(AiChatSourceResolver.ResolvedSource::title)
            .filter(value -> value != null && !value.isBlank())
            .collect(java.util.stream.Collectors.joining("; "));
        if (labels.isBlank()) return branchUnavailableResponse(content);

        List<Map<String, String>> actions;
        try {
            actions = sourceResolver.actions(sources).stream()
                .filter(java.util.Objects::nonNull)
                .filter(value -> "VIEW_SOURCE".equals(value.get("kind")))
                .limit(3)
                .toList();
        } catch (RuntimeException ex) {
            actions = List.of();
        }
        if (actions.isEmpty()) {
            actions = ChatSuggestedActionResolver.hospitalSupportFallback(content);
        }

        return new SanitizedAiResponse(
            "Mình tìm thấy nhiều cơ sở phù hợp với yêu cầu này: " + labels
                + ". Bạn cho mình biết quận/thành phố hoặc chọn đúng cơ sở để mình tra giờ làm việc chính xác.",
            SAFE_DISCLAIMER,
            "local_fallback",
            citations,
            ChatSafetyAction.ANSWER,
            null,
            actions,
            "CURRENT",
            sources,
            "local_free",
            "ambiguous_branch_fallback"
        );
    }

    private SanitizedAiResponse branchUnavailableResponse(String content) {
        return new SanitizedAiResponse(
            "Mình chưa thể xác minh cơ sở này từ danh mục đang hoạt động. Bạn hãy kiểm tra lại số cơ sở, "
                + "quận/thành phố hoặc mở mục Cơ sở & giờ làm việc trước khi đến khám.",
            SAFE_DISCLAIMER,
            "local_fallback",
            List.of(),
            ChatSafetyAction.INSUFFICIENT_EVIDENCE,
            null,
            ChatSuggestedActionResolver.hospitalSupportFallback(content),
            "UNAVAILABLE",
            List.of(),
            "local_free",
            "branch_unavailable"
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
        List<UsedSourceSummary> usedSources = stale
            ? List.of()
            : usedSourceSummaries(displaySources);
        // The persisted message does not store routingReason, so the crisis
        // marker is re-derived two ways: the local cue on the stored request
        // (covers the deterministic gate) and the canned crisis body itself
        // (covers phrasings only the upstream AI lexicon caught — its marker
        // is honoured live but not persisted, so the stored answer is the
        // only surviving evidence). A history reload renders the same card
        // the live exchange did.
        String routingReason = value.getSafetyAction() == ChatSafetyAction.EMERGENCY
            && (ChatMedicalSafety.containsSelfHarmCue(requestContent)
                || SELF_HARM_CRISIS_ANSWER.equals(value.getContent()))
            ? "self_harm_crisis" : null;
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
            usedSources,
            null,
            routingReason,
            value.getCreatedAt(),
            value.getCompletedAt()
        );
    }

    private List<UsedSourceSummary> usedSourceSummaries(List<AiChatSourceResolver.ResolvedSource> sources) {
        if (sources == null || sources.isEmpty()) return List.of();
        return sources.stream()
            .map(source -> new UsedSourceSummary(source.id(), source.title(), source.type()))
            .toList();
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

    /**
     * @param freeAnswer the answer the credit gate exempted from payment —
     *        either the static emergency safety text or the degraded answer a
     *        zero-credit patient was allowed to receive — resolved at the gate
     *        so the reply shown is the reply the gate audited. {@code null}
     *        for every paid exchange and for replays.
     */
    private record PreparedMessage(
        UUID userMessageId,
        UUID processingToken,
        ChatExchangeResponse replay,
        SanitizedAiResponse freeAnswer
    ) {
    }

    private record GeneratedChatDraft(ChatMode mode, SanitizedAiResponse response) {
    }

    public record PreparedChatResult(
        ChatExchangeResponse exchange,
        PreparedChatCommitPayload payload
    ) {
        public boolean replayed() {
            return exchange != null;
        }
    }

    public record PatientChatLeaseBinding(UUID patientId, UUID conversationId, String idempotencyKey) {
    }

    public record PreparedChatCommitPayload(
        String requestId,
        UUID patientId,
        UUID conversationId,
        String idempotencyKey,
        UUID userMessageId,
        UUID processingToken,
        ChatMode mode,
        SanitizedAiResponse response
    ) {
    }

    public record SanitizedAiResponse(
        String answer,
        String disclaimer,
        String provenance,
        List<Map<String, String>> citations,
        ChatSafetyAction safetyAction,
        TriageSummary triage,
        List<Map<String, String>> suggestedActions,
        String sourceStatus,
        List<AiChatSourceResolver.ResolvedSource> finalSources,
        String costTier,
        String routingReason
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
                List.copyOf(sources),
                costTier,
                routingReason
            );
        }
    }
}
