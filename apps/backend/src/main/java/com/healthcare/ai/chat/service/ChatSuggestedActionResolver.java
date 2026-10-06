package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.entity.ChatMode;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Server-owned next steps for answers that do not have a current catalog
 * citation.  The browser only accepts the closed action union emitted here;
 * no provider or user supplied URL is used.
 */
public final class ChatSuggestedActionResolver {

    private static final Pattern GREETING_PATTERN = Pattern.compile(
        "(?:(?:xin\\s+)?chao(?:\\s+(?:ban|bac\\s+si|em|tro\\s+ly|ad|admin|ban\\s+oi|moi\\s+nguoi|nha|nhe|ban\\s+nhe|em\\s+nhe))*"
            + "|hello(?:\\s+(?:ban|bot|there|all|oi))?|hi(?:\\s+(?:ban|all|there|bot))?|hey"
            + "|alo(?: ban(?: oi)?| toi can ho tro)?"
            + "|(?:ban|em|tro\\s+ly|bot|may)\\s+la\\s+(?:ai|gi)(?:\\s+(?:a|the|vay|ha|do|the\\s+nhi|the\\s+ta|vay\\s+ta))?"
            + "|gioi\\s+thieu(?:\\s+(?:ve\\s+)?(?:ban|em|tro\\s+ly|minh))?"
            + "|(?:ban|em)\\s+(?:co\\s+the\\s+)?giup(?:\\s+duoc)?\\s+gi(?:\\s+(?:cho\\s+toi|cho\\s+minh|a|the|vay))?)"
            + "\\s*[.!?,;:…]*\\s*"
    );

    private static final String[] BOOKING_TERMS = {
        "dat lich", "lich hen", "hen kham", "dang ky kham", "dat kham", "dat hen",
        "booking", "appointment", "chon bac si", "chon chuyen khoa", "khung gio"
    };
    private static final String[] CATALOG_TERMS = {
        "danh sach chuyen khoa", "nhung chuyen khoa", "chuyen khoa va co so",
        "co chuyen khoa nao", "chuyen khoa nao", "danh sach co so", "co so nao",
        "benh vien o dau", "dia chi benh vien"
    };
    private static final String[] DOCTOR_TERMS = {
        "danh sach bac si", "doi ngu bac si", "tim bac si", "thong tin bac si", "bac si nao",
        "xem bac si", "muon xem bac si"
    };
    private static final String[] PACKAGE_TERMS = {
        "goi kham", "goi suc khoe", "kham tong quat", "package"
    };
    private static final String[] SERVICE_TERMS = {
        "dich vu", "bang gia", "gia dich vu", "xet nghiem"
    };
    private static final String[] BRANCH_TERMS = {
        "co so", "chi nhanh", "gio lam", "gio kham", "mo cua", "thoi gian lam",
        "lam viec", "dia chi", "chu nhat", "cuoi tuan"
    };
    private static final String[] PREPARATION_TERMS = {
        "chuan bi", "truoc khi di kham", "truoc khi kham", "mang theo gi", "giay to",
        "bhyt", "ho so kham", "huong dan kham",
        // "nhịn ăn" fasting prep — parity with the AI service's public
        // preparation terms so both layers classify identically.
        "nhin an"
    };
    /**
     * Facility/amenity vocabulary ("bãi đậu xe", "nhà thuốc", "Wi-Fi").
     * These nouns describe branch amenities, not clinical input — "đậu"
     * normalizes to the same token as "đau" (pain), so this intent is also
     * what keeps parking questions out of the clinical handoff path.
     */
    private static final String[] AMENITY_TERMS = {
        "dau xe", "do xe", "dau oto", "do oto", "dau o to", "do o to",
        "bai xe", "gui xe", "giu xe", "nha xe", "san xe", "parking",
        "xe dau", "xe do", "xe gui", "xe giu",
        "xe may dau", "xe may do", "xe dap dau", "xe dap do",
        "xe tay ga dau", "xe tay ga do", "xe tai dau", "xe tai do",
        "xe buyt dau", "xe buyt do", "xe bus dau", "xe bus do",
        "xe hoi dau", "xe hoi do", "xe om dau", "xe om do",
        "xe dien dau", "xe dien do", "xe khach dau", "xe khach do",
        "xe ba gac dau", "xe ba gac do",
        "oto dau", "oto do", "o to dau", "o to do",
        "moto dau", "moto do", "mo to dau", "mo to do",
        "de xe o", "xe de o",
        "xe may de o", "xe dap de o", "xe tay ga de o", "xe tai de o",
        "xe buyt de o", "xe bus de o", "xe hoi de o", "xe om de o",
        "xe dien de o", "xe khach de o", "xe ba gac de o",
        "oto de o", "o to de o", "moto de o", "mo to de o",
        "cho de xe", "noi de xe", "khu de xe",
        "cho de oto", "cho de o to", "noi de oto",
        "cho dau xe", "cho do xe", "khu dau xe", "khu do xe",
        "cho dau oto", "cho do oto", "cho dau o to", "cho do o to",
        "nha thuoc", "quay thuoc", "cua hang thuoc",
        "wifi", "wi fi", "internet mien phi",
        "atm", "cay atm", "may rut tien", "rut tien",
        "can tin", "canteen", "nha an", "quay an", "quay tu phuc vu",
        "phong cho", "khu vuc cho", "ghe cho", "noi cho", "cho ngoi", "tien ich"
    };
    private static final String[] EDUCATION_TERMS = {
        "bai viet", "bai nao", "cam nang", "faq", "cau hoi thuong gap",
        "kien thuc suc khoe", "huong dan suc khoe"
    };
    private static final String[] SYMPTOM_TERMS = {
        "trieu chung", "dau", "sot", "ho", "met moi", "mat ngu", "chong mat",
        "buon non", "phu hop"
    };

