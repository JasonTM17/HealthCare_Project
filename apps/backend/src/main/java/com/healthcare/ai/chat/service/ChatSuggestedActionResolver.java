package com.healthcare.ai.chat.service;

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
        "(?:(?:xin\\s+)?chao(?:\\s+(?:ban|bac\\s+si|em|tro\\s+ly|ad|admin|ban\\s+oi|moi\\s+nguoi|nha))?"
            + "|hello(?:\\s+(?:ban|bot|there|all|oi))?|hi(?:\\s+(?:ban|all|there|bot))?|hey"
            + "|alo(?: ban(?: oi)?| toi can ho tro)?)"
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
        "co so", "gio lam", "gio kham", "mo cua", "thoi gian lam", "lam viec",
        "dia chi", "chu nhat", "cuoi tuan"
    };
    private static final String[] PREPARATION_TERMS = {
        "chuan bi", "truoc khi di kham", "truoc khi kham", "mang theo gi", "giay to",
        "bhyt", "ho so kham", "huong dan kham"
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
        GENERAL
    }

    /** Classify the latest user question using normalized Vietnamese text. */
    public static HospitalSupportIntent classify(String question) {
        String normalized = normalize(question);
        if (GREETING_PATTERN.matcher(normalized.trim()).matches()) return HospitalSupportIntent.GREETING;
        if (isSpecialtyGuidance(normalized)) return HospitalSupportIntent.SPECIALTY_GUIDANCE;
        if (containsAny(normalized, BOOKING_TERMS)) return HospitalSupportIntent.BOOKING;
        if (containsAny(normalized, CATALOG_TERMS)) return HospitalSupportIntent.CATALOG;
        if (containsAny(normalized, DOCTOR_TERMS)) return HospitalSupportIntent.DOCTOR;
        if (containsAny(normalized, PACKAGE_TERMS)) return HospitalSupportIntent.PACKAGE;
        if (containsAny(normalized, SERVICE_TERMS)) return HospitalSupportIntent.SERVICE;
        if (containsAny(normalized, BRANCH_TERMS)) return HospitalSupportIntent.BRANCH;
        if (containsAny(normalized, PREPARATION_TERMS)) return HospitalSupportIntent.PREPARATION;
        return HospitalSupportIntent.GENERAL;
    }

    /** Build at most three safe actions for a hospital-support fallback. */
    public static List<Map<String, String>> hospitalSupportFallback(String question) {
        return switch (classify(question)) {
            case GREETING -> actions(
                source("Xem Chuyên khoa", "/specialties"),
                source("Xem Cơ sở", "/branches"));
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
            case PREPARATION, GENERAL -> actions(
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

    private static String normalize(String value) {
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
