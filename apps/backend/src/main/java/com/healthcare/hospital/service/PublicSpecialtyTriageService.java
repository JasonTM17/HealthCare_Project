package com.healthcare.hospital.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
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
    private static final Pattern EMERGENCY = Pattern.compile(
        "(đau\\s+ngực\\s+dữ\\s+dội|khó\\s+thở\\s+nặng|tự\\s+tử|tự\\s+sát|xuất\\s+huyết\\s+nhiều|"
            + "mất\\s+ý\\s+thức|chest\\s+pain|suicide)",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
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
        if (PII.matcher(symptoms).find()) {
            throw new BusinessException(422, ErrorCodes.CHAT_CONTENT_BLOCKED,
                "Hãy bỏ thông tin nhận dạng cá nhân và thử diễn đạt lại.");
        }
        if (DIAGNOSE_OR_PRESCRIBE.matcher(symptoms).find()) {
            throw new BusinessException(422, ErrorCodes.CHAT_CONTENT_BLOCKED,
                "Công cụ này không chẩn đoán hoặc kê đơn. Hãy mô tả triệu chứng để gợi ý chuyên khoa.");
        }
        if (EMERGENCY.matcher(symptoms).find()) {
            return emergencyPayload();
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

    private Specialty bestMatch(String symptoms, List<Specialty> active) {
        String haystack = normalize(symptoms);
        Specialty winner = null;
        int best = 0;
        int ties = 0;
        for (Specialty specialty : active) {
            int score = score(haystack, specialty);
            if (score <= 0) {
                continue;
            }
            if (score > best) {
                best = score;
                winner = specialty;
                ties = 0;
            } else if (score == best) {
                ties += 1;
            }
        }
        return ties == 0 ? winner : null;
    }

    private int score(String haystack, Specialty specialty) {
        int score = 0;
        String name = normalize(specialty.getName());
        String slug = normalize(specialty.getSlug().replace('-', ' '));
        if (!name.isBlank() && haystack.contains(name)) {
            score += 5;
        }
        if (!slug.isBlank() && haystack.contains(slug)) {
            score += 3;
        }
        for (String token : name.split(" ")) {
            if (token.length() >= 3 && haystack.contains(token)) {
                score += 2;
            }
        }
        for (String symptom : jsonStrings(specialty.getCommonSymptoms())) {
            String needle = normalize(symptom);
            if (!needle.isBlank() && haystack.contains(needle)) {
                score += 4;
            }
        }
        return score;
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
