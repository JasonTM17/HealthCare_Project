package com.healthcare.ai.controller;

import com.healthcare.ai.service.AiService;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.List;
import java.util.Locale;
import java.text.Normalizer;
import java.util.regex.Pattern;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@RestController
@RequestMapping("/api/v1/ai")
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN')")
public class AiController {

    private static final Set<String> ALLOWED_CITATION_SOURCE_TYPES = Set.of(
        "branch", "specialty", "doctor", "service", "package", "article", "faq"
    );
    private static final Pattern CITATION_SOURCE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]+$");
    private static final Pattern TOP_LEVEL_IDENTITY_FIELD_PATTERN = Pattern.compile(
        "^(?:id|slug|uuid|.+_(?:id|slug|uuid))$",
        Pattern.CASE_INSENSITIVE
    );
    private static final int MAX_CITATION_SOURCE_ID_LENGTH = 200;
    private static final int MAX_CITATION_TITLE_LENGTH = 300;

    private final AiService aiService;
    private final SpecialtyRepository specialtyRepository;

    public AiController(AiService aiService, SpecialtyRepository specialtyRepository) {
        this.aiService = aiService;
        this.specialtyRepository = specialtyRepository;
    }

    @PostMapping("/symptom-check")
    public ResponseEntity<Map<String, Object>> symptomCheck(@Valid @RequestBody AiRequest request) {
        return ResponseEntity.ok(aiService.symptomCheck(Map.of("symptoms", request.symptoms())));
    }

    @PostMapping("/specialty-recommendation")
    public ResponseEntity<Map<String, Object>> specialtyRecommendation(@Valid @RequestBody AiRequest request) {
        Map<String, Object> result = new LinkedHashMap<>(
            aiService.recommendSpecialty(Map.of("symptoms", request.symptoms()))
        );
        // Never trust an upstream model/provider identity. The only identity
        // allowed to cross this boundary is the one resolved from active SQL
        // catalog rows below.
        stripTopLevelIdentityFields(result);
        result.remove("specialty_resolution");
        result.put("citations", identityOnlyCitations(result.get("citations")));
        Specialty resolved = resolveSpecialty(result.get("recommended_specialty"));
        if (resolved == null) {
            result.put("specialty_resolution", "UNRESOLVED");
        } else {
            result.put("specialty_resolution", "RESOLVED");
            result.put("recommended_specialty_id", resolved.getId().toString());
            result.put("recommended_specialty_slug", resolved.getSlug());
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/chat")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> chat(@Valid @RequestBody ChatRequest request) {
        Map<String, Object> result = new LinkedHashMap<>(aiService.chat(request.toPayload()));
        stripTopLevelIdentityFields(result);
        result.put("citations", identityOnlyCitations(result.get("citations")));
        return ResponseEntity.ok(result);
    }

    private void stripTopLevelIdentityFields(Map<String, Object> result) {
        result.keySet().removeIf(key -> TOP_LEVEL_IDENTITY_FIELD_PATTERN.matcher(key).matches());
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

    private Specialty resolveSpecialty(Object recommendation) {
        if (!(recommendation instanceof String value) || value.isBlank()) return null;
        String candidate = normalize(value);
        if (candidate.isBlank()) return null;
        List<Specialty> active = specialtyRepository.findByActiveTrue();

        List<Specialty> exact = active.stream()
            .filter(item -> normalize(item.getName()).equals(candidate)
                || normalize(item.getSlug()).equals(candidate))
            .toList();
        if (exact.size() == 1) return exact.get(0);

        List<Specialty> contained = active.stream()
            .filter(item -> normalize(item.getName()).contains(candidate)
                || candidate.contains(normalize(item.getName())))
            .toList();
        return contained.size() == 1 ? contained.get(0) : null;
    }

    private String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", " ")
            .trim();
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(
        @RequestParam("q") String query,
        @RequestParam(name = "top_k", defaultValue = "5") int topK
    ) {
        if (query == null || query.isBlank() || query.length() > 10_000) {
            throw new ResponseStatusException(BAD_REQUEST, "Search query must be between 1 and 10000 characters");
        }
        if (topK < 1 || topK > 20) {
            throw new ResponseStatusException(BAD_REQUEST, "Search result limit must be between 1 and 20");
        }
        return ResponseEntity.ok(aiService.search(query, topK));
    }

    public record AiRequest(@NotBlank @Size(min = 2, max = 10_000) String symptoms) {
    }

    public record ChatRequest(
        @NotBlank @Size(min = 2, max = 10_000) String message,
        @JsonProperty("recent_history") @Size(max = 6) List<@Valid ChatTurn> recentHistory
    ) {
        Map<String, Object> toPayload() {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("message", message);
            if (recentHistory != null) payload.put("recent_history", recentHistory);
            return payload;
        }
    }

    public record ChatTurn(
        @NotBlank @jakarta.validation.constraints.Pattern(regexp = "user|assistant") String role,
        @NotBlank @Size(max = 2_000) String content
    ) {
    }
}
