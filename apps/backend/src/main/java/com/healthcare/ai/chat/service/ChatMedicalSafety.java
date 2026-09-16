package com.healthcare.ai.chat.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Spring persist-time diagnose/prescribe reject. FastAPI regex is not sufficient. */
public final class ChatMedicalSafety {

    private static final Pattern UNSAFE_CLAIM = Pattern.compile(
        "(chẩn\\s*đoán\\s*(là|tôi)|diagnosed as|i diagnose|kê\\s*đơn|prescribe|prescription|"
            + "liều\\s*thuốc|uống\\s+\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|viên)|"
            + "you\\s+should\\s+(?:take|use)|ngừng\\s+thuốc|stop medication)",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern PROTECTED_INPUT_CUE = Pattern.compile(
        "(?<![a-z0-9])(?:dau|dau\\s+(?:nguc|bung|dau)|kho\\s+tho|"
            + "sot|ngat|co\\s+giat|chay\\s+mau|tu\\s+tu|chan\\s+doan|ke\\s+don|"
            + "thuoc|lieu\\s+thuoc|trieu\\s+chung|non|tieu\\s+chay|chong\\s+mat|"
            + "mat\\s+ngu|bi\\s+ho|ho\\s+keo\\s+dai|cap\\s+cuu)"
            + "(?![a-z0-9])",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private ChatMedicalSafety() {
    }

    public static void rejectDiagnoseOrPrescribe(String answer) {
        if (containsUnsafeClaim(answer)) {
            throw new BusinessException(
                422,
                ErrorCodes.CHAT_CONTENT_BLOCKED,
                "AI response contained a diagnosis or prescription claim"
            );
        }
    }

    /** Shared non-throwing predicate for stateless/public response boundaries. */
    public static boolean containsUnsafeClaim(String answer) {
        return answer != null && UNSAFE_CLAIM.matcher(answer).find();
    }

    /**
     * Prevent a catalog-only fast path from bypassing the AI input safety
     * boundary when a user mixes a branch lookup with a clinical concern.
     */
    public static boolean containsProtectedInputCue(String input) {
        if (input == null || input.isBlank()) return false;
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .toLowerCase(Locale.ROOT);
        return PROTECTED_INPUT_CUE.matcher(normalized).find();
    }
}
