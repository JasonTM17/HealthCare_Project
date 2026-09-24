package com.healthcare.ai.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.service.AiChatSourceResolver;
import com.healthcare.ai.chat.service.ChatMedicalSafety;
import com.healthcare.ai.chat.service.ChatSuggestedActionResolver;
import com.healthcare.ai.service.AiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;

/**
 * Stateless public hospital-support chat for visitors who have not signed in.
 *
 * <p>This endpoint deliberately does not create a conversation, persist
 * content, accept a mode, or accept provider/source data from the browser.
 * Authenticated patients continue to use {@code AiConversationController} for
 * retained history.</p>
 *
 * <p>The response boundary is intentionally fail-closed. AI identities are
 * re-resolved against the Spring catalog before their server-owned labels are
 * exposed; provider fields, URLs, and arbitrary metadata never cross this
 * endpoint.</p>
 */
@RestController
@RequestMapping("/api/v1/public/ai")
@Tag(name = "AI Health Assistant", description = "Trợ lý trí tuệ nhân tạo y tế phân luồng triệu chứng và tư vấn")
public class PublicAiChatController {

    private static final Logger log = LoggerFactory.getLogger(PublicAiChatController.class);
    private static final Set<String> ALLOWED_CITATION_SOURCE_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package", "article", "faq"
    );
    private static final Set<String> ALLOWED_OPERATIONAL_CITATION_SOURCE_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package"
    );
    private static final java.util.regex.Pattern CITATION_SOURCE_ID_PATTERN =
        java.util.regex.Pattern.compile("^[A-Za-z0-9._:-]+$");
    private static final java.util.regex.Pattern CONTROL_CHARACTER_PATTERN =
        java.util.regex.Pattern.compile("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]");
    private static final java.util.regex.Pattern PUBLIC_IDENTITY_PATTERN = java.util.regex.Pattern.compile(
        "(?iu)(?:[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}"
            // A refusal may name the kind of identifier it must not receive
            // (for example, "mã hồ sơ") without disclosing an identifier.
            // Require a value-shaped token after the label so that the
            // server-owned refusal is accepted while actual IDs still fail
            // closed.  A digit requirement avoids treating connective words
            // such as "hoặc" as an identifier.
            + "|(?:mã|ma)\\s+(?:bệnh nhân|benh nhan|hồ sơ|ho so|đặt lịch|dat lich)"
                + "(?:(?:\\s*[:#-]\\s*)[A-Za-z0-9][A-Za-z0-9._:-]{2,}"
                + "|\\s+(?=[A-Za-z0-9._:-]*\\d)[A-Za-z0-9][A-Za-z0-9._:-]{2,})"
            + "|(?:patient|medical\\s+record|appointment)\\s*(?:id|number)"
                + "(?:(?:\\s*[:#-]\\s*)[A-Za-z0-9][A-Za-z0-9._:-]{2,}"
                + "|\\s+(?=[A-Za-z0-9._:-]*\\d)[A-Za-z0-9][A-Za-z0-9._:-]{2,}))"
    );
    private static final java.util.regex.Pattern INTERNAL_OUTPUT_PATTERN = java.util.regex.Pattern.compile(
        "(?iu)(?:ai[_ -]?service[_ -]?token|x-ai-service-token|stack\\s*trace|traceback|api[_ -]?key)"
    );
    private static final Set<String> ALLOWED_PROVENANCE = Set.of(
        "local_provider", "local_fallback", "remote_provider"
    );
    private static final Set<String> ALLOWED_SAFETY_ACTIONS = Set.of(
        "ANSWER", "REFUSE", "EMERGENCY", "HUMAN_HANDOFF", "INSUFFICIENT_EVIDENCE"
    );
    private static final int MAX_CITATION_SOURCE_ID_LENGTH = 200;
    private static final int MAX_CITATION_TITLE_LENGTH = 300;
    private static final int MAX_PUBLIC_MESSAGE_LENGTH = 500;
    private static final int MAX_CITATIONS = 20;
    private static final int MAX_ANSWER_LENGTH = 4_000;
    private static final int MAX_DISCLAIMER_LENGTH = 1_000;

    private final AiService aiService;
    private final AiChatSourceResolver sourceResolver;

    public PublicAiChatController(AiService aiService, AiChatSourceResolver sourceResolver) {
        this.aiService = aiService;
        this.sourceResolver = sourceResolver;
    }

    @Operation(summary = "Tư vấn sức khỏe AI thông minh", description = "Hỏi đáp triệu chứng, phân luồng chuyên khoa y tế và hướng dẫn cấp cứu/đặt khám")
    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@Valid @RequestBody PublicChatRequest request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("message", request.message().trim());
        payload.put("public_support_chat", true);
        List<Map<String, String>> mappedTurns = null;
        if (request.recentTurns() != null) {
            mappedTurns = request.recentTurns().stream()
                .map(turn -> Map.of("role", turn.role(), "content", turn.content()))
                .toList();
            payload.put("recent_turns", mappedTurns);
        }

        String userMessage = request.message().trim();
        ChatMode publicMode = ChatSuggestedActionResolver.publicMode(userMessage);
        payload.put("mode", publicMode.name());
        boolean protectedInput = ChatMedicalSafety.containsProtectedInputCue(userMessage);
        if (!protectedInput) {
            Map<String, Object> deterministicBranch = publicSpecificBranchResponse(userMessage);
            if (deterministicBranch != null) return ResponseEntity.ok(deterministicBranch);
        }
        try {
            if (publicMode == ChatMode.HEALTH_EDUCATION) {
                if (ChatMedicalSafety.containsEmergencyInputCue(userMessage)) {
                    return ResponseEntity.ok(publicSafetyFallback(
                        userMessage, "EMERGENCY", ChatMode.HEALTH_EDUCATION));
                }
                return ResponseEntity.ok(publicEducationChat(userMessage, mappedTurns));
            }
            return ResponseEntity.ok(sanitize(aiService.chat(payload), userMessage, publicMode));
        } catch (ResponseStatusException ex) {
            // Broad catalog navigation can be answered from the same live
            // Spring catalog even while the semantic/RAG service is cold or
            // unavailable.  Other questions retain the normal upstream error
            // contract and are handled by the BFF's safe fallback.
            if (isAiFailure(ex)) {
                if (ChatMedicalSafety.containsEmergencyInputCue(userMessage)) {
                    return ResponseEntity.ok(publicSafetyFallback(userMessage, "EMERGENCY", publicMode));
                }
                if (protectedInput) {
                    return ResponseEntity.ok(publicSafetyFallback(userMessage, "HUMAN_HANDOFF", publicMode));
                }
                Map<String, Object> fallback = publicCatalogFallback(userMessage);
                if (fallback != null) return ResponseEntity.ok(fallback);
                fallback = publicMissingVerifiedSourceFallback(userMessage, publicMode);
                if (fallback != null) return ResponseEntity.ok(fallback);
            }
            throw ex;
        }
    }

    /**
     * Public education is deliberately a server-mediated two-step contract.
     * The browser cannot choose the mode, the AI cannot choose the clinical
     * identities, and generation is never called until the live Spring review
     * projection has authorized the retrieved article/FAQ rows.
     */
    private Map<String, Object> publicEducationChat(
            String userMessage,
            List<Map<String, String>> recentTurns) {
        Map<String, Object> retrieval = new LinkedHashMap<>();
        retrieval.put("message", userMessage);
        retrieval.put("mode", ChatMode.HEALTH_EDUCATION.name());
        retrieval.put("top_k", 20);
        if (recentTurns != null) retrieval.put("recent_turns", recentTurns);

        Map<String, Object> retrieved;
        try {
            retrieved = aiService.retrieveChat(retrieval);
        } catch (ResponseStatusException ex) {
            if (isAiFailure(ex)) return publicEducationFallback(userMessage);
            throw ex;
        }
        if (retrieved == null) return publicEducationFallback(userMessage);

        String upstreamMode = requiredString(
            retrieved, "mode", 64, "AI retrieval mode is invalid for public education");
        if (!ChatMode.HEALTH_EDUCATION.name().equals(upstreamMode)) {
            throw badGateway("AI retrieval mode is invalid for public education");
        }
        boundedProvenance(retrieved);
        String safetyAction = boundedSafetyAction(retrieved);
        if (!"ANSWER".equals(safetyAction)) {
            return publicSafetyFallback(userMessage, safetyAction);
        }

        List<AiChatSourceResolver.ResolvedSource> authorized;
        try {
            authorized = sourceResolver.authorize(ChatMode.HEALTH_EDUCATION, retrieved.get("candidates"))
                .stream()
                .filter(Objects::nonNull)
                .filter(source -> Set.of("article", "faq").contains(source.type()))
                .toList();
        } catch (RuntimeException ignored) {
            return publicEducationFallback(userMessage);
        }
        if (authorized.isEmpty()) return publicEducationFallback(userMessage);

        Map<String, Object> generation = new LinkedHashMap<>();
        generation.put("message", userMessage);
        generation.put("mode", ChatMode.HEALTH_EDUCATION.name());
        if (recentTurns != null) generation.put("recent_turns", recentTurns);
        generation.put("authorized_sources", sourceResolver.authorizedPayload(authorized));

        Map<String, Object> generated;
        try {
            generated = aiService.generateChat(generation);
        } catch (ResponseStatusException ex) {
            if (isAiFailure(ex)) return publicEducationFallback(userMessage);
            throw ex;
        }
        return sanitize(generated, userMessage, ChatMode.HEALTH_EDUCATION, authorized);
    }

    /** Unauthenticated public chat with no authorized sources; see the four-argument overload. */
    private Map<String, Object> sanitize(
            Map<String, Object> upstream,
            String userMessage,
            ChatMode publicMode) {
        return sanitize(upstream, userMessage, publicMode, List.of());
    }

    /**
     * Turns a provider response into the only shape the unauthenticated chat
     * endpoint may return. Stronger than the authenticated path because the
     * caller has no identity, no conversation and no way to complain.
     *
     * <p>Guarantees enforced here, each failing closed with 502:
     * <ul>
     *   <li><b>Length and control characters.</b> The answer must be non-blank,
     *       at most {@code MAX_ANSWER_LENGTH} (4 000) characters after trimming,
     *       and free of C0/C1 control characters — the regex deliberately
     *       permits tab/newline while excluding the codes that can hide text or
     *       corrupt a log.</li>
     *   <li><b>No identity or internal leakage.</b> {@code PUBLIC_IDENTITY_PATTERN}
     *       rejects e-mail addresses and value-shaped patient/medical-record/
     *       appointment identifiers, and {@code INTERNAL_OUTPUT_PATTERN} rejects
     *       service tokens, API keys and stack traces. The identity pattern
     *       requires a value-shaped token after the label so the server's own
     *       refusal ("không thể cung cấp mã bệnh nhân") still passes while a
     *       real identifier does not.</li>
     *   <li><b>Mode, provenance and safety action are re-derived, not trusted.</b>
     *       The upstream mode must equal the requested public mode, and
     *       provenance/safety action must come from the allowed sets. An
     *       unsafe claim is rejected unless the answer is REFUSE or EMERGENCY,
     *       and an ANSWER with no verified public catalog citation is replaced by
     *       a deterministic fallback instead of being shown.</li>
     *   <li><b>Citations are revalidated, not echoed.</b> Every citation is
     *       checked for an allowed source type, a well-formed id and a bounded
     *       title, then re-checked against the server-side catalog: in
     *       HEALTH_EDUCATION the set must match the authorized sources exactly.
     *       Citations failing revalidation cause the answer to be replaced with
     *       a server-owned fallback, never returned with unverified
     *       provenance.</li>
     * </ul>
     *
     * <p>{@code userMessage} is used only to classify the question (emergency,
     * protected operational navigation) and to choose which server-owned
     * fallback applies; it never reaches the answer text.
     */
    private Map<String, Object> sanitize(
            Map<String, Object> upstream,
            String userMessage,
            ChatMode publicMode,
            List<AiChatSourceResolver.ResolvedSource> authorized) {
        if (upstream == null || !(upstream.get("answer") instanceof String answer)
                || answer.isBlank()
                || answer.strip().length() > MAX_ANSWER_LENGTH
                || CONTROL_CHARACTER_PATTERN.matcher(answer).find()
                || PUBLIC_IDENTITY_PATTERN.matcher(answer).find()
                || INTERNAL_OUTPUT_PATTERN.matcher(answer).find()) {
            throw badGateway("AI service returned an invalid chat response");
        }

        String normalizedAnswer = answer.strip();
        String upstreamMode = requiredString(
            upstream, "mode", 64, "AI mode is invalid for public chat");
        if (!publicMode.name().equals(upstreamMode)) {
            throw badGateway("AI mode is invalid for public chat");
        }
        String disclaimer = requiredString(
            upstream, "disclaimer", MAX_DISCLAIMER_LENGTH,
            "AI disclaimer is invalid for public chat");
        String provenance = boundedProvenance(upstream);
        String safetyAction = boundedSafetyAction(upstream);
        if (!Set.of("REFUSE", "EMERGENCY").contains(safetyAction)
                && ChatMedicalSafety.containsUnsafeClaim(normalizedAnswer)) {
            throw badGateway("AI response failed the public safety policy");
        }

        List<ValidatedCitation> validatedCitations = validatedCitations(upstream, publicMode);
        boolean protectedOperationalQuery = publicMode == ChatMode.HOSPITAL_SUPPORT
            && ChatMedicalSafety.containsProtectedInputCue(userMessage);
        ChatSuggestedActionResolver.HospitalSupportIntent intent =
            ChatSuggestedActionResolver.classify(userMessage);
        boolean protectedOperationalNavigationQuery = protectedOperationalQuery
            && switch (intent) {
                case SPECIALTY_GUIDANCE, PREPARATION, GREETING, EDUCATION -> false;
                default -> true;
            };
        if ("ANSWER".equals(safetyAction) && validatedCitations.isEmpty()) {
            if (protectedOperationalQuery) {
                String fallbackAction = ChatMedicalSafety.containsEmergencyInputCue(userMessage)
                    ? "EMERGENCY" : "HUMAN_HANDOFF";
                return publicSafetyFallback(userMessage, fallbackAction, publicMode);
            }
            Map<String, Object> navigationFallback = publicNavigationFallback(
                userMessage, publicMode, provenance);
            if (navigationFallback != null) return navigationFallback;
            Map<String, Object> sourceFallback = publicMissingVerifiedSourceFallback(userMessage, publicMode);
            if (sourceFallback != null) return sourceFallback;
            throw badGateway("AI answer is missing a verified public catalog source");
        }
        if ("INSUFFICIENT_EVIDENCE".equals(safetyAction)) {
            if (publicMode == ChatMode.HEALTH_EDUCATION) {
                return publicEducationFallback(userMessage);
            }
            if (ChatMedicalSafety.containsEmergencyInputCue(userMessage)) {
                return publicSafetyFallback(userMessage, "EMERGENCY", publicMode);
            }
            if (protectedOperationalNavigationQuery) {
                return publicSafetyFallback(userMessage, "HUMAN_HANDOFF", publicMode);
            }
            Map<String, Object> fallback = publicCatalogFallback(userMessage);
            if (fallback != null) return fallback;
        }
        if (protectedOperationalQuery && "ANSWER".equals(safetyAction)
                && validatedCitations.stream().anyMatch(citation ->
                    ALLOWED_OPERATIONAL_CITATION_SOURCE_TYPES.contains(citation.source().type()))) {
            String fallbackAction = ChatMedicalSafety.containsEmergencyInputCue(userMessage)
                ? "EMERGENCY" : "HUMAN_HANDOFF";
            return publicSafetyFallback(userMessage, fallbackAction, publicMode);
        }
        List<AiChatSourceResolver.ResolvedSource> currentAuthorized = List.of();
        if (publicMode == ChatMode.HEALTH_EDUCATION && "ANSWER".equals(safetyAction)) {
            if (authorized.isEmpty()) {
                throw badGateway("AI education response is missing an authorized source");
            }
            validateUsedSources(upstream, authorized);
            currentAuthorized = revalidateAuthorized(authorized);
        }
        if (publicMode == ChatMode.HEALTH_EDUCATION && !currentAuthorized.isEmpty()
                && !citationSetMatchesAuthorized(validatedCitations, currentAuthorized)) {
            throw badGateway("AI education citations are not exhaustive");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", normalizedAnswer);
        result.put("disclaimer", disclaimer);
        result.put("citations", validatedCitations.stream()
            .map(ValidatedCitation::identity)
            .toList());
        result.put("provenance", provenance);
        result.put("mode", publicMode.name());
        result.put("safety_action", safetyAction);
        result.put("suggested_actions", suggestedActions(
            userMessage, safetyAction, validatedCitations));
        result.put("costTier", publicCostTier(upstream));
        result.put("routingReason", publicRoutingReason(upstream));
        return result;
    }

    private Map<String, Object> publicEducationFallback(String userMessage) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "answer",
            "Mình chưa tìm thấy bài viết hoặc câu hỏi thường gặp phù hợp trong kho kiến thức "
                + "đã được kiểm duyệt nên chưa thể trả lời chắc chắn. Bạn có thể mở Cẩm nang sức khỏe "
                + "hoặc Câu hỏi thường gặp để xem nguồn hiện có.");
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", List.of());
        result.put("provenance", "local_fallback");
        result.put("mode", ChatMode.HEALTH_EDUCATION.name());
        result.put("safety_action", "INSUFFICIENT_EVIDENCE");
        result.put("suggested_actions", ChatSuggestedActionResolver.hospitalSupportFallback(userMessage));
        result.put("costTier", "local_free");
        result.put("routingReason", "public_education_source_unavailable");
        return result;
    }

    /**
     * Accept only the AI service's deterministic, non-factual navigation path
     * without a catalog citation.  A provider response that claims
     * {@code local_fallback} is still not trusted here; the response is
     * replaced with server-owned copy and closed actions.  Factual service,
     * package, preparation, and education answers continue to require a
     * verified source.
     */
    private Map<String, Object> publicNavigationFallback(
            String userMessage,
            ChatMode publicMode,
            String provenance) {
        if (publicMode != ChatMode.HOSPITAL_SUPPORT || !"local_fallback".equals(provenance)) {
            return null;
        }
        ChatSuggestedActionResolver.HospitalSupportIntent intent =
            ChatSuggestedActionResolver.classify(userMessage);
        String answer = switch (intent) {
            case GREETING ->
                "Xin chào! Mình có thể hỗ trợ bạn tra cứu Chuyên khoa, Bác sĩ, Cơ sở & giờ làm việc "
                    + "hoặc hướng dẫn bắt đầu đặt lịch khám tại HealthCare.";
            case BOOKING ->
                "Bạn có thể bắt đầu tại trang Đặt lịch khám: chọn chuyên khoa hoặc bác sĩ, "
                    + "sau đó chọn cơ sở và khung giờ còn trống. Nếu chưa biết nên bắt đầu từ đâu, "
                    + "hãy mở danh sách Chuyên khoa.";
            case SPECIALTY_GUIDANCE ->
                "Mình chưa thể xác định chuyên khoa phù hợp chỉ từ mô tả hiện tại. "
                    + "Bạn hãy mở danh sách Chuyên khoa để xem thông tin chính thức của HealthCare.";
            case CATALOG ->
                "Bạn muốn tra cứu mục nào? Hãy chọn Chuyên khoa, Bác sĩ hoặc Cơ sở & giờ làm việc "
                    + "bên dưới để xem thông tin chính thức của HealthCare.";
            case DOCTOR ->
                "Để tìm bác sĩ phù hợp, bạn có thể mở danh sách Bác sĩ để xem thông tin hiện có; "
                    + "sau đó chọn Đặt lịch khám nếu muốn tiếp tục.";
            case BRANCH ->
                "Giờ làm việc có thể khác theo từng cơ sở. Hãy mở mục Cơ sở & giờ làm việc "
                    + "để xem thông tin hiện tại trước khi đến khám.";
            case GENERAL ->
                "Mình có thể hỗ trợ tra cứu Chuyên khoa, Bác sĩ, Gói khám, Dịch vụ, "
                    + "Cơ sở & giờ làm việc và hướng dẫn Đặt lịch. Bạn đang muốn tìm mục nào?";
            default -> null;
        };
        if (answer == null) return null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", answer);
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", List.of());
        result.put("provenance", "local_fallback");
        result.put("mode", ChatMode.HOSPITAL_SUPPORT.name());
        result.put("safety_action", "ANSWER");
        result.put("suggested_actions", ChatSuggestedActionResolver.hospitalSupportFallback(userMessage));
        result.put("costTier", "local_free");
        result.put("routingReason", "public_navigation_fallback");
        return result;
    }

    private Map<String, Object> publicSafetyFallback(String userMessage, String safetyAction) {
        return publicSafetyFallback(userMessage, safetyAction, ChatMode.HEALTH_EDUCATION);
    }

    private Map<String, Object> publicMissingVerifiedSourceFallback(
            String userMessage, ChatMode publicMode) {
        if (publicMode != ChatMode.HOSPITAL_SUPPORT) return null;
        ChatSuggestedActionResolver.HospitalSupportIntent intent =
            ChatSuggestedActionResolver.classify(userMessage);
        if (intent != ChatSuggestedActionResolver.HospitalSupportIntent.PREPARATION
                && intent != ChatSuggestedActionResolver.HospitalSupportIntent.PACKAGE
                && intent != ChatSuggestedActionResolver.HospitalSupportIntent.SERVICE) return null;
        Map<String, Object> fallback = publicSafetyFallback(
            userMessage, "INSUFFICIENT_EVIDENCE", publicMode);
        fallback.put("answer", "Mình chưa có nguồn đã xác thực để trả lời chi tiết câu hỏi này. "
            + "Bạn hãy xem thông tin trên website hoặc xác nhận trực tiếp với cơ sở trước buổi khám.");
        fallback.put("suggested_actions",
            ChatSuggestedActionResolver.hospitalSupportFallback(userMessage));
        fallback.put("routingReason", "public_missing_verified_source");
        return fallback;
    }

    private Map<String, Object> publicSafetyFallback(
            String userMessage,
            String safetyAction,
            ChatMode publicMode) {
        String answer = switch (safetyAction) {
            case "EMERGENCY" ->
                "Nếu bạn đang có dấu hiệu nguy hiểm, hãy gọi 115 ngay hoặc đến cơ sở y tế gần nhất. "
                    + "Tôi không tự động gọi thay bạn.";
            case "REFUSE" ->
                "Tôi không thể chẩn đoán hoặc kê đơn. Bạn nên trao đổi trực tiếp với bác sĩ.";
            case "HUMAN_HANDOFF" ->
                "Tôi chưa thể xử lý an toàn yêu cầu này. Bạn có thể trao đổi với nhân viên y tế.";
            default -> "Mình chưa tìm thấy nguồn thông tin phù hợp để trả lời chắc chắn.";
        };
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", answer);
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", List.of());
        result.put("provenance", "local_fallback");
        result.put("mode", publicMode.name());
        result.put("safety_action", safetyAction);
        result.put(
            "suggested_actions",
            "EMERGENCY".equals(safetyAction)
                ? List.of(Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115"))
                : List.of());
        result.put("costTier", "local_free");
        result.put("routingReason", "public_safety_guardrail");
        return result;
    }

    private String publicCostTier(Map<String, Object> upstream) {
        Object raw = upstream.containsKey("cost_tier") ? upstream.get("cost_tier") : upstream.get("costTier");
        if (raw == null) return "local_free";
        if (!(raw instanceof String value) || !(value.equals("local_free") || value.equals("remote_llm"))) {
            throw badGateway("AI cost tier is invalid for public chat");
        }
        return value;
    }

    private String publicRoutingReason(Map<String, Object> upstream) {
        Object raw = upstream.containsKey("routing_reason") ? upstream.get("routing_reason") : upstream.get("routingReason");
        if (raw == null) return null;
        if (!(raw instanceof String value)) {
            throw badGateway("AI routing reason is invalid for public chat");
        }
        value = value.strip();
        if (value.isBlank()) return null;
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    private boolean isAiFailure(ResponseStatusException exception) {
        int status = exception.getStatusCode().value();
        return status == 502 || status == 503 || status == 504;
    }

    private Map<String, Object> publicCatalogFallback(String userMessage) {
        ChatSuggestedActionResolver.HospitalSupportIntent intent =
            ChatSuggestedActionResolver.classify(userMessage);
        if (intent == ChatSuggestedActionResolver.HospitalSupportIntent.BRANCH) {
            return publicBranchFallback(userMessage);
        }
        if (intent != ChatSuggestedActionResolver.HospitalSupportIntent.CATALOG) return null;

        AiChatSourceResolver.CatalogOverview overview;
        try {
            overview = sourceResolver.catalogOverview();
        } catch (RuntimeException ignored) {
            return null;
        }
        if (overview == null || !overview.hasData() || overview.sources().isEmpty()) {
            return null;
        }

        List<Map<String, String>> citations = verifiedOperationalCitations(overview.sources());
        if (citations.isEmpty()) return null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "answer",
            overview.summary()
                + " Bạn có thể mở các mục bên dưới để xem thông tin chi tiết và đặt lịch.");
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", citations);
        result.put("provenance", "local_fallback");
        result.put("mode", ChatMode.HOSPITAL_SUPPORT.name());
        result.put("safety_action", "ANSWER");
        result.put("suggested_actions", ChatSuggestedActionResolver.hospitalSupportFallback(userMessage));
        result.put("costTier", "local_free");
        result.put("routingReason", "public_catalog_fallback");
        return result;
    }

    private Map<String, Object> publicBranchFallback(String userMessage) {
        List<AiChatSourceResolver.BranchDetails> matches;
        try {
            matches = sourceResolver.branchDetails(userMessage);
        } catch (RuntimeException ignored) {
            return null;
        }
        return publicBranchResponse(userMessage, matches);
    }

    /**
     * Resolve an explicit branch identity before public RAG retrieval.  The
     * semantic index can return nearby numeric rows (for example Cơ sở 13 for
     * a query about Cơ sở 2), so a specific operational lookup must be decided
     * by the live Spring catalog first.
     */
    private Map<String, Object> publicSpecificBranchResponse(String userMessage) {
        if (ChatSuggestedActionResolver.classify(userMessage)
                != ChatSuggestedActionResolver.HospitalSupportIntent.BRANCH) {
            return null;
        }
        if (ChatMedicalSafety.containsProtectedInputCue(userMessage)) {
            // Let the AI service's input safety guard decide emergency,
            // refusal, or clinical guidance before any catalog shortcut.
            return null;
        }

        boolean specific;
        List<AiChatSourceResolver.BranchDetails> matches;
        try {
            specific = sourceResolver.isSpecificBranchQuery(userMessage);
            matches = sourceResolver.branchDetails(userMessage);
        } catch (RuntimeException ignored) {
            return publicBranchUnavailable(userMessage);
        }
        if (matches == null || matches.isEmpty()) {
            if (isGenericHospitalHoursQuery(userMessage)) {
                return publicBranchHoursOverview(userMessage);
            }
            if (specific) return publicBranchUnavailable(userMessage);
            return null;
        }
        return publicBranchResponse(userMessage, matches);
    }

    /**
     * A generic opening-hours question about the hospital as a whole (no
     * branch identity and no clinical department) is answered from the live
     * active catalog. Department questions ("khoa ...") belong to the AI
     * service, not the branch catalog.
     */
    private boolean isGenericHospitalHoursQuery(String userMessage) {
        String normalized = Normalizer
            .normalize(userMessage == null ? "" : userMessage, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .toLowerCase(Locale.ROOT);
        if (normalized.contains("khoa ")) return false;
        for (String term : new String[] {
            "mo cua", "dong cua", "gio lam viec", "gio kham", "gio hoat dong", "may gio",
        }) {
            if (normalized.contains(term)) return true;
        }
        return false;
    }

    private Map<String, Object> publicBranchResponse(
            String userMessage,
            List<AiChatSourceResolver.BranchDetails> matches) {
        if (matches == null || matches.isEmpty()) return null;
        List<AiChatSourceResolver.BranchDetails> validMatches = matches.stream()
            .filter(Objects::nonNull)
            .filter(value -> value.source() != null)
            .limit(3)
            .toList();
        if (validMatches.isEmpty()) return null;
        if (validMatches.size() > 1) {
            return publicAmbiguousBranchResponse(userMessage, validMatches);
        }
        return publicUniqueBranchResponse(userMessage, validMatches.get(0));
    }

    private Map<String, Object> publicUniqueBranchResponse(
            String userMessage,
            AiChatSourceResolver.BranchDetails branch) {

        AiChatSourceResolver.ResolvedSource source = branch.source();
        List<Map<String, String>> citations = verifiedOperationalCitations(List.of(source));
        if (citations.isEmpty()
                || !validPublicText(source.title(), MAX_CITATION_TITLE_LENGTH)
                || (branch.address() != null && !validPublicText(branch.address(), 500))
                || (branch.workingHours() != null && !validPublicText(branch.workingHours(), 255))) {
            return null;
        }

        String address = branch.address() == null
            ? "Địa chỉ đang cập nhật."
            : "Địa chỉ: " + branch.address() + ".";
        String hours = branch.workingHours() == null
            ? "Giờ làm việc đang cập nhật; bạn nên kiểm tra lại trước khi đến."
            : "Giờ làm việc: " + branch.workingHours() + ".";
        List<Map<String, String>> actions;
        try {
            actions = sourceResolver.actions(List.of(source));
        } catch (RuntimeException ignored) {
            actions = List.of();
        }
        if (actions == null || actions.isEmpty()) {
            actions = ChatSuggestedActionResolver.hospitalSupportFallback(userMessage);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "answer",
            "Theo dữ liệu cơ sở đang hoạt động, " + source.title() + ". "
                + address + " " + hours
                + " Bạn có thể mở nguồn bên dưới để xem chi tiết và đặt lịch.");
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", citations);
        result.put("provenance", "local_fallback");
        result.put("mode", ChatMode.HOSPITAL_SUPPORT.name());
        result.put("safety_action", "ANSWER");
        result.put("suggested_actions", actions);
        result.put("costTier", "local_free");
        result.put("routingReason", "public_branch_fallback");
        return result;
    }

    private Map<String, Object> publicAmbiguousBranchResponse(
            String userMessage,
            List<AiChatSourceResolver.BranchDetails> matches) {
        List<AiChatSourceResolver.ResolvedSource> sources = matches.stream()
            .map(AiChatSourceResolver.BranchDetails::source)
            .toList();
        List<Map<String, String>> citations = verifiedOperationalCitations(sources);
        if (citations.size() != sources.size()) return null;

        String labels = sources.stream()
            .map(AiChatSourceResolver.ResolvedSource::title)
            .filter(value -> validPublicText(value, MAX_CITATION_TITLE_LENGTH))
            .toList()
            .stream()
            .collect(java.util.stream.Collectors.joining("; "));
        if (labels.isBlank()) return null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "answer",
            "Mình tìm thấy nhiều cơ sở phù hợp với yêu cầu này: " + labels
                + ". Bạn cho mình biết quận/thành phố hoặc chọn đúng cơ sở để mình tra giờ làm việc chính xác.");
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", citations);
        result.put("provenance", "local_fallback");
        result.put("mode", ChatMode.HOSPITAL_SUPPORT.name());
        result.put("safety_action", "ANSWER");
        result.put("suggested_actions", publicViewActions(sources, userMessage));
        result.put("costTier", "local_free");
        result.put("routingReason", "public_ambiguous_branch_fallback");
        return result;
    }

    private Map<String, Object> publicBranchUnavailable(String userMessage) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "answer",
            "Mình chưa thể xác minh cơ sở này từ danh mục đang hoạt động. Bạn hãy kiểm tra lại số cơ sở, "
                + "quận/thành phố hoặc mở mục Cơ sở & giờ làm việc trước khi đến khám.");
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", List.of());
        result.put("provenance", "local_fallback");
        result.put("mode", ChatMode.HOSPITAL_SUPPORT.name());
        result.put("safety_action", "INSUFFICIENT_EVIDENCE");
        result.put("suggested_actions", ChatSuggestedActionResolver.hospitalSupportFallback(userMessage));
        result.put("costTier", "local_free");
        result.put("routingReason", "public_branch_unavailable");
        return result;
    }

    /** Generic opening-hours questions are answered from the live active catalog. */
    private static final int MAX_BRANCH_HOURS_OVERVIEW_ROWS = 4;

    private Map<String, Object> publicBranchHoursOverview(String userMessage) {
        List<AiChatSourceResolver.BranchDetails> branches;
        try {
            branches = sourceResolver.activeBranchOverview(MAX_BRANCH_HOURS_OVERVIEW_ROWS);
        } catch (RuntimeException ignored) {
            return publicBranchUnavailable(userMessage);
        }
        if (branches == null || branches.isEmpty()) {
            return publicBranchUnavailable(userMessage);
        }
        List<String> parts = new ArrayList<>();
        List<AiChatSourceResolver.ResolvedSource> sources = new ArrayList<>();
        for (AiChatSourceResolver.BranchDetails branch : branches) {
            if (branch == null || branch.source() == null) continue;
            String hours = branch.workingHours() == null || branch.workingHours().isBlank()
                ? "giờ làm việc đang cập nhật"
                : branch.workingHours();
            parts.add(branch.source().title() + " — " + hours);
            sources.add(branch.source());
        }
        if (parts.isEmpty()) return publicBranchUnavailable(userMessage);
        List<Map<String, String>> citations = verifiedOperationalCitations(sources);
        if (citations.isEmpty()) return publicBranchUnavailable(userMessage);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "answer",
            "Theo dữ liệu cơ sở đang hoạt động, giờ làm việc của bệnh viện như sau: "
                + String.join("; ", parts)
                + ". Giờ có thể thay đổi trong ngày lễ; bạn nên kiểm tra lại trước khi đến khám.");
        result.put(
            "disclaimer",
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, "
                + "chẩn đoán hoặc điều trị của bác sĩ.");
        result.put("citations", citations);
        result.put("provenance", "local_fallback");
        result.put("mode", ChatMode.HOSPITAL_SUPPORT.name());
        result.put("safety_action", "ANSWER");
        result.put("suggested_actions", ChatSuggestedActionResolver.hospitalSupportFallback(userMessage));
        result.put("costTier", "local_free");
        result.put("routingReason", "public_branch_hours_overview");
        return result;
    }

    private List<Map<String, String>> publicViewActions(
            List<AiChatSourceResolver.ResolvedSource> sources,
            String userMessage) {
        try {
            List<Map<String, String>> actions = sourceResolver.actions(sources).stream()
                .filter(Objects::nonNull)
                .filter(value -> "VIEW_SOURCE".equals(value.get("kind")))
                .limit(3)
                .toList();
            return actions.isEmpty()
                ? ChatSuggestedActionResolver.hospitalSupportFallback(userMessage)
                : actions;
        } catch (RuntimeException ignored) {
            return ChatSuggestedActionResolver.hospitalSupportFallback(userMessage);
        }
    }

    private List<Map<String, String>> verifiedOperationalCitations(
            List<AiChatSourceResolver.ResolvedSource> sources) {
        List<Map<String, String>> rawCitations;
        try {
            rawCitations = sourceResolver.citations(sources);
        } catch (RuntimeException ignored) {
            return List.of();
        }
        if (rawCitations == null || rawCitations.isEmpty()) return List.of();
        List<Map<String, String>> citations = new ArrayList<>(rawCitations.size());
        for (Map<String, String> citation : rawCitations) {
            if (citation == null) return List.of();
            String sourceType = citation.get("source_type");
            String sourceId = citation.get("source_id");
            String title = citation.get("title");
            if (sourceType == null || sourceId == null || title == null
                    || !ALLOWED_OPERATIONAL_CITATION_SOURCE_TYPES.contains(sourceType)
                    || sourceId.length() > MAX_CITATION_SOURCE_ID_LENGTH
                    || !CITATION_SOURCE_ID_PATTERN.matcher(sourceId).matches()
                    || !validPublicText(title, MAX_CITATION_TITLE_LENGTH)) {
                return List.of();
            }
            citations.add(Map.of(
                "source_type", sourceType,
                "source_id", sourceId,
                "title", title.strip()));
        }
        return List.copyOf(citations);
    }

    private boolean validPublicText(String value, int maxLength) {
        return value != null
            && !value.isBlank()
            && value.strip().length() <= maxLength
            && !CONTROL_CHARACTER_PATTERN.matcher(value).find();
    }

    private List<Map<String, String>> suggestedActions(
            String userMessage,
            String safetyAction,
            List<ValidatedCitation> citations) {
        if ("EMERGENCY".equals(safetyAction)) {
            return List.of(Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115"));
        }
        if (Set.of("REFUSE", "HUMAN_HANDOFF").contains(safetyAction)) {
            return List.of();
        }
        if ("ANSWER".equals(safetyAction) && !citations.isEmpty()) {
            List<Map<String, String>> sourceActions = sourceResolver.actions(citations.stream()
                .map(ValidatedCitation::source)
                .toList());
            if (!sourceActions.isEmpty()) return sourceActions;
        }
        return ChatSuggestedActionResolver.hospitalSupportFallback(userMessage);
    }

    private String requiredString(
            Map<String, Object> upstream,
            String key,
            int maxLength,
            String reason) {
        Object value = upstream.get(key);
        if (value instanceof String text
                && !text.isBlank()
                && text.strip().length() <= maxLength
                && !CONTROL_CHARACTER_PATTERN.matcher(text).find()) {
            return text.strip();
        }
        throw badGateway(reason);
    }

    private String boundedProvenance(Map<String, Object> upstream) {
        Object value = upstream.get("provenance");
        if (value instanceof String text && ALLOWED_PROVENANCE.contains(text)) {
            return text;
        }
        throw badGateway("AI provenance is invalid for public chat");
    }

    private String boundedSafetyAction(Map<String, Object> upstream) {
        Object value = upstream.get("safety_action");
        if (value instanceof String text && ALLOWED_SAFETY_ACTIONS.contains(text)) {
            return text;
        }
        throw badGateway("AI safety action is invalid for public chat");
    }

    private List<ValidatedCitation> validatedCitations(
            Map<String, Object> upstream,
            ChatMode publicMode) {
        if (!upstream.containsKey("citations")
                || !(upstream.get("citations") instanceof List<?> items)
                || items.size() > MAX_CITATIONS) {
            throw badGateway("AI citations are invalid for public chat");
        }

        Set<String> seen = new HashSet<>();
        List<ValidatedCitation> result = new ArrayList<>(items.size());
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> citation)) {
                throw badGateway("AI citations are invalid for public chat");
            }
            ValidatedCitation validated = identityOnlyCitation(citation, publicMode);
            if (validated == null) {
                // If an AI citation cannot be verified against the active catalog,
                // omit it gracefully instead of crashing the visitor's entire chat response.
                continue;
            }
            Map<String, String> identity = validated.identity();
            String key = identity.get("source_type") + ":" + identity.get("source_id");
            if (!seen.add(key)) {
                throw badGateway("AI citations are duplicated");
            }
            result.add(validated);
        }
        return List.copyOf(result);
    }

    private boolean citationSetMatchesAuthorized(
            List<ValidatedCitation> citations,
            List<AiChatSourceResolver.ResolvedSource> authorized) {
        if (citations.size() != authorized.size()) return false;
        Set<String> citationKeys = new HashSet<>();
        for (ValidatedCitation citation : citations) {
            Map<String, String> identity = citation.identity();
            citationKeys.add(sourceKey(identity.get("source_type"), identity.get("source_id")));
        }
        Set<String> authorizedKeys = new HashSet<>();
        for (AiChatSourceResolver.ResolvedSource source : authorized) {
            authorizedKeys.add(sourceKey(source.type(), source.id()));
        }
        return citationKeys.size() == citations.size() && citationKeys.equals(authorizedKeys);
    }

    private List<AiChatSourceResolver.ResolvedSource> revalidateAuthorized(
            List<AiChatSourceResolver.ResolvedSource> authorized) {
        List<AiChatSourceResolver.ResolvedSource> current = new ArrayList<>(authorized.size());
        for (AiChatSourceResolver.ResolvedSource expected : authorized) {
            AiChatSourceResolver.ResolvedSource refreshed;
            try {
                refreshed = sourceResolver.revalidate(
                    ChatMode.HEALTH_EDUCATION, expected.type(), expected.id());
            } catch (RuntimeException ignored) {
                throw badGateway("AI education catalog is unavailable for public chat");
            }
            if (refreshed == null || !sameProvenance(expected, refreshed)) {
                throw badGateway("AI education source changed during public chat");
            }
            current.add(refreshed);
        }
        return List.copyOf(current);
    }

    private boolean sameProvenance(
            AiChatSourceResolver.ResolvedSource expected,
            AiChatSourceResolver.ResolvedSource actual) {
        return Objects.equals(expected.type(), actual.type())
            && Objects.equals(expected.id(), actual.id())
            && Objects.equals(expected.active(), actual.active())
            && Objects.equals(expected.published(), actual.published())
            && Objects.equals(expected.projectionKind(), actual.projectionKind())
            && Objects.equals(expected.contentRevision(), actual.contentRevision())
            && Objects.equals(expected.eligibilityRevision(), actual.eligibilityRevision())
            && Objects.equals(expected.contentHash(), actual.contentHash())
            && Objects.equals(expected.approvalId(), actual.approvalId());
    }

    private void validateUsedSources(
            Map<String, Object> upstream,
            List<AiChatSourceResolver.ResolvedSource> authorized) {
        Object raw = upstream.get("used_sources");
        if (!(raw instanceof List<?> values) || values.size() != authorized.size()) {
            throw badGateway("AI education used sources are incomplete");
        }

        Map<String, AiChatSourceResolver.ResolvedSource> expectedByKey = new LinkedHashMap<>();
        for (AiChatSourceResolver.ResolvedSource source : authorized) {
            String key = sourceKey(source.type(), source.id());
            if (expectedByKey.put(key, source) != null) {
                throw badGateway("AI education sources are duplicated");
            }
        }

        Set<String> seen = new HashSet<>();
        Set<String> allowedFields = Set.of(
            "source_type", "source_id", "projection_kind", "content_revision",
            "eligibility_revision", "content_hash", "approval_id");
        for (Object rawValue : values) {
            if (!(rawValue instanceof Map<?, ?> value)
                    || value.keySet().stream().anyMatch(key -> !(key instanceof String)
                        || !allowedFields.contains(key))) {
                throw badGateway("AI education used sources are invalid");
            }
            String type = usedText(value, "source_type");
            String id = usedText(value, "source_id");
            if (type == null || id == null) {
                throw badGateway("AI education used sources are invalid");
            }
            String key = sourceKey(type, id);
            AiChatSourceResolver.ResolvedSource expected = expectedByKey.get(key);
            if (expected == null || !seen.add(key)
                    || !usedTextMatches(value, "projection_kind", expected.projectionKind())
                    || !usedNumberMatches(value, "content_revision", expected.contentRevision())
                    || !usedNumberMatches(value, "eligibility_revision", expected.eligibilityRevision())
                    || !usedTextMatches(value, "content_hash", expected.contentHash())
                    || !usedTextMatches(value, "approval_id", expected.approvalId())) {
                throw badGateway("AI education used source metadata is invalid");
            }
        }
        if (seen.size() != expectedByKey.size()) {
            throw badGateway("AI education used sources are incomplete");
        }
    }

    private String usedText(Map<?, ?> value, String key) {
        Object raw = value.get(key);
        return raw instanceof String text && !text.isBlank() ? text.strip() : null;
    }

    private boolean usedTextMatches(Map<?, ?> value, String key, String expected) {
        if (expected == null) return !value.containsKey(key) || value.get(key) == null;
        return value.get(key) instanceof String actual && expected.equals(actual.strip());
    }

    private boolean usedNumberMatches(Map<?, ?> value, String key, Long expected) {
        if (expected == null) return !value.containsKey(key) || value.get(key) == null;
        Object raw = value.get(key);
        if (!(raw instanceof Number number)) return false;
        if (number instanceof Float || number instanceof Double) {
            return number.doubleValue() == expected.doubleValue();
        }
        return number.longValue() == expected;
    }

    private String sourceKey(String type, String id) {
        return type + ":" + id;
    }

    private ValidatedCitation identityOnlyCitation(
            Map<?, ?> citation,
            ChatMode publicMode) {
        Object sourceType = citation.get("source_type");
        Object sourceId = citation.get("source_id");
        Object title = citation.get("title");
        if (!(sourceType instanceof String rawType)
                || !(sourceId instanceof String rawId)
                || !(title instanceof String citationTitle)) {
            throw badGateway("AI citations are invalid for public chat");
        }

        String type = rawType.strip().toLowerCase(Locale.ROOT);
        String id = rawId.strip();
        if (!ALLOWED_CITATION_SOURCE_TYPES.contains(type)
                || id.length() > MAX_CITATION_SOURCE_ID_LENGTH
                || !CITATION_SOURCE_ID_PATTERN.matcher(id).matches()
                || citationTitle.isBlank()
                || citationTitle.strip().length() > MAX_CITATION_TITLE_LENGTH
                || CONTROL_CHARACTER_PATTERN.matcher(citationTitle).find()) {
            throw badGateway("AI citations are invalid for public chat");
        }

        AiChatSourceResolver.ResolvedSource resolved;
        try {
            resolved = sourceResolver.revalidate(publicMode, type, id);
        } catch (RuntimeException ignored) {
            throw badGateway("AI citation catalog is unavailable for public chat");
        }
        if (resolved == null
                || !Objects.equals(type, resolved.type())
                || !Objects.equals(id, resolved.id())
                || !expectedProjectionKind(publicMode).equals(resolved.projectionKind())
                || resolved.title() == null
                || resolved.title().isBlank()
                || resolved.title().strip().length() > MAX_CITATION_TITLE_LENGTH
                || CONTROL_CHARACTER_PATTERN.matcher(resolved.title()).find()) {
            throw badGateway("AI citation is not an active public catalog source");
        }
        return new ValidatedCitation(
            Map.of(
                "source_type", resolved.type(),
                "source_id", resolved.id(),
                "title", resolved.title().strip()
            ),
            resolved);
    }

    private String expectedProjectionKind(ChatMode publicMode) {
        return publicMode == ChatMode.HEALTH_EDUCATION ? "CLINICAL" : "OPERATIONAL";
    }

    private record ValidatedCitation(
            Map<String, String> identity,
            AiChatSourceResolver.ResolvedSource source) {
    }

    private ResponseStatusException badGateway(String reason) {
        return new ResponseStatusException(BAD_GATEWAY, reason);
    }

    /**
     * Strict visitor request; browser-controlled mode/provider fields are not
     * accepted.  The explicit any-setter is intentional: some production
     * ObjectMapper profiles disable FAIL_ON_UNKNOWN_PROPERTIES globally, so
     * {@code @JsonIgnoreProperties} alone cannot be used as an API boundary.
     */
    @JsonIgnoreProperties(ignoreUnknown = false)
    public static final class PublicChatRequest {
        @JsonProperty("message")
        @NotBlank
        @Size(min = 2, max = MAX_PUBLIC_MESSAGE_LENGTH)
        @Pattern(regexp = "^[^\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]*$")
        private final String message;

        @JsonProperty("recent_turns")
        @Size(max = 6)
        private final List<@NotNull @Valid PublicChatTurn> recentTurns;

        @com.fasterxml.jackson.annotation.JsonCreator
        public PublicChatRequest(
                @JsonProperty("message") String message,
                @JsonProperty("recent_turns") List<@NotNull @Valid PublicChatTurn> recentTurns) {
            this.message = message;
            this.recentTurns = recentTurns;
        }

        public String message() { return message; }

        public List<PublicChatTurn> recentTurns() { return recentTurns; }

        public String getMessage() { return message; }

        public List<PublicChatTurn> getRecentTurns() { return recentTurns; }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof PublicChatRequest value)) return false;
            return Objects.equals(message, value.message)
                && Objects.equals(recentTurns, value.recentTurns);
        }

        @Override
        public int hashCode() {
            return Objects.hash(message, recentTurns);
        }

        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void rejectUnknownField(String field, Object ignoredValue) {
            throw new IllegalArgumentException("Unsupported public chat field: " + field);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = false)
    public static final class PublicChatTurn {
        @JsonProperty("role")
        @NotBlank
        @Pattern(regexp = "user|assistant")
        private final String role;

        @JsonProperty("content")
        @NotBlank
        @Size(max = 2_000)
        @Pattern(regexp = "^[^\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]*$")
        private final String content;

        @com.fasterxml.jackson.annotation.JsonCreator
        public PublicChatTurn(
                @JsonProperty("role") String role,
                @JsonProperty("content") String content) {
            this.role = role;
            this.content = content;
        }

        public String role() { return role; }

        public String content() { return content; }

        public String getRole() { return role; }

        public String getContent() { return content; }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof PublicChatTurn value)) return false;
            return Objects.equals(role, value.role)
                && Objects.equals(content, value.content);
        }

        @Override
        public int hashCode() {
            return Objects.hash(role, content);
        }

        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void rejectUnknownField(String field, Object ignoredValue) {
            throw new IllegalArgumentException("Unsupported public chat turn field: " + field);
        }
    }
}
