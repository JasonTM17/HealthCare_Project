package com.healthcare.ai.chat.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;

import java.util.regex.Pattern;

/** Spring persist-time diagnose/prescribe reject. FastAPI regex is not sufficient. */
public final class ChatMedicalSafety {

    private static final Pattern UNSAFE_CLAIM = Pattern.compile(
        "(chẩn\\s*đoán\\s*(là|tôi)|diagnosed as|i diagnose|kê\\s*đơn|prescribe|prescription|"
            + "liều\\s*thuốc|uống\\s+\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|viên)|"
            + "you\\s+should\\s+(?:take|use)|ngừng\\s+thuốc|stop medication)",
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
}