    private ChatSuggestedActionResolver() {
    }

    public enum HospitalSupportIntent {
        GREETING,
        SPECIALTY_GUIDANCE,
        BOOKING,
        CATALOG,
        DOCTOR,
        PACKAGE,
        SERVICE,
        BRANCH,
        PREPARATION,
        EDUCATION,
        AMENITY,
        GENERAL
    }

    /** Classify the latest user question using normalized Vietnamese text. */
    public static HospitalSupportIntent classify(String question) {
        String normalized = normalize(question);
        if (GREETING_PATTERN.matcher(normalized.trim()).matches()) return HospitalSupportIntent.GREETING;
        // Logistics wins over education wording so a mixed question such as
        // "FAQ về đặt lịch" cannot enter the clinical article/FAQ lane.
        if (containsAny(normalized, BOOKING_TERMS)) return HospitalSupportIntent.BOOKING;
        if (containsAny(normalized, EDUCATION_TERMS)) return HospitalSupportIntent.EDUCATION;
        // Facility questions ("bãi đậu xe", "nhà thuốc") must classify before
        // any clinical-looking token is weighed — "đậu" normalizes to "dau".
        if (containsAny(normalized, AMENITY_TERMS)) return HospitalSupportIntent.AMENITY;
        if (isSpecialtyGuidance(normalized)) return HospitalSupportIntent.SPECIALTY_GUIDANCE;
        if (containsAny(normalized, CATALOG_TERMS)) return HospitalSupportIntent.CATALOG;
        if (containsAny(normalized, DOCTOR_TERMS)) return HospitalSupportIntent.DOCTOR;
        if (containsAny(normalized, PREPARATION_TERMS)) return HospitalSupportIntent.PREPARATION;
        if (containsAny(normalized, PACKAGE_TERMS)) return HospitalSupportIntent.PACKAGE;
        if (containsAny(normalized, SERVICE_TERMS)) return HospitalSupportIntent.SERVICE;
        if (containsAny(normalized, BRANCH_TERMS)) return HospitalSupportIntent.BRANCH;
        return HospitalSupportIntent.GENERAL;
    }

    /** Select the public mode from server-owned intent, never browser input. */
    public static ChatMode publicMode(String question) {
        return classify(question) == HospitalSupportIntent.EDUCATION
            ? ChatMode.HEALTH_EDUCATION
            : ChatMode.HOSPITAL_SUPPORT;
    }

