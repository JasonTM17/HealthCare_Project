package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.entity.AiMessageRole;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Presentation-only compatibility cleanup for historical synthetic answers.
 *
 * Older beta answers persisted fixture schedules and duplicate doctor labels.
 * The stored audit trail remains unchanged; history reads use current,
 * revalidated source identity to render a concise replacement instead.
 */
final class AiChatHistorySanitizer {

    private static final int MAX_CONTENT_CHARS = 4_000;
    private static final String DISCLAIMER =
        "Nếu cần quyết định phù hợp với tình trạng riêng, hãy trao đổi trực tiếp với nhân viên y tế.";
    private static final String UNSOURCED_SPECIALTY_FALLBACK =
        "Tôi chưa tìm thấy nguồn thông tin đủ cụ thể để gợi ý chuyên khoa cho câu hỏi này. "
            + "Bạn có thể gửi lại câu hỏi sau hoặc trao đổi trực tiếp với nhân viên y tế.";
    private static final String[] SPECIALTY_GUIDANCE_TERMS = {
        "chuyen khoa nao",
        "kham khoa nao",
        "nen kham khoa nao",
        "tim chuyen khoa",
        "chuyen khoa phu hop",
        "phu hop voi trieu chung"
    };

    private AiChatHistorySanitizer() {
    }

    static String sanitize(
            AiMessageRole role,
            String rawContent,
            List<AiChatSourceResolver.ResolvedSource> currentSources) {
        return sanitize(role, rawContent, null, currentSources);
    }

    static String sanitize(
            AiMessageRole role,
            String rawContent,
            String userContent,
            List<AiChatSourceResolver.ResolvedSource> currentSources) {
        return sanitize(role, rawContent, userContent, currentSources, null);
    }

    static String sanitize(
            AiMessageRole role,
            String rawContent,
            String userContent,
            List<AiChatSourceResolver.ResolvedSource> currentSources,
            String provenance) {
        if (role != AiMessageRole.ASSISTANT || rawContent == null || rawContent.isBlank()) {
            return rawContent;
        }

        List<AiChatSourceResolver.ResolvedSource> displaySources = focusSourcesForQuestion(
            userContent, currentSources);
        if (isSpecialtyGuidanceQuestion(userContent) && displaySources.isEmpty()
                && "local_fallback".equals(provenance)) {
            return UNSOURCED_SPECIALTY_FALLBACK;
        }
        if (isSpecialtyGuidanceQuestion(userContent)) {
            String focused = removeDoctorSection(rawContent);
            if (!containsLegacyFixtureMarker(focused)) {
                return limit(collapseRepeatedSpecialtyLabels(focused, displaySources));
            }
        }
        if (!containsLegacyFixtureMarker(rawContent)) {
            return rawContent;
        }

        String content = rawContent.strip();
        int firstDoctor = content.indexOf("Bác sĩ");
        String lead = firstDoctor > 0 ? content.substring(0, firstDoctor).strip() : content;
        if (lead.isBlank() || containsLegacyFixtureMarker(lead)) {
            lead = "Dựa trên nguồn thông tin đã được kiểm duyệt,";
        }

        Set<String> doctorTitles = new LinkedHashSet<>();
        for (AiChatSourceResolver.ResolvedSource source : displaySources) {
            if ("doctor".equals(source.type()) && source.title() != null && !source.title().isBlank()) {
                doctorTitles.add(source.title().strip());
            }
        }

        StringBuilder cleaned = new StringBuilder(collapseRepeatedSpecialtyLabels(lead, displaySources));
        for (String title : doctorTitles) {
            cleaned.append(" Bác sĩ: ").append(title).append(".");
        }
        cleaned.append(" ").append(DISCLAIMER);
        return limit(cleaned.toString());
    }

    static List<AiChatSourceResolver.ResolvedSource> focusSourcesForQuestion(
            String userContent,
            List<AiChatSourceResolver.ResolvedSource> currentSources) {
        List<AiChatSourceResolver.ResolvedSource> safeSources = currentSources == null
            ? List.of() : List.copyOf(currentSources);
        if (!isSpecialtyGuidanceQuestion(userContent) || safeSources.isEmpty()) {
            return safeSources;
        }

        List<AiChatSourceResolver.ResolvedSource> specialties = safeSources.stream()
            .filter(source -> "specialty".equals(source.type()))
            .toList();
        return specialties.isEmpty() ? safeSources : List.copyOf(specialties);
    }

    private static boolean isSpecialtyGuidanceQuestion(String userContent) {
        if (userContent == null || userContent.isBlank()) {
            return false;
        }
        String normalized = normalize(userContent);
        if (normalized.contains("bac si") || normalized.contains("dat lich")
                || normalized.contains("hen kham")) {
            return false;
        }
        for (String term : SPECIALTY_GUIDANCE_TERMS) {
            if (normalized.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static String removeDoctorSection(String rawContent) {
        String content = rawContent.strip();
        int firstDoctor = content.indexOf("Bác sĩ");
        if (firstDoctor < 0) {
            return content;
        }
        String lead = content.substring(0, firstDoctor).strip();
        int disclaimerStart = content.indexOf(DISCLAIMER, firstDoctor);
        String suffix = disclaimerStart >= 0 ? content.substring(disclaimerStart).strip() : DISCLAIMER;
        if (lead.isBlank() || containsLegacyFixtureMarker(lead)) {
            return content;
        }
        return (lead + " " + suffix).strip();
    }

    private static String normalize(String value) {
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .toLowerCase(Locale.ROOT);
    }

    private static String limit(String value) {
        String normalized = value.strip();
        return normalized.substring(0, Math.min(normalized.length(), MAX_CONTENT_CHARS));
    }

    private static String collapseRepeatedSpecialtyLabels(
            String content,
            List<AiChatSourceResolver.ResolvedSource> displaySources) {
        String result = content;
        for (AiChatSourceResolver.ResolvedSource source : displaySources) {
            if (!"specialty".equals(source.type()) || source.title() == null || source.title().isBlank()) {
                continue;
            }
            String title = source.title().strip();
            result = result.replace(title + ": " + title, title + ":");
        }
        return result;
    }

    private static boolean containsLegacyFixtureMarker(String value) {
        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.contains("dữ liệu minh họa") || normalized.contains("lịch thử nghiệm");
    }
}
