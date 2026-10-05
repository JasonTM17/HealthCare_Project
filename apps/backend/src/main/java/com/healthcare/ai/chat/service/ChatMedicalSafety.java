package com.healthcare.ai.chat.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Spring persist-time diagnose/prescribe reject. FastAPI regex is not sufficient. */
public final class ChatMedicalSafety {

    private static final Pattern UNSAFE_CLAIM = Pattern.compile(
        "(chan\\s*doan\\s*(la|toi)|diagnosed as|i diagnose|ke\\s*don|prescribe|prescription|"
            + "lieu\\s*thuoc|uong\\s+\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|vien)|"
            + "(?:take|use)\\s+\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|pills?|tablets?)|"
            + "you\\s+should\\s+(?:take|use)|ngung\\s+thuoc|stop medication)",
        Pattern.CASE_INSENSITIVE
    );
    /** A refusal frame before a claim ("không thể chẩn đoán") makes the claim safe. */
    private static final Pattern NEGATION_FRAME = Pattern.compile(
        "\\b(?:khong|ko|cannot|can not|can t|don t|do not|does not|did not|"
            + "must not|should not|will not|would not)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final String REFUSAL_MODIFIERS =
        "(?:(?:the|duoc phep|duoc|nen|tu y|dua ra|cung cap|thuc hien|to|"
            + "provide|give|offer|a|an|any)\\s+)*";
    private static final String REFUSAL_CLINICAL_VERB =
        "(?:chan doan|diagnose|ke don|prescribe|prescription|lieu thuoc|"
            + "ngung thuoc|stop medication|thay doi thuoc)";
    private static final Pattern DIRECT_REFUSAL_GAP = Pattern.compile(
        "\\s*" + REFUSAL_MODIFIERS,
        Pattern.CASE_INSENSITIVE
    );
    // A refusal can enumerate clinical verbs; unrelated reassurance cannot
    // extend its scope to a later instruction or asserted diagnosis.
    private static final Pattern REFUSAL_LIST_GAP = Pattern.compile(
        "\\s*" + REFUSAL_MODIFIERS
            + "(?:" + REFUSAL_CLINICAL_VERB + "\\s+(?:va|hoac|or|and)\\s+)*",
        Pattern.CASE_INSENSITIVE
    );
    // A comma-only middle item needs a complete verb-only enumeration. Drugs,
    // doses and imperative tails cannot inherit a previous clinical refusal.
    private static final Pattern REFUSAL_ENUMERATION = Pattern.compile(
        "\\s*" + REFUSAL_MODIFIERS + REFUSAL_CLINICAL_VERB
            + "(?:\\s+" + REFUSAL_CLINICAL_VERB + ")*"
            + "\\s+(?:va|hoac|or|and)\\s+" + REFUSAL_CLINICAL_VERB + "\\s*",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern ASSERTED_CLAIM = Pattern.compile(
        "^(?:chan\\s*doan\\s*(?:la|toi)|diagnosed as|i diagnose|uong|take|use|you\\s+should)",
        Pattern.CASE_INSENSITIVE
    );
    /** Vehicle compounds that excuse {@code dau} as "đậu/đỗ" (to park). */
    private static final String VEHICLE_CUE =
        "xe\\s+(?:may|dap|tay\\s+ga|tai|buyt|bus|khach|hoi|om|dien|ba\\s+gac)"
            + "|xe|oto|o\\s*to|moto|mo\\s*to";
    /**
     * Body-part words.  Deliberately excludes {@code co}/{@code tai}/{@code da}
     * — those collide with common particles ("đậu xe có mất phí", "đậu xe tại
     * đâu", "đậu xe đã xong") and would re-protect real parking questions.
     */
    private static final String BODY_PART_CUE =
        "nguc|bung|lung|hong|mat|tay|chan|tim|than|xuong|khop|nao"
            + "|ban\\s+(?:chan|tay)|that\\s+lung|vai|goi|mong|nguoi|minh"
            + "|rang|mui|mieng|mom|hach|khoeo|ngon|nhuc";
    private static final Pattern PROTECTED_INPUT_CUE = Pattern.compile(
        "(?<![a-z0-9])(?:(?<!(?<![a-z0-9])(?:o|vao|bai|nha|san|khu"
            + "|xe|oto|o to|moto|mo to|xe may|xe dap|xe tay ga"
            + "|xe tai|xe buyt|xe bus|xe hoi|xe om|xe dien"
            + "|xe ba gac|xe khach) )(?:dau)"
            + "(?!\\s+(?>(?:" + VEHICLE_CUE + "))\\b"
            + "(?!\\s+(?:" + BODY_PART_CUE + ")\\b))|dau\\s+(?:(?>"
            + VEHICLE_CUE + ")\\s+)?(?:" + BODY_PART_CUE + ")|kho\\s+tho|"
            + "sot|ngat|co\\s+giat(?!\\W*(?:ui|la|giu?|quan|ao|khan)\\b)"
            + "(?!\\W*do\\b(?:\\W*$|\\W+(?:khong|ko|a|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|gi|giu|thue|cho|tre|em|be|con|nguoi|o\\W+dau|o\\W+day)\\b))"
            + "|chay\\s+mau|"
            // Same volition/thinking-idiom guard as EMERGENCY_INPUT_CUE:
            // folded "từ từ" (slowly) must not mark input clinically-protected.
            + "(?:(?:muon|dinh|tinh|quyet|se|sap|dang)\\s+tu\\s+tu"
            + "|nghi\\s+(?!ngoi\\b)(?:den\\s+(?:viec\\s+)?|ve\\s+|toi\\s+)?tu\\s+tu"
            + "|co\\s+y\\s+(?:dinh\\s+)?tu\\s+tu)|chan\\s+doan|ke\\s+don|"
            + "(?:uong|dung|mua|ke|don|tiem|boi|chich|xit|giam|tang|ngung|cat|pha)\\s+thuoc|"
            + "(?<!(?<![a-z0-9])(?:nha|quay|hang) )thuoc(?!\\s+(?:khoa|co\\s+so|benh\\s+vien|thanh\\s+pho)\\b)|"
            + "lieu\\s+thuoc|trieu\\s+chung|non|tieu\\s+chay|chong\\s+mat|"
            + "mat\\s+ngu|bi\\s+ho|ho\\s+keo\\s+dai|cap\\s+cuu|"
            + "dot\\s+quy|tai\\s+bien(?:\\s+mach\\s+mau\\s+nao)?|stroke|"
            + "dotquy|taibien|capcuu|"
            + "heart\\s+attack|cardiac\\s+arrest|chest\\s+pain|shortness\\s+of\\s+breath|"
            + "difficulty\\s+breathing|cant\\s+breathe|cannot\\s+breathe|not\\s+breathing|"
            + "severe\\s+bleeding|unresponsive|collapsed|sudden\\s+collapse|"
            + "loss\\s+of\\s+consciousness|nhoi\\s+mau\\s+co\\s+tim|ngung\\s+tim|"
            + "ngung\\s+tho|bat\\s+tinh|mat\\s+y\\s+thuc|"
            + "heartattack|cardiacarrest|chestpain|shortnessofbreath|difficultybreathing|"
            + "cantbreathe|cannotbreathe|notbreathing|severebleeding|suddencollapse|"
            + "lossofconsciousness|nhoimauco\\s+tim|ngungtim|ngungtho|battinh|matythuc|"
            + "suicide|suicidal|kill\\s+myself|end\\s+my\\s+life|want\\s+to\\s+die|self\\s+harm|"
            + "tutu|cogiat)"
            + "(?![a-z0-9])",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    public static final int EMERGENCY_SCAN_LIMIT = 4096;
    private static final Pattern EMERGENCY_INPUT_CUE = Pattern.compile(
        "(?<![a-z0-9])(?:dot\\s+quy|tai\\s+bien(?:\\s+mach\\s+mau\\s+nao)?|"
            + "stroke|cap\\s+cuu|dau\\s+nguc\\s+du\\s+doi|dau\\s+nguc\\s+lan(?:\\s+ra)?\\s+tay|"
            + "kho\\s+tho(?:\\s+du\\s+doi)?|meo\\s+mieng|yeu\\s+nua\\s+nguoi|ho\\s+ra\\s+mau|"
            // "co giat" (convulsion) must not fire on the amenity question
            // "co giat ui/la/..." (laundry service) — same spelling after
            // diacritic folding, so the exclusion list follows the word.
            // "do" is doubly ambiguous: "giặt đồ" (laundry) and "do" (because
            // of). Rather than enumerate medical reasons (a closed-world list
            // Wukong falsified — "co giật do bị ngã" stayed suppressed), "do"
            // suppresses only at clause end or before laundry-closing words;
            // every other continuation keeps the fail-safe default of firing.
            + "co\\s+giat(?!\\W*(?:ui|la|giu?|quan|ao|khan)\\b)"
            + "(?!\\W*do\\b(?:\\W*$|\\W+(?:khong|ko|a|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|gi|giu|thue|cho|tre|em|be|con|nguoi|o\\W+dau|o\\W+day)\\b))"
            + "|heart\\s+attack|cardiac\\s+arrest|chest\\s+pain|"
            + "shortness\\s+of\\s+breath|difficulty\\s+breathing|cant\\s+breathe|"
            + "cannot\\s+breathe|not\\s+breathing|severe\\s+bleeding|unresponsive|"
            + "collapsed|sudden\\s+collapse|loss\\s+of\\s+consciousness|"
            + "nhoi\\s+mau\\s+co\\s+tim|ngung\\s+tim|ngung\\s+tho|bat\\s+tinh|"
            + "mat\\s+y\\s+thuc|dotquy|taibien|capcuu|heartattack|cardiacarrest|chestpain|"
            + "shortnessofbreath|difficultybreathing|cantbreathe|cannotbreathe|notbreathing|"
            + "severebleeding|suddencollapse|lossofconsciousness|nhoimauco\\s+tim|ngungtim|"
            + "ngungtho|battinh|matythuc|suicide|suicidal|kill\\s+myself|end\\s+my\\s+life|"
            + "want\\s+to\\s+die|self\\s+harm|"
            // "tu tu" folds identically to the benign adverb "từ từ"
            // (slowly), so the spaced form only counts as self-harm when a
            // volition/thinking idiom precedes it ("muốn/định/tính/quyết tự
            // tử", "nghĩ (đến việc|về|tới) tự tử", "có ý (định) tự tử"); the
            // concatenated "tutu" and unambiguous phrases keep full recall.
            + "(?:(?:muon|dinh|tinh|quyet|se|sap|dang)\\s+tu\\s+tu"
            + "|nghi\\s+(?!ngoi\\b)(?:den\\s+(?:viec\\s+)?|ve\\s+|toi\\s+)?tu\\s+tu"
            + "|co\\s+y\\s+(?:dinh\\s+)?tu\\s+tu)|tu\\s+sat|muon\\s+chet|"
            + "khong\\s+muon\\s+song|"
            // Joined "tutu" counts when it opens a token and does not continue
            // into a benign word ("tutuc", "tutuong"). This fires at any token
            // start mid-message — broader than the ai-service squash rule,
            // which only trusts bare "tutu" at stream start; the direction is
            // over-fire (safe side).
            + "tutu(?![conjuy]|th)[a-z0-9]*|tusat|muonchet|khongmuonsong|cogiat)(?![a-z0-9])",
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
        if (answer == null) return false;
        // Sentences split on the RAW text so boundaries survive: normalizeInput
        // collapses punctuation, and a negation must never reach across one.
        // A refusal must grammatically modify this claim. An earlier "không
        // cần lo lắng" is not permission to accept a later dosage or diagnosis.
        for (String rawSentence : answer.split("[.!?\n;]")) {
            String normalized = normalizeInput(rawSentence);
            if (normalized == null) continue;
            java.util.regex.Matcher matcher = UNSAFE_CLAIM.matcher(normalized);
            while (matcher.find()) {
                String prefix = normalized.substring(0, matcher.start());
                java.util.regex.Matcher negation = NEGATION_FRAME.matcher(prefix);
                int lastNegationEnd = -1;
                while (negation.find()) lastNegationEnd = negation.end();
                if (lastNegationEnd < 0) return true;
                String gap = prefix.substring(lastNegationEnd);
                boolean asserted = ASSERTED_CLAIM.matcher(matcher.group()).find();
                Pattern scope = asserted
                    ? DIRECT_REFUSAL_GAP : REFUSAL_LIST_GAP;
                if (!scope.matcher(gap).matches()
                        && (asserted || !REFUSAL_ENUMERATION.matcher(normalized.substring(lastNegationEnd)).matches())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Prevent a catalog-only fast path from bypassing the AI input safety
     * boundary when a user mixes a branch lookup with a clinical concern.
     */
    public static boolean containsProtectedInputCue(String input) {
        String normalized = normalizeInput(input);
        return normalized != null && PROTECTED_INPUT_CUE.matcher(normalized).find();
    }

    /**
     * Identify acute terms locally so an unavailable AI classifier cannot
     * downgrade an emergency and return a catalog navigation action.
     */
    public static boolean containsEmergencyInputCue(String input) {
        // Bound the scan on this unauthenticated boundary: normalization is
        // linear but copies the whole message, and a crisis cue opens the
        // message — anything buried past the window still reaches the
        // length/content validation that runs right after this check.
        String window = input != null && input.length() > EMERGENCY_SCAN_LIMIT
            ? input.substring(0, EMERGENCY_SCAN_LIMIT)
            : input;
        String normalized = normalizeInput(window);
        return normalized != null && EMERGENCY_INPUT_CUE.matcher(normalized).find();
    }

    private static String normalizeInput(String input) {
        if (input == null || input.isBlank()) return null;
        return Normalizer.normalize(input, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
    }
}
