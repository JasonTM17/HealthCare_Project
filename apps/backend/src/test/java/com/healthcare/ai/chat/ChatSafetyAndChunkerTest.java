package com.healthcare.ai.chat;

import com.healthcare.ai.chat.service.ChatAnswerChunker;
import com.healthcare.ai.chat.service.ChatMedicalSafety;
import com.healthcare.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatSafetyAndChunkerTest {

    @Test
    void persistTimeRejectsDiagnoseAndPrescribeClaims() {
        assertThatThrownBy(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe("Chẩn đoán là viêm phổi"))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode())
            .isEqualTo("CHAT_CONTENT_BLOCKED");
        assertThatThrownBy(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe("You should take 500 mg"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe("Kê đơn thuốc giảm đau cho bạn"))
            .isInstanceOf(BusinessException.class);
        assertThatCode(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe(
            "Ban co the xem chuyen khoa Than kinh va dat lich."))
            .doesNotThrowAnyException();
    }

    @Test
    void unsafeClaimDetectionAcceptsRefusalsAndRejectsBareClaims() {
        // Identity/self-intro answers always carry the refusal vocabulary; a
        // refusal frame before the claim ("không thể chẩn đoán", "không kê
        // đơn") must not count as a diagnosis or prescription.
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "Tôi là trợ lý thông tin sức khỏe, không thể chẩn đoán hoặc kê đơn.")).isFalse();
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "Bạn là ai vậy? Tôi là trợ lý, không đưa ra chẩn đoán là gì cả.")).isFalse();
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "Tôi không kê đơn. Bạn nên trao đổi trực tiếp với bác sĩ.")).isFalse();
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "Không nên tự ý ngừng thuốc; hãy hỏi bác sĩ.")).isFalse();
        // Bare claims in force.
        assertThat(ChatMedicalSafety.containsUnsafeClaim("Chẩn đoán là viêm phổi")).isTrue();
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "bạn bị viêm phổi, chẩn đoán là nhiễm trùng")).isTrue();
        assertThat(ChatMedicalSafety.containsUnsafeClaim("Kê đơn thuốc giảm đau cho bạn")).isTrue();
        assertThat(ChatMedicalSafety.containsUnsafeClaim("You should take 500 mg")).isTrue();
        // A contrastive word after the refusal frame puts the claim in force,
        // and a new sentence after ';' starts clean.
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "Tôi không, nhưng tôi vẫn chẩn đoán là cúm")).isTrue();
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "Tôi không kê đơn; chẩn đoán là cúm mùa")).isTrue();
        // Punctuation-only segments must not crash the sentence loop.
        assertThat(ChatMedicalSafety.containsUnsafeClaim(
            "!!! ... ??? --- Nói lại đi")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "Khong can lo lang, uong 2 vien moi ngay",
        "Khong can lo lang, chan doan la cum",
        "Khong ke don, uong 2 vien moi ngay",
        "Khong ke don, chan doan la cum",
        "I do not worry, you should take 500 mg"
    })
    void unrelatedNegationDoesNotExcuseALaterClinicalClaim(String answer) {
        assertThat(ChatMedicalSafety.containsUnsafeClaim(answer)).isTrue();
        assertThatThrownBy(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe(answer))
            .isInstanceOf(BusinessException.class)
            .extracting(error -> ((BusinessException) error).getCode())
            .isEqualTo("CHAT_CONTENT_BLOCKED");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "Why not prescribe aspirin?",
        "Why not stop medication?",
        "Why not take 500 mg?",
        "Do not stop medication, prescribe aspirin instead.",
        "I do not prescribe, stop medication now.",
        "Khong ke don, hay ngung thuoc ngay."
    })
    void rhetoricalOrAffirmativeRecommendationsAreNotClinicalRefusals(String answer) {
        assertThat(ChatMedicalSafety.containsUnsafeClaim(answer)).isTrue();
        assertThatThrownBy(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe(answer))
            .isInstanceOf(BusinessException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "Khong tu y uong 2 vien moi ngay, hay hoi bac si.",
        "Toi khong the chan doan, ke don hoac ngung thuoc.",
        "Do not stop medication without advice from your doctor.",
        "I cannot provide a prescription.",
        "I cannot provide any prescription.",
        "I do not prescribe medication.",
        "Do not take 500 mg without advice from your doctor."
    })
    void genuineClinicalRefusalsRemainAllowed(String answer) {
        assertThat(ChatMedicalSafety.containsUnsafeClaim(answer)).isFalse();
        assertThatCode(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe(answer))
            .doesNotThrowAnyException();
    }

    @Test
    void chunkConcatenationEqualsPersistedAnswer() {
        String answer = "Thong tin tham khao. Ban co the dat lich kham tai catalog.";
        assertThat(String.join("", ChatAnswerChunker.slices(answer, 7))).isEqualTo(answer);
        assertThat(ChatAnswerChunker.slices("")).isEmpty();
    }

    @Test
    void protectedInputCueDoesNotConfuseWhereQuestionsWithPain() {
        // "ở đâu" (where) normalizes to the same token as "đau" (pain); only
        // the pain reading may trip the clinical handoff.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Bệnh viện có cơ sở 2 ở đâu?"))
            .as("location questions are not clinical concerns")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Cho hỏi bệnh viện ở đâu?"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau ở đâu"))
            .as("pain phrasing stays protected")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Tôi đau đầu kéo dài 3 ngày"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau bụng"))
            .isTrue();
    }

    @Test
    void protectedInputCueDoesNotConfuseBelongingWithMedicine() {
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Bệnh viện thuộc khoa nào?"))
            .as("belonging phrasing is not a medication concern")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Khoa này thuộc cơ sở nào"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Tôi đang uống thuốc, có ổn không"))
            .as("medication mentions stay protected")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("nhà thuốc gần đây"))
            .as("a pharmacy storefront is a facility, not a medication mention")
            .isFalse();
        // Real medication phrasing must stay protected — the belong-to
        // exclusion may only cover facility readings of "thuộc".
        assertThat(ChatMedicalSafety.containsProtectedInputCue("uống thuốc hệ thống"))
            .as("systemic therapy is a medication statement")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("thuốc nhóm kháng sinh"))
            .as("a drug class is a medication statement")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("thuốc bôi bộ phận"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("mua thuốc bệnh viện kê"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("gian hàng thuốc"))
            .as("a drug stall is still a facility")
            .isFalse();
    }

    @Test
    void protectedInputCueDoesNotConfuseParkingWithPain() {
        // "đậu" (to park) normalizes to the same token as "đau" (pain);
        // only the pain reading may trip the clinical handoff.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Bãi đậu xe ở đâu?"))
            .as("parking questions are not clinical concerns")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Các cơ sở có bãi đậu xe không?"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Bãi đỗ xe ở đâu?"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Bệnh viện có chỗ đậu xe không?"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Nhà đậu xe nằm ở đâu?"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu ô tô ở đâu"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Tôi đau đầu kéo dài 3 ngày"))
            .as("pain phrasing stays protected")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau bụng"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xương khớp"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe đau đầu"))
            .as("a message mixing parking and pain keeps the clinical lane")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau do ngã"))
            .as("pain phrasing that mentions a cause stays protected")
            .isTrue();
        // Anchored lookbehind: the exclusion may only fire on standalone
        // facility words — any word merely ENDING in the same letters must
        // never smuggle a pain statement past the clinical gate.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Tôi có đau chân"))
            .as("'có đau' is the most idiomatic way to report pain")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("chỗ đau ở đâu"))
            .as("'chỗ đau' is a pain location, not a parking spot")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("nó đau quá"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("sao đau thế này"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("báo đau cho bác sĩ"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("thường đau đầu"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("vào đâu"))
            .as("location wording still reads as a place question")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("xe đậu ở đâu"))
            .as("word order does not matter for a parking question")
            .isFalse();
        // Duration wording: "mấy" is not a vehicle — the lookahead must not
        // exempt "đau mấy ngày" as if it were "đậu xe máy".
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau mấy ngày rồi"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau mấy hôm nay"))
            .isTrue();
        // Vehicle compounds: parking vocabulary stays unprotected even when
        // the qualifier collides with a body-part token ("tay"/"tai").
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe tay ga ở đâu"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe tải chỗ nào"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe đạp ở đâu"))
            .isFalse();
        // Tearing pain over compound body parts stays clinical.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xé bàn chân"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xé thắt lưng"))
            .isTrue();
        // "đau xé" (tearing pain) normalizes to "dau xe" — the vehicle
        // exemption must yield when a body part follows.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xé ngực"))
            .as("tearing chest pain is an emergency-adjacent symptom")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xé bụng"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xé lưng"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xé ngực dữ dội"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe dưới hầm ở đâu"))
            .as("basement parking is still a facility question")
            .isFalse();
        // Reversed-order parking ("xe đậu", "ô tô đỗ") reads as facility too,
        // but a vehicle prefix must never smuggle "đau <bộ phận>" through.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("ô tô đậu ở đâu"))
            .as("ô tô đậu is a parking question, not a pain cue")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("xe máy đậu ở đâu"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đi xe đau mông"))
            .as("'đau mông' after 'xe' is a pain report, not a parking spot")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đi xe đau lưng"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đi xe đau tim"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("xe đau nhức quá"))
            .isTrue();
        // Backtracking must not excuse "đau xe máy chân": once the compound
        // ends adjacent to a body part the pain reading wins.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đau xe máy chân"))
            .isTrue();
        // Particle homographs stay out of the body list — "đậu xe có/tại/đã"
        // are ordinary parking sentences, not neck/ear pain.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe có mất phí không"))
            .as("'có' is the verb have, not the body part cổ")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe tại đâu"))
            .as("'tại' is the preposition at, not the body part tai")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("đậu xe đã xong"))
            .isFalse();
    }

    @Test
    void protectedInputCueDoesNotConfuseFacilityWithMedicine() {
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Cơ sở có nhà thuốc không?"))
            .as("a pharmacy storefront is a facility, not a medication mention")
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("quầy thuốc ở đâu"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("cửa hàng thuốc gần đây"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("Tôi đang uống thuốc"))
            .as("medication mentions stay protected")
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("thuốc giảm đau"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("liều thuốc bao nhiêu"))
            .isTrue();
    }

    @Test
    void protectedCueHonoursJoinedLaundrySuppression() {
        // Wukong wave-12c CE2: the PROTECTED squash chain mirrors
        // CO_GIAT_SQUASHED_SUPPRESS — a joined laundry-for-person or
        // amenity-fee question is routing metadata, not clinical input, so
        // it must stay unprotected and reach the amenity lane.
        for (String joined : List.of(
            "cogiatchokhach",
            "cogiatdochokhach",
            "cogiatdothenao",
            "cogiatdomienphi",
            "cogiatdobaonhieutien",
            "cogiatuigiatien")) {
            assertThat(ChatMedicalSafety.containsProtectedInputCue(joined))
                .as("joined laundry phrasing stays unprotected: %s", joined)
                .isFalse();
        }
        // Non-laundry residues still read as convulsion and stay protected.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("cogiatlai"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("cogiatdobinga"))
            .isTrue();
        // Spaced laundry questions were never protected either.
        assertThat(ChatMedicalSafety.containsProtectedInputCue("có giặt đồ cho khách"))
            .isFalse();
    }

    @Test
    void ngatReversedAntecedentSuppressesInBothLanes() {
        // Wukong wave-12c CE5: "wifi bị ngắt" puts the interrupt-sense
        // antecedent before "ngắt" — both the protected and emergency lanes
        // suppress it the same way so connectivity questions still reach
        // amenity/navigation routing.
        for (String benign : List.of(
            "wifi bị ngắt",
            "mạng bị ngắt rồi",
            "điện đang bị ngắt",
            "kết nối hay bị ngắt")) {
            assertThat(ChatMedicalSafety.containsProtectedInputCue(benign))
                .as("reversed interrupt stays unprotected: %s", benign)
                .isFalse();
            assertThat(ChatMedicalSafety.containsEmergencyInputCue(benign))
                .as("reversed interrupt stays non-emergency: %s", benign)
                .isFalse();
        }
        // Clinical antecedents and dyspnea continuations are never
        // suppressed — "mạch" (pulse) and "thuốc" (medication) were dropped
        // from the reversed list on purpose.
        assertThat(ChatMedicalSafety.containsEmergencyInputCue("mạch bị ngắt"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsEmergencyInputCue("thuốc bị ngắt"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsEmergencyInputCue("wifi bị ngắt hơi"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsEmergencyInputCue("bệnh nhân bị ngất"))
            .isTrue();
        // A real crisis clause after the suppressed candidate still fires.
        assertThat(ChatMedicalSafety.containsEmergencyInputCue("wifi bị ngắt rồi muốn tự tử"))
            .isTrue();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("bệnh nhân bị ngất"))
            .isTrue();
    }

    @Test
    void ngatReversedSuppressionNeverHidesAPersonReport() {
        // Wukong wave-12c CE7: name-colliding nouns ("Quang", "Đoàn",
        // "Lợi") were dropped from the antecedent list, and a person
        // marker before a kept antecedent ("anh Điện") still blocks
        // suppression — faint reports always escalate.
        for (String report : List.of(
            "anh Quang bị ngất",
            "anh Quang ngất",
            "em Điện bị ngất",
            "ông Đoàn vừa bị ngất rồi",
            "Quang bị ngất",
            "wifi ngắt")) {
            assertThat(ChatMedicalSafety.containsEmergencyInputCue(report))
                .as("faint/interrupt ambiguity resolves toward crisis: %s", report)
                .isTrue();
        }
        // Wukong wave-12c CE8: joined "ngắt <benign>" stays quiet — the
        // extracted NGAT_CRISIS keeps its trailing word boundary.
        assertThat(ChatMedicalSafety.containsEmergencyInputCue("ngatketnoi"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsProtectedInputCue("ngatketnoi"))
            .isFalse();
        assertThat(ChatMedicalSafety.containsEmergencyInputCue("ngatmang"))
            .isFalse();
    }
}
