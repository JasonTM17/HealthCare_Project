package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiService;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;

/**
 * Stateless public hospital-support chat for visitors who have not signed in.
 *
 * This endpoint deliberately does not create a conversation, persist content,
 * accept a mode, or accept provider/source data from the browser. Authenticated
 * patients continue to use AiConversationController for retained history.
 */
@RestController
@RequestMapping("/api/v1/public/ai")
public class PublicAiChatController {

    private static final Set<String> ALLOWED_CITATION_SOURCE_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package", "article", "faq"
    );
    private static final java.util.regex.Pattern CITATION_SOURCE_ID_PATTERN =
        java.util.regex.Pattern.compile("^[A-Za-z0-9._:-]+$");
    private static final int MAX_CITATION_SOURCE_ID_LENGTH = 200;
    private static final int MAX_CITATION_TITLE_LENGTH = 300;
    private static final int MAX_PUBLIC_MESSAGE_LENGTH = 500;

    private final AiService aiService;

    public PublicAiChatController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@Valid @RequestBody PublicChatRequest request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("message", request.message().trim());
        if (request.recentTurns() != null) payload.put("recent_turns", request.recentTurns());

        Map<String, Object> upstream = aiService.chat(payload);
        return ResponseEntity.ok(sanitize(upstream));
    }

    private Map<String, Object> sanitize(Map<String, Object> upstream) {
        if (upstream == null || !(upstream.get("answer") instanceof String answer)
            || answer.isBlank() || answer.length() > 4_000) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI service returned an invalid chat response");
        }
        Object upstreamMode = upstream.get("mode");
        if (upstreamMode != null
            && (!(upstreamMode instanceof String) || !"HOSPITAL_SUPPORT".equals(upstreamMode))) {
            throw new ResponseStatusException(BAD_GATEWAY, "AI mode is invalid for public chat");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("answer", answer.strip());
        result.put("disclaimer", boundedString(upstream.get("disclaimer"),
            "Thông tin từ trợ lý AI chỉ mang tính tham khảo và không thay thế tư vấn, chẩn đoán hoặc điều trị của bác sĩ."));
        result.put("citations", identityOnlyCitations(upstream.get("citations")));
        result.put("provenance", boundedProvenance(upstream.get("provenance")));
        result.put("mode", "HOSPITAL_SUPPORT");
        result.put("safety_action", boundedSafetyAction(upstream.get("safety_action")));
        return result;
    }

    private String boundedString(Object value, String fallback) {
        if (value == null) return fallback;
        if (value instanceof String text && !text.isBlank() && text.length() <= 4_000) return text.strip();
        throw new ResponseStatusException(BAD_GATEWAY, "AI disclaimer is invalid for public chat");
    }

    private String boundedProvenance(Object value) {
        if (value == null) return "local_provider";
        if (value instanceof String text
            && Set.of("local_provider", "local_fallback").contains(text)) return text;
        throw new ResponseStatusException(BAD_GATEWAY, "AI provenance is invalid for public chat");
    }

    private String boundedSafetyAction(Object value) {
        if (value == null) return "ANSWER";
        if (value instanceof String text
            && Set.of("ANSWER", "REFUSE", "EMERGENCY", "HUMAN_HANDOFF", "INSUFFICIENT_EVIDENCE").contains(text)) {
            return text;
        }
        throw new ResponseStatusException(BAD_GATEWAY, "AI safety action is invalid for public chat");
    }

    private List<Map<String, String>> identityOnlyCitations(Object citations) {
        if (!(citations instanceof List<?> items)) return List.of();
        return items.stream()
            .filter(Map.class::isInstance)
            .map(item -> identityOnlyCitation((Map<?, ?>) item))
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    private Map<String, String> identityOnlyCitation(Map<?, ?> citation) {
        Object sourceType = citation.get("source_type");
        Object sourceId = citation.get("source_id");
        Object title = citation.get("title");
        if (!(sourceType instanceof String type)
            || !ALLOWED_CITATION_SOURCE_TYPES.contains(type)
            || !(sourceId instanceof String id)
            || id.length() > MAX_CITATION_SOURCE_ID_LENGTH
            || !CITATION_SOURCE_ID_PATTERN.matcher(id).matches()
            || !(title instanceof String citationTitle)
            || citationTitle.isBlank()
            || citationTitle.strip().length() > MAX_CITATION_TITLE_LENGTH) {
            return null;
        }
        return Map.of("source_type", type, "source_id", id, "title", citationTitle.strip());
    }

    @JsonIgnoreProperties(ignoreUnknown = false)
    public record PublicChatRequest(
        @NotBlank @Size(min = 2, max = MAX_PUBLIC_MESSAGE_LENGTH) String message,
        @JsonProperty("recent_turns") @Size(max = 6) List<@Valid PublicChatTurn> recentTurns
    ) {
        @JsonAnySetter
        public void rejectUnknownField(String field, Object ignoredValue) {
            throw new IllegalArgumentException("Unsupported public chat field: " + field);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = false)
    public record PublicChatTurn(
        @NotBlank @Pattern(regexp = "user|assistant") String role,
        @NotBlank @Size(max = 2_000) String content
    ) {
        @JsonAnySetter
        public void rejectUnknownField(String field, Object ignoredValue) {
            throw new IllegalArgumentException("Unsupported public chat turn field: " + field);
        }
    }
}
