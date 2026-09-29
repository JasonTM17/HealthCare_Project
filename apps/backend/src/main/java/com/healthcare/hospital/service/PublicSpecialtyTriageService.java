package com.healthcare.hospital.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.ai.chat.service.ChatMedicalSafety;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Stateless guest specialty triage. Resolves only against the active SQL
 * catalog. Does not call FastAPI, does not create conversations, and never
 * returns model-supplied identities.
 */
@Service
public class PublicSpecialtyTriageService {

    private static final String DISCLAIMER =
        "Thông tin chỉ mang tính tham khảo, không thay thế thăm khám hoặc hướng dẫn của bác sĩ.";

    private static final Pattern DIAGNOSE_OR_PRESCRIBE = Pattern.compile(
        "(chẩn\\s*đoán\\s*(là|tôi)|diagnosed as|kê\\s*đơn|prescribe|liều\\s*thuốc|"
            + "uống\\s+\\d|bạn\\s+bị|you\\s+have)",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    /**
     * Emergency detection is delegated to {@link ChatMedicalSafety}, the same
     * normalized (diacritic-folded, đ→d) lexicon the AI safety boundary and
     * the public chat controller use, so this endpoint cannot drift from it.
     * This pattern carries ONLY the few acute expressions the shared lexicon
     * does not list — tự sát, xuất huyết, đau tim, unconscious — kept as an
     * explicit remainder so adopting the shared vocabulary cannot silently
     * lose coverage this endpoint already had. It is matched against
     * accent-folded text, never raw input.
     */
    private static final Pattern EMERGENCY_SUPPLEMENT = Pattern.compile(
        "(?<![a-z0-9])(?:tu\\s+sat|xuat\\s+huyet|dau\\s+tim|unconscious)(?![a-z0-9])",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern PII = Pattern.compile(
        "([A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|\\b0\\d{8,10}\\b|"
            + "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})",
        Pattern.CASE_INSENSITIVE
    );

    private final SpecialtyRepository specialtyRepository;
    private final boolean enabled;

    public PublicSpecialtyTriageService(
            SpecialtyRepository specialtyRepository,
            @Value("${app.public.specialty-triage.enabled:false}") boolean enabled) {
        this.specialtyRepository = specialtyRepository;
        this.enabled = enabled;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> triage(String rawSymptoms) {
        if (!enabled) {
            throw new BusinessException(503, ErrorCodes.AI_UNAVAILABLE, "Public specialty triage is disabled");
        }
        String symptoms = rawSymptoms == null ? "" : rawSymptoms.trim();
        if (symptoms.length() < 2 || symptoms.length() > 500) {
            throw new BusinessException(400, ErrorCodes.VALIDATION_ERROR,
                "Mô tả triệu chứng phải dài từ 2 đến 500 ký tự.");
        }
        // Emergency check runs FIRST, before every rejection path (audit A4):
        // a crisis message that also carries PII or a diagnose-shaped phrase
        // must still receive the 115 guidance, never a 422 with none.
        // Detection is delegated to the shared ChatMedicalSafety lexicon —
        // normalized and diacritic-folded, so an accent-free "dau nguc du
        // doi" matches — instead of this class keeping its own diacritic-
        // anchored list that could drift from the AI safety boundary.
        if (isEmergency(symptoms)) {
            return emergencyPayload();
        }
        if (PII.matcher(symptoms).find()) {
            throw new BusinessException(422, ErrorCodes.CHAT_CONTENT_BLOCKED,
                "Hãy bỏ thông tin nhận dạng cá nhân và thử diễn đạt lại.");
        }
        if (DIAGNOSE_OR_PRESCRIBE.matcher(symptoms).find()) {
            throw new BusinessException(422, ErrorCodes.CHAT_CONTENT_BLOCKED,
                "Công cụ này không chẩn đoán hoặc kê đơn. Hãy mô tả triệu chứng để gợi ý chuyên khoa.");
        }

        Specialty match = bestMatch(symptoms, specialtyRepository.findByActiveTrue());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("disclaimer", DISCLAIMER);
        body.put("suggested_questions", List.of(
            "Triệu chứng bắt đầu khi nào?",
            "Có sốt, khó thở hoặc chóng mặt không?",
            "Bạn muốn đặt lịch tại cơ sở nào?"
        ));
        body.put("provenance", "sql-catalog");
        if (match == null) {
            body.put("recommended_specialty", "Chưa xác định chuyên khoa");
            body.put("specialty_resolution", "UNRESOLVED");
            body.put("urgency_level", "NORMAL");
            body.put("clinical_advice",
                "Chưa khớp được một chuyên khoa duy nhất trong danh mục. Bạn có thể xem danh sách chuyên khoa hoặc đặt lịch nội tổng hợp.");
            body.put("citations", List.of());
            return body;
        }
        body.put("recommended_specialty", match.getName());
        body.put("recommended_specialty_id", match.getId().toString());
        body.put("recommended_specialty_slug", match.getSlug());
        body.put("specialty_resolution", "RESOLVED");
        body.put("urgency_level", "NORMAL");
        body.put("clinical_advice",
            "Dựa trên mô tả, bạn có thể xem chuyên khoa " + match.getName()
                + " trong catalog và đặt lịch nếu phù hợp. Đây không phải chẩn đoán.");
        body.put("citations", List.of(Map.of(
            "source_type", "specialty",
            "source_id", match.getId().toString(),
            "title", match.getName()
        )));
        return body;
    }

    /**
     * Shared Spring emergency lexicon ({@link ChatMedicalSafety} normalizes
     * the input itself), combined with the accent-folded remainder pattern so
     * moving to the shared vocabulary cannot lose expressions this endpoint
     * already caught. Folding here maps đ→d explicitly because this class's
     * own {@link #normalize} drops đ to a space.
     */
    private boolean isEmergency(String symptoms) {
        if (ChatMedicalSafety.containsEmergencyInputCue(symptoms)) {
            return true;
        }
        return EMERGENCY_SUPPLEMENT.matcher(normalize(symptoms
            .replace('đ', 'd')
            .replace('Đ', 'D'))).find();
    }

    private Map<String, Object> emergencyPayload() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("recommended_specialty", "Cấp cứu");
        body.put("specialty_resolution", "UNRESOLVED");
        body.put("urgency_level", "EMERGENCY");
        body.put("clinical_advice",
            "Nếu bạn đang có dấu hiệu cấp cứu, hãy gọi 115 hoặc đến cơ sở y tế gần nhất. Công cụ này không thay thế cấp cứu.");
        body.put("suggested_questions", List.of());
        body.put("disclaimer", DISCLAIMER);
        body.put("citations", List.of());
        body.put("provenance", "sql-catalog");
        return body;
    }

    /**
     * After accent folding (NFD mark strip) a monosyllabic identity phrase is
     * homophone-ambiguous in Vietnamese — "mất" (of "mất ngủ") and "mắt" both
     * fold to "mat" — so a single word shorter than this length never counts
     * as specialty identity evidence. Multi-word names and symptom phrases
     * keep their evidence value.
     */
    private static final int MIN_SINGLE_WORD_IDENTITY = 4;

    private Specialty bestMatch(String symptoms, List<Specialty> active) {
        String haystack = normalize(symptoms);
        // How many active specialties carry each normalized symptom needle, so
        // the unshared-evidence tie-break below only credits needles unique to
        // one specialty.
        Map<String, Integer> needleCarriers = new HashMap<>();
        for (Specialty specialty : active) {
            for (String symptom : jsonStrings(specialty.getCommonSymptoms())) {
                String needle = normalize(symptom);
                if (!needle.isBlank()) {
                    needleCarriers.merge(needle, 1, Integer::sum);
                }
            }
        }
        Specialty winner = null;
        int best = 0;
        int bestUnshared = 0;
        String winnerSlug = null;
        for (Specialty specialty : active) {
            int score = score(haystack, specialty);
            if (score <= 0) {
                continue;
            }
            int unshared = unsharedSymptomHits(haystack, specialty, needleCarriers);
            boolean wins = winner == null
                || score > best
                || (score == best && unshared > bestUnshared)
                || (score == best && unshared == bestUnshared
                    && specialty.getSlug().compareTo(winnerSlug) < 0);
            if (wins) {
                best = score;
                bestUnshared = unshared;
                winnerSlug = specialty.getSlug();
                winner = specialty;
            }
        }
        // Ties resolve deterministically (unshared symptom evidence first, then
        // smallest slug) instead of returning null: a symptom shared by several
        // specialties — "Mệt mỏi kéo dài" is carried by three — used to
        // dead-end in UNRESOLVED, which kept the frontend booking CTA hidden.
        return winner;
    }

    private int unsharedSymptomHits(
            String haystack, Specialty specialty, Map<String, Integer> needleCarriers) {
        int hits = 0;
        for (String symptom : jsonStrings(specialty.getCommonSymptoms())) {
            String needle = normalize(symptom);
            if (!needle.isBlank()
                    && Integer.valueOf(1).equals(needleCarriers.get(needle))
                    && matchesPhrase(haystack, needle)) {
                hits += 1;
            }
        }
        return hits;
    }

    private int score(String haystack, Specialty specialty) {
        int score = 0;
        String name = normalize(specialty.getName());
        String slug = normalize(specialty.getSlug().replace('-', ' '));
        if (matchesIdentity(haystack, name)) {
            score += 5;
        }
        if (!slug.equals(name) && matchesIdentity(haystack, slug)) {
            score += 3;
        }
        for (String token : name.split(" ")) {
            if (!token.equals(name) && matchesIdentity(haystack, token)) {
                score += 2;
            }
        }
        for (String symptom : jsonStrings(specialty.getCommonSymptoms())) {
            String needle = normalize(symptom);
            if (!needle.isBlank() && matchesPhrase(haystack, needle)) {
                score += 4;
            }
        }
        return score;
    }

    /** Word-boundary match on the already-normalized haystack. */
    private boolean matchesPhrase(String haystack, String needle) {
        if (needle.isBlank()) {
            return false;
        }
        return Pattern.compile("\\b" + Pattern.quote(needle) + "\\b").matcher(haystack).find();
    }

    /**
     * Identity evidence (specialty name, slug, or name token) counts only at a
     * word boundary and never from a single short word: after folding,
     * "đau đầu … mất ngủ" contains the same "mat" token as the "Mắt" name, and
     * the old contains() matching triple-counted that one three-letter word
     * into 10 points (name + slug + token), outscoring a real 4-point symptom
     * phrase such as "đau đầu kéo dài".
     */
    private boolean matchesIdentity(String haystack, String needle) {
        if (needle.isBlank()
                || (!needle.contains(" ") && needle.length() < MIN_SINGLE_WORD_IDENTITY)) {
            return false;
        }
        return matchesPhrase(haystack, needle);
    }

    private List<String> jsonStrings(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return values;
        }
        node.forEach(item -> {
            if (item != null && item.isTextual()) {
                values.add(item.asText());
            }
        });
        return values;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", " ")
            .trim();
    }
}