    /** Build at most three safe actions for a hospital-support fallback. */
    public static List<Map<String, String>> hospitalSupportFallback(String question) {
        return switch (classify(question)) {
            case GREETING -> actions(
                source("Xem Chuyên khoa", "/specialties"),
                source("Xem Cơ sở", "/branches"));
            case EDUCATION -> actions(
                source("Mở Cẩm nang sức khỏe", "/articles"),
                source("Câu hỏi thường gặp", "/faq"));
            case SPECIALTY_GUIDANCE -> actions(
                source("Xem Chuyên khoa", "/specialties"),
                source("Xem Bác sĩ", "/doctors"),
                booking("Đặt lịch khám", "/dat-lich"));
            case BOOKING -> actions(
                booking("Đặt lịch khám", "/dat-lich"),
                source("Xem Chuyên khoa", "/specialties"),
                source("Xem Bác sĩ", "/doctors"));
            case CATALOG -> actions(
                source("Xem Chuyên khoa", "/specialties"),
                source("Xem Cơ sở", "/branches"),
                booking("Đặt lịch khám", "/dat-lich"));
            case DOCTOR -> actions(
                source("Xem Bác sĩ", "/doctors"),
                booking("Đặt lịch khám", "/dat-lich"),
                source("Xem Chuyên khoa", "/specialties"));
            case PACKAGE -> actions(
                source("Xem Gói khám", "/packages"),
                booking("Đặt lịch khám", "/dat-lich"),
                source("Xem Chuyên khoa", "/specialties"));
            case SERVICE -> actions(
                source("Xem Dịch vụ", "/services"),
                booking("Đặt lịch khám", "/dat-lich"),
                source("Xem Chuyên khoa", "/specialties"));
            case BRANCH -> actions(
                source("Xem Cơ sở", "/branches"),
                booking("Đặt lịch khám", "/dat-lich"),
                source("Xem Chuyên khoa", "/specialties"));
            case PREPARATION -> actions(
                source("Xem Câu hỏi thường gặp", "/faq"),
                source("Xem Cơ sở", "/branches"),
                booking("Đặt lịch khám", "/dat-lich"));
            case AMENITY -> actions(
                source("Xem Cơ sở", "/branches"),
                booking("Đặt lịch khám", "/dat-lich"),
                source("Xem Chuyên khoa", "/specialties"));
            case GENERAL -> actions(
                booking("Đặt lịch khám", "/dat-lich"),
                source("Xem Cơ sở", "/branches"),
                source("Xem Chuyên khoa", "/specialties"));
        };
    }

    private static boolean isSpecialtyGuidance(String normalized) {
        boolean asksForSpecialty = containsAny(
            normalized,
            "nen kham", "kham chuyen khoa", "chuyen khoa phu hop", "khoa nao phu hop",
            "phu hop voi trieu chung");
        boolean mentionsSymptom = containsAny(normalized, SYMPTOM_TERMS);
        return asksForSpecialty && mentionsSymptom;
    }

    private static boolean containsAny(String value, String... terms) {
        for (String term : terms) {
            String boundaryPattern = "(?<![\\p{L}\\p{N}])" + Pattern.quote(term)
                + "(?![\\p{L}\\p{N}])";
            if (Pattern.compile(boundaryPattern).matcher(value).find()) return true;
        }
        return false;
    }

    public static boolean isIdentityQuestion(String question) {
        String normalized = normalize(question);
        return normalized.contains("la ai")
            || normalized.contains("la gi")
            || normalized.contains("gioi thieu")
            || normalized.contains("giup gi");
    }

    public static String normalize(String value) {
        String decomposed = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .toLowerCase(Locale.ROOT);
    }

    private static List<Map<String, String>> actions(Action... values) {
        List<Map<String, String>> result = new ArrayList<>(values.length);
        for (Action value : values) {
            result.add(Map.of("kind", value.kind(), "label", value.label(), "href", value.href()));
        }
        return List.copyOf(result);
    }

    private static Action source(String label, String href) {
        return new Action("VIEW_SOURCE", label, href);
    }

    private static Action booking(String label, String href) {
        return new Action("START_BOOKING", label, href);
    }

    private record Action(String kind, String label, String href) {
    }
}
