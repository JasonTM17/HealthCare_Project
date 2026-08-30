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
        assertThatCode(() -> ChatMedicalSafety.rejectDiagnoseOrPrescribe(
            "Ban co the xem chuyen khoa Than kinh va dat lich."))
            .doesNotThrowAnyException();
    }

    @Test
    void chunkConcatenationEqualsPersistedAnswer() {
        String answer = "Thong tin tham khao. Ban co the dat lich kham tai catalog.";
        assertThat(String.join("", ChatAnswerChunker.slices(answer, 7))).isEqualTo(answer);
        assertThat(ChatAnswerChunker.slices("")).isEmpty();
    }
}
