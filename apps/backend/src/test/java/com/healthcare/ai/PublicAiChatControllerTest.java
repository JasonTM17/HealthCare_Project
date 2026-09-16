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
    private static final String SECOND_SPECIALTY_ID = "00000000-0000-0000-0000-000000000002";
    private static final String BRANCH_ID = "00000000-0000-0000-0000-000000000003";

    private AiChatSourceResolver resolverForSpecialty() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.revalidate(ChatMode.HOSPITAL_SUPPORT, "specialty", SPECIALTY_ID))
            .thenReturn(new AiChatSourceResolver.ResolvedSource(
                "specialty", SPECIALTY_ID, "Tim mạch", "tim-mach", true, true,
                "OPERATIONAL", null, null, null, null, "/specialties/tim-mach", "/dat-lich?specialtyId=" + SPECIALTY_ID));
        when(resolver.actions(any())).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", "Tim mạch", "href", "/specialties/tim-mach"),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", "/dat-lich?specialtyId=" + SPECIALTY_ID)));
        return resolver;
    }

    private AiChatSourceResolver resolverForCatalog() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        AiChatSourceResolver.ResolvedSource specialty = new AiChatSourceResolver.ResolvedSource(
            "specialty", SPECIALTY_ID, "Tim mạch", "tim-mach", true, true,
            "OPERATIONAL", null, null, null, null, "/specialties/tim-mach",
            "/dat-lich?specialtyId=" + SPECIALTY_ID);
        AiChatSourceResolver.ResolvedSource branch = new AiChatSourceResolver.ResolvedSource(
            "branch", SECOND_SPECIALTY_ID, "Cơ sở 1", "co-so-1", true, true,
            "OPERATIONAL", null, null, null, null, "/branches/co-so-1",
            "/dat-lich?branchId=" + SECOND_SPECIALTY_ID);
        when(resolver.catalogOverview()).thenReturn(new AiChatSourceResolver.CatalogOverview(
            1, 1, List.of(specialty), List.of(branch)));
        when(resolver.citations(any())).thenReturn(List.of(
            Map.of("source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"),
            Map.of("source_type", "branch", "source_id", SECOND_SPECIALTY_ID, "title", "Cơ sở 1")));
        return resolver;
    }

    private AiChatSourceResolver resolverForBranch() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        AiChatSourceResolver.ResolvedSource branch = new AiChatSourceResolver.ResolvedSource(
            "branch", BRANCH_ID, "Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3", "co-so-2-quan-3",
            true, true, "OPERATIONAL", null, null, null, null,
            "/branches/co-so-2-quan-3", "/dat-lich?branchId=" + BRANCH_ID);
        when(resolver.branchDetails(any())).thenReturn(List.of(
            new AiChatSourceResolver.BranchDetails(
                branch,
                "2 Đường số 3, Quận 3, TP. Hồ Chí Minh",
                "06:30–20:00, tất cả các ngày")));
        when(resolver.citations(List.of(branch))).thenReturn(List.of(
            Map.of("source_type", "branch", "source_id", BRANCH_ID,
                "title", branch.title())));
        when(resolver.actions(List.of(branch))).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", branch.title(), "href", branch.viewHref()),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", branch.bookingHref())));
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
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch")))
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "VIEW_SOURCE", "label", "Tim mạch", "href", "/specialties/tim-mach"),
                Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", "/dat-lich?specialtyId=" + SPECIALTY_ID)));
        verify(aiService).chat(Map.of(
            "message", "Chuyên khoa nào?",
            "public_support_chat", true,
            "recent_turns", List.of(Map.of("role", "user", "content", "Xin chào"))
        ));
    }

    @Test
    void rejectsAnswerWithNoVerifiedCitations() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Được.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
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
            .containsEntry("citations", List.of())
            .containsKey("suggested_actions");
    }

    @Test
    void replacesInsufficientPublicCatalogAnswerWithLiveSpringOverview() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời để tránh suy đoán.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_fallback",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForCatalog())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bệnh viện có những chuyên khoa và cơ sở nào?", null))
            .getBody();

        assertThat(body)
            .containsEntry("answer", "Hiện HealthCare có 1 chuyên khoa và 1 cơ sở đang hoạt động theo dữ liệu đang hoạt động. Một số chuyên khoa: Tim mạch. Một số cơ sở: Cơ sở 1. Bạn có thể mở các mục bên dưới để xem thông tin chi tiết và đặt lịch.")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of(
                Map.of("source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"),
                Map.of("source_type", "branch", "source_id", SECOND_SPECIALTY_ID, "title", "Cơ sở 1")));
    }

    @Test
    void answersCatalogNavigationWhenAiServiceIsTemporarilyUnavailable() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
            BAD_GATEWAY, "AI service is unavailable"));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForCatalog())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bệnh viện có chuyên khoa nào?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsKey("citations")
            .containsKey("suggested_actions");
    }

    @Test
    void answersUniqueBranchHoursFromLiveCatalogDuringRagFallback() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời để tránh suy đoán.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_fallback",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForBranch())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cơ sở số 2 ở Quận 3 làm việc đến mấy giờ?", null))
            .getBody();

        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of(Map.of(
                "source_type", "branch", "source_id", BRANCH_ID,
                "title", "Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3")))
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "VIEW_SOURCE", "label", "Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3",
                    "href", "/branches/co-so-2-quan-3"),
                Map.of("kind", "START_BOOKING", "label", "Đặt lịch",
                    "href", "/dat-lich?branchId=" + BRANCH_ID)));
        assertThat((String) body.get("answer"))
            .contains("2 Đường số 3, Quận 3, TP. Hồ Chí Minh")
            .contains("06:30–20:00, tất cả các ngày");
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
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "provider title"))
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào", null))
            .getBody();

        assertThat(body)
            .containsEntry("provenance", "remote_provider")
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch")))
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
            .containsEntry("suggested_actions", List.of())
            .containsEntry("answer", "Để bảo vệ quyền riêng tư, vui lòng không gửi email, số điện thoại, "
                + "mã đặt lịch, mã hồ sơ hoặc thông tin định danh.");
    }

    @Test
    void emitsEmergencyCallActionWithoutCatalogNavigation() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Gọi cấp cứu ngay.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "EMERGENCY",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Tôi khó thở", null))
            .getBody();

        assertThat(body).containsEntry("suggested_actions", List.of(
            Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
    }

    @Test
    void emitsSymptomGuidanceFallbackActionsWhenNoCitationIsAvailable() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời để tránh suy đoán.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Tôi bị đau đầu kéo dài, nên khám chuyên khoa nào?", null))
            .getBody();

        assertThat(body).containsEntry("suggested_actions", List.of(
            Map.of("kind", "VIEW_SOURCE", "label", "Xem Chuyên khoa", "href", "/specialties"),
            Map.of("kind", "VIEW_SOURCE", "label", "Xem Bác sĩ", "href", "/doctors"),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch khám", "href", "/dat-lich")));
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

    @Test
    void rejectsAllowedCitationWhenCatalogSourceCannotBeResolved() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Khoa Tim mạch làm việc từ 7h đến 17h.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"))
        ));
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Giờ làm việc khoa Tim mạch?", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void rejectsAllowedCitationWhenCatalogRevalidationFails() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Khoa Tim mạch làm việc từ 7h đến 17h.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"))
        ));
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.revalidate(ChatMode.HOSPITAL_SUPPORT, "specialty", SPECIALTY_ID))
            .thenThrow(new IllegalStateException("catalog unavailable"));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Giờ làm việc khoa Tim mạch?", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void rejectsEntireAnswerWhenAnyOfMultipleCitationsCannotBeResolved() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bệnh viện có hai chuyên khoa phù hợp.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(
                Map.of("source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"),
                Map.of("source_type", "specialty", "source_id", SECOND_SPECIALTY_ID, "title", "Nội tổng quát")
            )
        ));
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.revalidate(ChatMode.HOSPITAL_SUPPORT, "specialty", SPECIALTY_ID))
            .thenReturn(new AiChatSourceResolver.ResolvedSource(
                "specialty", SPECIALTY_ID, "Tim mạch", "tim-mach", true, true,
                "OPERATIONAL", null, null, null, null, "/specialties/tim-mach",
                "/dat-lich?specialtyId=" + SPECIALTY_ID));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Bệnh viện có chuyên khoa nào?", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void supportsMultiTurnConversationWithMultipleTurns() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Khoa Tim mạch làm việc từ 7h đến 17h.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"))
        ));

        PublicAiChatController.PublicChatRequest request = new PublicAiChatController.PublicChatRequest(
            "Giờ làm việc khoa Tim mạch?",
            List.of(
                new PublicAiChatController.PublicChatTurn("user", "Xin chào"),
                new PublicAiChatController.PublicChatTurn("assistant", "Chào bạn, tôi có thể giúp gì?"),
                new PublicAiChatController.PublicChatTurn("user", "Bệnh viện có khoa tim mạch không?")
            )
        );

        Map<String, Object> response = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(request)
            .getBody();

        assertThat(response).containsEntry("answer", "Khoa Tim mạch làm việc từ 7h đến 17h.");
        verify(aiService).chat(Map.of(
            "message", "Giờ làm việc khoa Tim mạch?",
            "public_support_chat", true,
            "recent_turns", List.of(
                Map.of("role", "user", "content", "Xin chào"),
                Map.of("role", "assistant", "content", "Chào bạn, tôi có thể giúp gì?"),
                Map.of("role", "user", "content", "Bệnh viện có khoa tim mạch không?")
            )
        ));
    }
}
