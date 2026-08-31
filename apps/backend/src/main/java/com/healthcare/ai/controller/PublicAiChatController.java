package com.healthcare.ai.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.service.AiChatSourceResolver;
import com.healthcare.ai.chat.service.ChatMedicalSafety;
import com.healthcare.ai.service.AiService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
public class PublicAiChatController {

    private static final Set<String> ALLOWED_CITATION_SOURCE_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package"
    );
    private static final java.util.regex.Pattern CITATION_SOURCE_ID_PATTERN =
        java.util.regex.Pattern.compile("^[A-Za-z0-9._:-]+$");
    private static final java.util.regex.Pattern CONTROL_CHARACTER_PATTERN =
        java.util.regex.Pattern.compile("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]");
    private static final java.util.regex.Pattern PUBLIC_IDENTITY_PATTERN = java.util.regex.Pattern.compile(
        "(?iu)(?:[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}"
            + "|\\b(?:mã|ma)\\s+(?:bệnh nhân|benh nhan|hồ sơ|ho so|đặt lịch|dat lich)\\b"
            + "|\\b(?:patient|medical\\s+record|appointment)\\s*(?:id|number)\\b)"
    );
    private static final java.util.regex.Pattern INTERNAL_OUTPUT_PATTERN = java.util.regex.Pattern.compile(
        "(?iu)(?:ai[_ -]?service[_ -]?token|x-ai-service-token|stack\\s*trace|traceback|api[_ -]?key)"
    );
    private static final Set<String> ALLOWED_PROVENANCE = Set.of(
        "local_provider", "local_fallback"
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

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@Valid @RequestBody PublicChatRequest request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("message", request.message().trim());
        if (request.recentTurns() != null) {
            payload.put("recent_turns", request.recentTurns());
        }

        Map<String, Object> upstream = aiService.chat(payload);
        return ResponseEntity.ok(sanitize(upstream));
    }

    private Map<String, Object> sanitize(Map<String, Object> upstream) {
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
        if (!ChatMode.HOSPITAL_SUPPORT.name().equals(upstreamMode)) {
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

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", normalizedAnswer);
        result.put("disclaimer", disclaimer);
        result.put("citations", identityOnlyCitations(upstream));
        result.put("provenance", provenance);
        result.put("mode", ChatMode.HOSPITAL_SUPPORT.name());
        result.put("safety_action", safetyAction);
        return result;
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

    private List<Map<String, String>> identityOnlyCitations(Map<String, Object> upstream) {
        if (!upstream.containsKey("citations")
                || !(upstream.get("citations") instanceof List<?> items)
                || items.size() > MAX_CITATIONS) {
            throw badGateway("AI citations are invalid for public chat");
        }

        Set<String> seen = new HashSet<>();
        List<Map<String, String>> result = new ArrayList<>(items.size());
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> citation)) {
                throw badGateway("AI citations are invalid for public chat");
            }
            Map<String, String> identity = identityOnlyCitation(citation);
            String key = identity.get("source_type") + ":" + identity.get("source_id");
            if (!seen.add(key)) {
                throw badGateway("AI citations are duplicated");
            }
            result.add(identity);
        }
        return List.copyOf(result);
    }

    private Map<String, String> identityOnlyCitation(Map<?, ?> citation) {
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
            resolved = sourceResolver.revalidate(ChatMode.HOSPITAL_SUPPORT, type, id);
        } catch (RuntimeException ignored) {
            throw badGateway("AI citation catalog is unavailable");
        }
        if (resolved == null
                || !Objects.equals(type, resolved.type())
                || !Objects.equals(id, resolved.id())
                || !"OPERATIONAL".equals(resolved.projectionKind())
                || resolved.title() == null
                || resolved.title().isBlank()
                || resolved.title().strip().length() > MAX_CITATION_TITLE_LENGTH
                || CONTROL_CHARACTER_PATTERN.matcher(resolved.title()).find()) {
            throw badGateway("AI citation is not an active public catalog source");
        }
        return Map.of(
            "source_type", resolved.type(),
            "source_id", resolved.id(),
            "title", resolved.title().strip()
        );
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
