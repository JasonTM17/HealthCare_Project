package com.healthcare.ai;

import com.healthcare.ai.controller.PublicAiChatController;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.service.AiChatSourceResolver;
import com.healthcare.ai.service.AiService;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;

class PublicAiChatControllerTest {

    private static final String SPECIALTY_ID = "00000000-0000-0000-0000-000000000001";

    private AiChatSourceResolver resolverForSpecialty() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.revalidate(ChatMode.HOSPITAL_SUPPORT, "specialty", SPECIALTY_ID))
            .thenReturn(new AiChatSourceResolver.ResolvedSource(
                "specialty", SPECIALTY_ID, "Tim mạch", "tim-mach", true, true,
                "OPERATIONAL", null, null, null, null, "/specialties/tim-mach", "/dat-lich?specialtyId=" + SPECIALTY_ID));
        return resolver;
    }

    @Test
    void rejectsBrowserControlledModeAndUnknownFields() {
        ObjectMapper objectMapper = new ObjectMapper()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        assertThatThrownBy(() -> objectMapper.readValue(
            "{\"message\":\"Xin chào\",\"mode\":\"SYMPTOM_TRIAGE\"}",
            PublicAiChatController.PublicChatRequest.class))
            .isInstanceOf(Exception.class);

        assertThatThrownBy(() -> objectMapper.readValue(
            "{\"message\":\"Xin chào\",\"recent_turns\":[{\"role\":\"user\",\"content\":\"Chào\",\"provider\":\"remote\"}]}",
            PublicAiChatController.PublicChatRequest.class))
            .isInstanceOf(Exception.class);
    }

    @Test
    void forwardsStatelessHospitalSupportChatAndDropsUntrustedFields() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem danh sách chuyên khoa.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "recommended_specialty_id", "provider-id",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "untrusted provider title",
                "url", "https://provider.example"
            ))
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "  Chuyên khoa nào? ",
                List.of(new PublicAiChatController.PublicChatTurn("user", "Xin chào"))
            ))
            .getBody();

        assertThat(body)
            .containsEntry("answer", "Bạn có thể xem danh sách chuyên khoa.")
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "ANSWER")
            .doesNotContainKey("recommended_specialty_id")
            .containsEntry("citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch")));
        verify(aiService).chat(Map.of(
            "message", "Chuyên khoa nào?",
            "public_support_chat", true,
            "recent_turns", List.of(new PublicAiChatController.PublicChatTurn("user", "Xin chào"))
        ));
    }

    @Test
    void acceptsCompleteResponseWithNoCitations() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Được.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("provenance", "local_provider")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of());
        verify(aiService).chat(Map.of(
            "message", "Xin chào",
            "public_support_chat", true
        ));
    }

    @Test
    void acceptsInsufficientEvidenceResponseWithNoCitations() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời để tránh suy đoán.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("provenance", "local_provider")
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("citations", List.of());
    }

    @Test
    void propagatesAiServiceUnavailableAsBadGateway() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
            BAD_GATEWAY, "AI service is unavailable"));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void acceptsRemoteProviderWhenSanitized() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem danh sách chuyên khoa.",
            "provenance", "remote_provider",
            "mode", "HOSPITAL_SUPPORT",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "safety_action", "ANSWER",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null))
            .getBody();

        assertThat(body)
            .containsEntry("provenance", "remote_provider")
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of())
            .containsKey("answer");
    }

    @Test
    void failsClosedOnInvalidSafetyOrModeInsteadOfDefaultingToAnswer() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Không chắc.",
            "mode", "SYMPTOM_TRIAGE",
            "safety_action", "UNTRUSTED",
            "provenance", "local_provider",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void acceptsServerOwnedPrivacyRefusalWithoutExposingAnIdentifier() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Để bảo vệ quyền riêng tư, vui lòng không gửi email, số điện thoại, "
                + "mã đặt lịch, mã hồ sơ hoặc thông tin định danh.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "REFUSE",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Tôi cần xem hồ sơ bệnh nhân khác và email của họ", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "REFUSE")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("citations", List.of())
            .containsEntry("answer", "Để bảo vệ quyền riêng tư, vui lòng không gửi email, số điện thoại, "
                + "mã đặt lịch, mã hồ sơ hoặc thông tin định danh.");
    }

    @Test
    void rejectsAnIdentifierFollowingAnIdentityLabel() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Mã hồ sơ: MR-123456.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "REFUSE",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void rejectsAnAlphabeticIdentifierWhenExplicitlyDelimited() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Mã hồ sơ: ABC.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "REFUSE",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void rejectsMalformedOrUnresolvedCitationsInsteadOfDroppingThem() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem danh sách.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "article", "source_id", SPECIALTY_ID, "title", "Sai mode"))
        ));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }
}
