package com.healthcare.ai.chat;

import com.healthcare.ai.chat.service.ChatAnswerChunker;
import com.healthcare.ai.chat.service.ChatMedicalSafety;
import com.healthcare.exception.BusinessException;
import org.junit.jupiter.api.Test;

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
            .isTrue();
    }
}
