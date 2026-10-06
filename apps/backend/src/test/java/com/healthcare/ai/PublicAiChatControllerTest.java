package com.healthcare.ai;

import com.healthcare.ai.controller.PublicAiChatController;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.service.AiChatSourceResolver;
import com.healthcare.ai.chat.service.ChatSuggestedActionResolver;
import com.healthcare.ai.service.AiService;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

class PublicAiChatControllerTest {

    private static final String SPECIALTY_ID = "00000000-0000-0000-0000-000000000001";
    private static final String SECOND_SPECIALTY_ID = "00000000-0000-0000-0000-000000000002";
    private static final String BRANCH_ID = "00000000-0000-0000-0000-000000000003";
    private static final String ARTICLE_ID = "00000000-0000-0000-0000-000000000004";

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

    private AiChatSourceResolver resolverForLiveBranchList() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        AiChatSourceResolver.ResolvedSource branchOne = new AiChatSourceResolver.ResolvedSource(
            "branch", BRANCH_ID, "Cơ sở 1 — Quận 1", "co-so-1", true, true,
            "OPERATIONAL", null, null, null, null, "/branches/co-so-1",
            "/dat-lich?branchId=" + BRANCH_ID);
        AiChatSourceResolver.ResolvedSource branchTwo = new AiChatSourceResolver.ResolvedSource(
            "branch", SECOND_SPECIALTY_ID, "Cơ sở 2 — Quận 3", "co-so-2", true, true,
            "OPERATIONAL", null, null, null, null, "/branches/co-so-2",
            "/dat-lich?branchId=" + SECOND_SPECIALTY_ID);
        when(resolver.branchDetails(any())).thenReturn(List.of());
        when(resolver.catalogOverview()).thenReturn(AiChatSourceResolver.CatalogOverview.empty());
        when(resolver.activeBranchOverview(anyInt())).thenReturn(List.of(
            new AiChatSourceResolver.BranchDetails(
                branchOne, "12 Nguyễn Huệ, Quận 1", "07:00–19:00", null, List.of()),
            new AiChatSourceResolver.BranchDetails(
                branchTwo, "2 Đường số 3, Quận 3", "06:30–20:00", null, List.of())));
        when(resolver.citations(any())).thenReturn(List.of(
            Map.of("source_type", "branch", "source_id", BRANCH_ID, "title", branchOne.title()),
            Map.of("source_type", "branch", "source_id", SECOND_SPECIALTY_ID, "title", branchTwo.title())));
        when(resolver.actions(any())).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", branchOne.title(), "href", branchOne.viewHref()),
            Map.of("kind", "VIEW_SOURCE", "label", branchTwo.title(), "href", branchTwo.viewHref())));
        return resolver;
    }

    private AiChatSourceResolver resolverForLiveDoctorList() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        AiChatSourceResolver.ResolvedSource doctor = new AiChatSourceResolver.ResolvedSource(
            "doctor", "00000000-0000-0000-0000-000000000005", "BS Nguyễn Văn A — Da liễu",
            "bac-si-a", true, true, "OPERATIONAL", null, null, null, null,
            "/doctors/bac-si-a", "/dat-lich?doctorId=00000000-0000-0000-0000-000000000005");
        when(resolver.activeDoctorOverview(anyInt(), any())).thenReturn(List.of(doctor));
        when(resolver.citations(any())).thenReturn(List.of(
            Map.of("source_type", "doctor", "source_id", doctor.id(), "title", doctor.title())));
        when(resolver.actions(any())).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", doctor.title(), "href", doctor.viewHref()),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", doctor.bookingHref())));
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
                "06:30–20:00, tất cả các ngày",
                "028 38000002",
                List.of())));
        when(resolver.revalidate(ChatMode.HOSPITAL_SUPPORT, "branch", BRANCH_ID))
            .thenReturn(branch);
        when(resolver.citations(List.of(branch))).thenReturn(List.of(
            Map.of("source_type", "branch", "source_id", BRANCH_ID,
                "title", branch.title())));
        when(resolver.actions(List.of(branch))).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", branch.title(), "href", branch.viewHref()),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", branch.bookingHref())));
        return resolver;
    }

    private AiChatSourceResolver resolverForArticle() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        AiChatSourceResolver.ResolvedSource article = new AiChatSourceResolver.ResolvedSource(
            "article", ARTICLE_ID, "Hướng dẫn tự đo huyết áp tại nhà đúng cách",
            "huong-dan-tu-do-huyet-ap", true, true, "CLINICAL", 1L, 1L,
            "a".repeat(64), "1", "/articles/huong-dan-tu-do-huyet-ap", null);
        when(resolver.revalidate(ChatMode.HEALTH_EDUCATION, "article", ARTICLE_ID))
            .thenReturn(article);
        when(resolver.actions(any())).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", article.title(), "href", article.viewHref())));
        when(resolver.authorize(eq(ChatMode.HEALTH_EDUCATION), any())).thenReturn(List.of(article));
        when(resolver.authorizedPayload(any())).thenReturn(List.of(
            Map.of(
                "source_type", "article",
                "source_id", ARTICLE_ID,
                "projection_kind", "CLINICAL",
                "content_revision", 1L,
                "eligibility_revision", 1L,
                "content_hash", "a".repeat(64),
                "approval_id", "1")));
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
                "  Cho mình hỏi thông tin bệnh viện ",
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
            "message", "Cho mình hỏi thông tin bệnh viện",
            "public_support_chat", true,
            "mode", "HOSPITAL_SUPPORT",
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

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null))
            .getBody();

        // The unverified model text never reaches the browser, but a safe
        // hospital-support intent still gets server-owned navigation copy
        // instead of a 502 dead end.
        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_uncited_remote_answer");
        assertThat((String) body.get("answer")).doesNotContain("Được.");
    }

    @Test
    void degradesUngroundedPackageAnswerToHonestGuidance() {
        // A generic preparation question is answered deterministically, so a
        // source-dependent PACKAGE question exercises the same ungrounded-
        // remote-answer suppression the preparation variant once covered.
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Gói tổng quát bắt buộc nhịn ăn 12 giờ trước buổi khám.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Gói khám tổng quát gồm những gì?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("citations", List.of())
            .containsEntry("routingReason", "public_missing_verified_source")
            .containsEntry("suggested_actions", ChatSuggestedActionResolver.hospitalSupportFallback(
                "Gói khám tổng quát gồm những gì?"));
        assertThat((String) body.get("answer")).doesNotContain("12 giờ");
    }

    @Test
    void degradesUnavailableAiForPackageQuestionToHonestGuidance() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "AI service has no verified context"));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Gói khám tổng quát gồm những gì?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("citations", List.of())
            .containsEntry("routingReason", "public_ai_unavailable")
            .containsEntry("suggested_actions", ChatSuggestedActionResolver.hospitalSupportFallback(
                "Gói khám tổng quát gồm những gì?"));
        assertThat((String) body.get("answer")).contains("tạm thời gián đoạn")
            .doesNotContain("chưa có nguồn đã xác thực");
    }

    @Test
    void rejectsMalformedPackagePayloadInsteadOfClaimingAiUnavailable() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Hãy nhịn ăn 12 giờ trước buổi khám.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Gói khám tổng quát gồm những gì?", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
    }

    @Test
    void answersBookingQuestionDeterministicallyWithoutProvider() {
        // Booking how-to is server-owned navigation copy: no provider
        // round-trip can improve it, so the deterministic lane answers
        // instantly and never spends provider budget.
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Tôi cần chuẩn bị gì trước khi đặt lịch?", null))
            .getBody();

        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of())
            .containsEntry("routingReason", "public_support_shortcut")
            .containsEntry("answer",
                "Bạn có thể bắt đầu tại trang Đặt lịch khám: chọn chuyên khoa hoặc bác sĩ, "
                    + "sau đó chọn cơ sở và khung giờ còn trống. Nếu chưa biết nên bắt đầu từ đâu, "
                    + "hãy mở danh sách Chuyên khoa.");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersBroadBranchQuestionFromLiveCatalogWithoutProvider() {
        // "chi nhánh ở đâu" is a broad BRANCH question: no specific branch to
        // resolve, so the deterministic lane must answer from the live
        // branch overview instead of falling through to the provider.
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForLiveBranchList())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bệnh viện có chi nhánh ở đâu?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_support_shortcut");
        assertThat((String) body.get("answer"))
            .contains("các cơ sở sau")
            .contains("Cơ sở 1 — Quận 1");
        verify(aiService, never()).chat(any());
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("provenance", "local_provider")
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("citations", List.of())
            .containsKey("suggested_actions");
    }

    @Test
    void replacesUnverifiedPreparationFallbackEvenWhenAiLabelsItInsufficient() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn phải nhịn ăn 12 giờ trước xét nghiệm máu.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_fallback",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Gói khám tổng quát có bao gồm xét nghiệm máu không?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_missing_verified_source")
            .containsEntry("citations", List.of());
        assertThat((String) body.get("answer")).doesNotContain("12 giờ");
    }

    @Test
    void doesNotClaimMissingSourceWhenInsufficientPackageHasVerifiedCitation() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Gói này bắt buộc nhịn ăn 12 giờ trước buổi khám.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"))
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Gói khám tổng quát gồm những gì?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("routingReason", "public_insufficient_evidence")
            .containsEntry("citations", List.of());
        assertThat((String) body.get("answer")).doesNotContain("12 giờ");
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
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersCatalogNavigationWithoutProvider() {
        // Broad catalog questions resolve from the live catalog overview
        // deterministically — the provider is never consulted, so the answer
        // is identical whether or not the AI service is reachable.
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
            .containsEntry("routingReason", "public_catalog_fallback")
            .containsKey("citations")
            .containsKey("suggested_actions");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersDoctorListQuestionFromLiveCatalogWithoutProvider() {
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForLiveDoctorList())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cho xem danh sách bác sĩ", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_support_shortcut")
            .containsEntry("citations", List.of(
                Map.of("source_type", "doctor",
                    "source_id", "00000000-0000-0000-0000-000000000005",
                    "title", "BS Nguyễn Văn A — Da liễu")));
        assertThat((String) body.get("answer")).contains("BS Nguyễn Văn A");
        verify(aiService, never()).chat(any());
    }

    @Test
    void catalogQuestionWithEmptyCatalogFallsToStaticNavigationCopy() {
        // An empty catalog cannot compose a live list — the lane degrades
        // to the same static copy instead of erroring or calling the
        // provider for a source-dependent question.
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.catalogOverview()).thenReturn(AiChatSourceResolver.CatalogOverview.empty());

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bệnh viện có chuyên khoa nào?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_support_shortcut")
            .containsEntry("answer",
                "Bạn muốn tra cứu mục nào? Hãy chọn Chuyên khoa, Bác sĩ hoặc Cơ sở & giờ làm việc "
                    + "bên dưới để xem thông tin chính thức của HealthCare.");
        verify(aiService, never()).chat(any());
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
    void resolvesAmbiguousBranchIdentityBeforeCallingPublicRag() {
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        AiChatSourceResolver.ResolvedSource district3 = new AiChatSourceResolver.ResolvedSource(
            "branch", BRANCH_ID, "Bệnh viện Đa khoa HealthCare — Cơ sở 2 — Quận 3", "co-so-2-quan-3",
            true, true, "OPERATIONAL", null, null, null, null,
            "/branches/co-so-2-quan-3", "/dat-lich?branchId=" + BRANCH_ID);
        AiChatSourceResolver.ResolvedSource district7 = new AiChatSourceResolver.ResolvedSource(
            "branch", "00000000-0000-0000-0000-000000000004",
            "Bệnh viện Đa khoa HealthCare — Cơ sở 2, Quận 7", "co-so-2-quan-7",
            true, true, "OPERATIONAL", null, null, null, null,
            "/branches/co-so-2-quan-7", "/dat-lich?branchId=00000000-0000-0000-0000-000000000004");
        when(resolver.isSpecificBranchQuery(any())).thenReturn(true);
        when(resolver.branchDetails(any())).thenReturn(List.of(
            new AiChatSourceResolver.BranchDetails(
                district3, "2 Đường số 3, Quận 3", "06:30–20:00", null, List.of()),
            new AiChatSourceResolver.BranchDetails(
                district7, "105 Nguyễn Văn Linh, Quận 7", null, null, List.of())));
        when(resolver.citations(any())).thenReturn(List.of(
            Map.of("source_type", "branch", "source_id", BRANCH_ID, "title", district3.title()),
            Map.of("source_type", "branch", "source_id", district7.id(), "title", district7.title())));
        when(resolver.actions(any())).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", district3.title(), "href", district3.viewHref()),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", district3.bookingHref()),
            Map.of("kind", "VIEW_SOURCE", "label", district7.title(), "href", district7.viewHref())));

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cơ sở số 2 có giờ hoạt động thế nào?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("citations", List.of(
                Map.of("source_type", "branch", "source_id", BRANCH_ID, "title", district3.title()),
                Map.of("source_type", "branch", "source_id", district7.id(), "title", district7.title())))
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "VIEW_SOURCE", "label", district3.title(), "href", district3.viewHref()),
                Map.of("kind", "VIEW_SOURCE", "label", district7.title(), "href", district7.viewHref())));
        assertThat((String) body.get("answer"))
            .contains("Cơ sở 2 — Quận 3", "Cơ sở 2, Quận 7")
            .contains("cho mình biết quận/thành phố")
            .doesNotContain("Cơ sở 13");
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void namedButUnresolvableBranchFollowUpFailsClosedWithoutBorrowingHistory() {
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        // The current message names an explicit branch that the catalog
        // cannot resolve; history contains a different, resolvable branch
        // that must never be substituted for it.
        when(resolver.hasBranchAttributeCue("Số điện thoại Cơ sở 99?")).thenReturn(true);
        when(resolver.isSpecificBranchQuery("Số điện thoại Cơ sở 99?")).thenReturn(true);
        when(resolver.branchDetails("Số điện thoại Cơ sở 99?")).thenReturn(List.of());
        when(resolver.latestSpecificBranchUserTurn(any())).thenReturn("Cơ sở 17 ở đâu?");

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Số điện thoại Cơ sở 99?",
                List.of(new PublicAiChatController.PublicChatTurn("user", "Cơ sở 17 ở đâu?"))))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("routingReason", "public_branch_unavailable");
        assertThat((String) body.get("answer"))
            .contains("chưa thể xác minh cơ sở")
            .doesNotContain("38000017", "Cơ sở 17");
        verify(resolver, never()).branchDetails("Cơ sở 17 ở đâu?");
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void anonymousBranchFollowUpResolvesReferentFromUserTurns() {
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver.ResolvedSource branch17 = new AiChatSourceResolver.ResolvedSource(
            "branch", "00000000-0000-0000-0000-000000000017",
            "Bệnh viện Đa khoa HealthCare — Cơ sở 17", "co-so-17",
            true, true, "OPERATIONAL", null, null, null, null,
            "/branches/co-so-17", "/dat-lich?branchId=00000000-0000-0000-0000-000000000017");
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.hasBranchAttributeCue("Còn số điện thoại thì sao?")).thenReturn(true);
        when(resolver.latestSpecificBranchUserTurn(any())).thenReturn("Cơ sở 17 ở đâu?");
        when(resolver.branchDetails("Cơ sở 17 ở đâu?")).thenReturn(List.of(
            new AiChatSourceResolver.BranchDetails(
                branch17, "17 Đường Số 17, Quận Bình Tân", "06:30–20:00", "028 38000017",
                List.of())));
        when(resolver.citations(List.of(branch17))).thenReturn(List.of(
            Map.of("source_type", "branch", "source_id", branch17.id(), "title", branch17.title())));
        when(resolver.actions(List.of(branch17))).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", branch17.title(), "href", branch17.viewHref())));

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Còn số điện thoại thì sao?",
                List.of(
                    new PublicAiChatController.PublicChatTurn("user", "Cơ sở 17 ở đâu?"),
                    new PublicAiChatController.PublicChatTurn(
                        "assistant", "Theo dữ liệu cơ sở đang hoạt động."))))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback");
        assertThat((String) body.get("answer"))
            .contains("Cơ sở 17")
            .contains("Điện thoại: 028 38000017");
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void doesNotLetBranchShortcutBypassClinicalSafety() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Triệu chứng bạn mô tả có thể cần được đánh giá khẩn cấp. Hãy gọi 115.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "EMERGENCY",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForBranch())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cơ sở số 2, tôi đau ngực dữ dội", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void doesNotLetMixedStrokeBranchQueryReturnBranchActions() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Triệu chứng có thể cần được đánh giá khẩn cấp. Hãy gọi 115.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "EMERGENCY",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));
        AiChatSourceResolver resolver = resolverForBranch();
        when(resolver.isSpecificBranchQuery(any())).thenReturn(true);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void failsClosedWhenSafetyServiceIsUnavailableForMixedStrokeBranchQuery() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
            BAD_GATEWAY, "AI service is unavailable"));
        AiChatSourceResolver resolver = resolverForBranch();
        when(resolver.isSpecificBranchQuery(any())).thenReturn(true);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void doesNotLetPunctuationSeparatedStrokeBranchQueryReturnBranchActions() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Triệu chứng có thể cần được đánh giá khẩn cấp. Hãy gọi 115.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "EMERGENCY",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));
        AiChatSourceResolver resolver = resolverForBranch();
        when(resolver.isSpecificBranchQuery(any())).thenReturn(true);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 dot-quy", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void doesNotLetHeartAttackBranchQueryReturnBranchActions() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Hãy gọi 115 ngay.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "EMERGENCY",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));
        AiChatSourceResolver resolver = resolverForBranch();
        when(resolver.isSpecificBranchQuery(any())).thenReturn(true);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 heart attack", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void doesNotTreatBenignFoldedPhrasesAsEmergency() {
        // Precision guard for the crisis lexicon: diacritic folding makes
        // "từ từ" (slowly) → "tu tu" and "có giặt" (laundry) → "co giat",
        // so the bare words must not be enough to trigger 115 guidance —
        // the volition marker / laundry exclusion has to hold.
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem danh sách chuyên khoa.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "Tim mạch"))
        ));

        for (String message : List.of(
            "tôi sẽ đi từ từ đến bệnh viện",
            "có giặt ủi ở đây không",
            "có giặt đồ không nhỉ",
            // Clause-final and laundry-closing "đồ" shapes stay benign.
            "phòng khám có giặt đồ",
            "phòng khám có giặt đồ ở đâu",
            "phòng khám có giặt đồ!",
            // "nghỉ ngơi từ từ" (rest slowly) must not read as "nghĩ ... tự tử".
            "tôi cần nghỉ ngơi từ từ",
            // Joined benign opening: "từ từ thôi" — not "tự tử".
            "tututhoi nhe bac si",
            // Fully-laundry squash chains stay quiet (wave-11 full-match).
            "cogiatdokhong",
            "cogiatuikhong",
            "cogiatdo",
            // Wukong FP-A: a volition marker directly before accented
            // "từ từ" (slowly) is benign — the grave accent distinguishes
            // it from "tự tử". Before the pre-fold mask these all fired.
            "sẽ từ từ đi bộ",
            "tôi đang từ từ hồi phục",
            "đang từ từ",
            "sắp từ từ quay lại nhé",
            "em sẽ từ từ làm quen",
            // Wukong wave-12 F3: partially-spaced laundry squash — the
            // squash stream still consumes the particle chain, matching
            // the ai-service verdict (was over-firing on the per-token
            // lookahead before the squash pass owned "cogiat").
            "cogiat do khong",
            "dangcogiat do khong",
            // W2-E: "ngắt" (interrupt) folds onto "ngất" (faint) — benign
            // continuations keep connectivity/electrical/speech questions
            // out of the emergency lane.
            "ngắt kết nối wifi",
            "ngắt mạch điện",
            "ngắt lời",
            "ngắt hạn",
            "ngat ket noi wifi",
            "ngat mang",
            "bị ngắt wifi",
            // W2-E: laundry-for-person / amenity-question continuations of
            // "có giặt" stay quiet in spaced and squashed form.
            "có giặt đồ cho khách",
            "có giặt cho khách",
            "có giặt đồ cho bệnh nhân",
            "có giặt đồ thế nào",
            "có giặt đồ bao nhiêu tiền",
            "có giặt đồ miễn phí không",
            "cogiatdochokhach",
            "cogiatchokhach",
            // Wukong wave-12c CE5: reversed order — the interrupt-sense
            // antecedent precedes "ngắt" and the token is clause-final.
            "wifi bị ngắt",
            "mạng bị ngắt rồi",
            "điện đang bị ngắt",
            "kết nối hay bị ngắt",
            "wifi bị ngắt xong",
            "mạng hay bị ngắt lắm",
            // Squashed amenity price compounds keep suppressing after the
            // bare "tien" unit was removed (Wukong wave-12c CE4).
            "cogiatdobaonhieutien",
            "cogiatuigiatien",
            "cogiatuiphitien",
            // Wukong wave-12c CE8: joined "ngắt <benign>" typings stay
            // quiet — mid-token "ngat" has no word boundary on any engine.
            "ngatketnoi",
            "ngatmang",
            "ngatwifi")) {
            Map<String, Object> body = new PublicAiChatController(
                aiService, resolverForSpecialty())
                .chat(new PublicAiChatController.PublicChatRequest(message, null))
                .getBody();
            // Any non-crisis outcome is fine here — ANSWER or the protected
            // HUMAN_HANDOFF guardrail — as long as no 115 guidance fires.
            assertThat(body.get("safety_action"))
                .as("benign phrase must not short-circuit to EMERGENCY: %s", message)
                .isNotEqualTo("EMERGENCY");
            assertThat((List<Map<String, String>>) body.get("suggested_actions"))
                .noneMatch(action -> "CALL_EMERGENCY".equals(action.get("kind")));
        }
    }

    @Test
    void keepsVolitionMarkedSelfHarmAsEmergency() {
        // The positive side of the tightened lexicon: intent-marked and
        // unambiguous self-harm phrasings still short-circuit to 115.
        AiService aiService = mock(AiService.class);
        for (String message : List.of(
            "tôi muốn tự tử",
            "tôi định tự tử",
            "tôi đang nghĩ đến việc tự tử",
            "tôi nghĩ về tự tử nhiều",
            "tôi đang muốn chết",
            "tôi không muốn sống nữa",
            // Joined-syllable crisis typed at token start ("tự tử trôi").
            "tututroi buon qua",
            // "do" here is "because of", not laundry "đồ" — any causal
            // continuation keeps the alert, not just listed reason words.
            "bé co giật do sốt cao",
            "bé co giật do bị ngã",
            "co giat do di ung thuoc",
            "co giat do uong nham thuoc",
            "co giat do can benh",
            // Reason-capable words are not laundry tails (Wukong R1):
            // "do gì"/"do cho nó sốt" are because-of clauses.
            "con co giat do gi",
            "be co giat do cho no sot",
            // Joined squash crisis at the Java layer too (Wukong R2).
            "cogiatdobinga",
            // Squash heads must not prefix-suppress crisis words (wave-11):
            // "lai" (lại), "tainan" (tai nạn), "nhiem trung" (nhiễm trùng).
            "cogiatlai",
            "cogiatdotainan",
            "cogiatdonhiemtrung",
            // Wukong wave-12: mid-token "cogiat" (prefixed squash) — the
            // token-start lookbehind could not see "dangcogiat"; the
            // mid-token net keeps degraded-window parity with ai-service.
            "dangcogiat",
            "becogiat",
            // "ngất" (fainting) joined the emergency cue for degraded-window
            // parity with the BFF/ai-service lexicons (Wukong FN-2).
            "bé bị ngất",
            "be bi ngat",
            // ð (eth homoglyph) folds to d — "ðau ngực dữ dội" must not
            // evade the qualified chest-pain cue (Wukong FN-2 bonus).
            "ðau ngực dữ dội",
            // Unaccented "tu tu" is ambiguous between "từ từ"/"tự tử" —
            // ambiguity resolves toward crisis (fail-safe).
            "se tu tu",
            "dang tu tu",
            // Wukong wave-12 F1: masked "từ" tokens between the volition
            // anchor and the crisis phrase must not defeat the guard.
            "sẽ từ từ tự tử",
            "tôi định từ từ tự tử",
            "nghĩ đến việc từ từ tự tử",
            "sẽ từ từ rồi tự tử",
            // "từ vong" (grave-typo of "tử vong") keeps recall via the
            // masked-twin term.
            "từ vong",
            // Wukong wave-12 F2: joined typings the token-start net could
            // not see — the squash stream covers them like ai-service does.
            "dangtutu",
            "toimuontutu",
            "ngatxiu",
            "khotho",
            // Cross-token squash: "ta co giat" is invisible to a per-token
            // net but Python fires it; the squash pass keeps parity.
            "tacogiat",
            // W2-E: the benign-continuation suppression is clause-local —
            // a real crisis clause in the same message still escalates.
            "ngắt kết nối rồi muốn tự tử",
            // "ngắt hơi" (interrupted breathing) is dyspnea, not a benign
            // interrupt — it must keep firing.
            "bị ngắt hơi",
            // Bare "ngat" and genuine faint phrasings still escalate.
            "tôi bị ngất",
            "ngat xiu",
            "sap ngat",
            // "do tiền" reads as because-of-money, not a price question —
            // reason-capable continuations keep the fail-safe default.
            "co giat do tien",
            "cogiatdotient",
            // Wukong wave-12c CE4: joined "cogiatdotien" now aligns with
            // the spaced form — bare "tien" is not a laundry unit, and
            // "do tiền sử" (history) is a genuine convulsion lead-in.
            "cogiatdotien",
            "co giat do tien su dong kinh",
            // Wukong wave-12c CE5: reversed-order suppression stays
            // antecedent-local — clinical antecedents, breath
            // continuations and later crisis clauses still fire.
            "bệnh nhân bị ngất",
            "benh nhan bi ngat",
            "mạch bị ngắt",
            "thuốc bị ngắt",
            "wifi bị ngắt hơi",
            "wifi bị ngắt rồi muốn tự tử",
            // Wukong wave-12c CE7: name-colliding nouns and person-marked
            // antecedents can never suppress a faint report.
            "anh Quang bị ngất",
            "anh Quang ngất",
            "em Điện bị ngất",
            "ông Đoàn vừa bị ngất rồi",
            "Quang bị ngất",
            // Wukong wave-12c CE9: family-report terms also block the
            // suppression — "con Điện" is a child faint report.
            "con Điện bị ngất",
            "con trai Điện bị ngất",
            "cụ Mạng bị ngất",
            "cháu Điện bị ngất",
            "thằng Mạng bị ngất",
            "bà nội Mạng bị ngất",
            "đứa Điện bị ngất",
            "nhóc Điện bị ngất",
            // Wukong wave-12c CE10: compound person constructions — the
            // token directly before the antecedent is the marker.
            "đứa nhỏ Điện bị ngất",
            "con nhỏ Điện bị ngất",
            "người thân Điện bị ngất",
            "người bệnh Điện bị ngất",
            "người yêu Điện bị ngất",
            "dì Điện bị ngất",
            "mợ Mạng bị ngất",
            "con dâu Điện bị ngất",
            "con rể Điện bị ngất",
            "bà xã Điện bị ngất",
            "bà vợ Điện bị ngất",
            "chồng Điện bị ngất",
            "vợ Điện bị ngất",
            "anh chàng Điện bị ngất",
            "thanh niên Điện bị ngất",
            "trẻ Điện bị ngất",
            "ngài Điện bị ngất",
            // Team-Lead adjudication (Wukong round 5): cô/chị/già/là
            // promoted — top-frequency kinship reports outweigh the
            // loose-typing facilities phrases they used to protect.
            "cô Điện bị ngất",
            "chị Mạng bị ngất",
            "ông già Điện bị ngất",
            "bà già Mạng bị ngất",
            "tên là Điện bị ngất",
            "học sinh Điện bị ngất",
            "sinh viên Điện bị ngất",
            "nữ sinh Điện bị ngất",
            "y tá Điện bị ngất",
            "giáo sư Điện bị ngất",
            "khách Điện bị ngất",
            // Without passive "bị" the reversed shape is not safe to
            // suppress — fail-safe direction.
            "wifi ngắt")) {
            Map<String, Object> body = new PublicAiChatController(
                aiService, resolverForSpecialty())
                .chat(new PublicAiChatController.PublicChatRequest(message, null))
                .getBody();
            assertThat(body)
                .as("crisis phrase must short-circuit to EMERGENCY: %s", message)
                .containsEntry("safety_action", "EMERGENCY")
                .containsEntry("suggested_actions", List.of(
                    Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
        }
        verify(aiService, org.mockito.Mockito.never()).chat(any());
    }

    @Test
    void doesNotTurnProtectedInsufficientEvidenceIntoBranchFallback() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "provenance", "local_provider",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForBranch())
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
    }

    @Test
    void doesNotExposeBranchActionsForProtectedAnswerCitation() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể xem thông tin cơ sở.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "ANSWER",
            "provenance", "local_provider",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of(Map.of(
                "source_type", "branch", "source_id", BRANCH_ID, "title", "provider title"))
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForBranch())
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
    }

    @Test
    void doesNotLetProtectedAnswerWithoutCitationReachNavigationFallback() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Đặt lịch khám trực tuyến tại HealthCare.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "ANSWER",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForBranch())
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")))
            .doesNotContainEntry("routingReason", "public_navigation_fallback");
    }

    @Test
    void doesNotLetProtectedBookingQueryReachNavigationFallback() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể bắt đầu đặt lịch khám.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "ANSWER",
            "provenance", "local_fallback",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForBranch())
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke dat lich", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")))
            .doesNotContainEntry("routingReason", "public_navigation_fallback");
    }

    @Test
    void doesNotTurnProtectedBookingInsufficientEvidenceIntoBookingActions() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "provenance", "local_provider",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForBranch())
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke dat lich", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
    }

    @Test
    void doesNotReturnNavigationForGenericProtectedInsufficientEvidence() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Tôi chưa tìm thấy nguồn thông tin phù hợp và đã dừng trả lời.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "provenance", "local_provider",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("dau bung", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "HUMAN_HANDOFF")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "START_BOOKING", "label", "Đặt lịch khám", "href", "/dat-lich"),
                Map.of("kind", "CALL_HOTLINE", "label", "Gọi 028 1800 0001", "href", "tel:02818000001"),
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Chuyên khoa", "href", "/specialties")));
    }

    @Test
    void handsOffProtectedPreparationWhenAiReturnsInsufficientEvidence() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Hãy nhịn ăn 12 giờ trước khi khám.",
            "mode", "HOSPITAL_SUPPORT",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "provenance", "local_provider",
            "disclaimer", "Thông tin chỉ mang tính tham khảo.",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Tôi đau đầu, cần chuẩn bị gì trước khi khám?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "HUMAN_HANDOFF")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "START_BOOKING", "label", "Đặt lịch khám", "href", "/dat-lich"),
                Map.of("kind", "CALL_HOTLINE", "label", "Gọi 028 1800 0001", "href", "tel:02818000001"),
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Chuyên khoa", "href", "/specialties")));
        assertThat((String) body.get("answer")).doesNotContain("12 giờ");
    }

    @Test
    void emergencyEducationQueryCannotFallIntoArticleFallback() {
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForArticle())
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 stroke faq", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HEALTH_EDUCATION")
            .containsEntry("safety_action", "EMERGENCY")
            .containsEntry("suggested_actions", List.of(
                Map.of("kind", "CALL_EMERGENCY", "label", "Gọi 115", "href", "tel:115")));
        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
        verify(aiService, never()).chat(any());
    }

    @Test
    void keepsOperationalEmergencyContactQueryOnDeterministicBranchPath() {
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = resolverForBranch();
        when(resolver.isSpecificBranchQuery(any())).thenReturn(true);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("co so 2 emergency contact", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_branch_fallback");
        verify(aiService, never()).chat(any());
    }

    @Test
    void passesUncitedRemoteGuidanceThroughInsteadOfMaskingIt() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Uống đủ nước, nghỉ ngơi và theo dõi triệu chứng; nếu sốt cao kéo dài hãy đi khám.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "remote_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cảm cúm nên ăn gì cho nhanh khỏi?", null))
            .getBody();

        // The provider answer claims no catalog source; every content gate
        // has run, so masking it with navigation copy would discard a real
        // answer the visitor asked for.
        assertThat(body)
            .containsEntry("provenance", "remote_provider")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of());
        assertThat((String) body.get("answer")).contains("nghỉ ngơi");
    }

    @Test
    void answersGreetingInstantlyWithoutTheProvider() {
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Xin chào nhé", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_greeting_shortcut");
        assertThat((String) body.get("answer")).contains("Xin chào");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersIdentityQuestionInstantlyWithoutTheProvider() {
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Bạn là ai á", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_greeting_shortcut");
        assertThat((String) body.get("answer"))
            .contains("trợ lý thông tin sức khỏe của HealthCare");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersSafeIntentWithOwnedNavigationWhenAiServiceIsUnavailable() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
            SERVICE_UNAVAILABLE, "AI provider unavailable"));

        // Every hospital-support intent now has a server-owned degraded
        // response (navigation copy, catalog overview, or honest
        // source-unavailable guidance), so a provider outage no longer
        // dead-ends the assistant with a bare 502/503. Booking how-to is
        // deterministic, so the outage is never even observed.
        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("Đặt lịch khám như thế nào?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_support_shortcut");
        assertThat((String) body.get("answer")).contains("Đặt lịch khám");
        verify(aiService, never()).chat(any());
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null))
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
    void acceptsApprovedPublicEducationCitationOnlyInServerSelectedEducationMode() {
        AiService aiService = mock(AiService.class);
        when(aiService.retrieveChat(any())).thenReturn(Map.of(
            "mode", "HEALTH_EDUCATION",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "relevance_threshold", 0.45,
            "candidates", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID,
                "title", "untrusted candidate title", "score", 0.9,
                "projection_kind", "CLINICAL", "content_revision", 1L,
                "eligibility_revision", 1L, "content_hash", "a".repeat(64),
                "approval_id", "1"))));
        when(aiService.generateChat(any())).thenReturn(Map.of(
            "answer", "Bài viết hướng dẫn đo huyết áp tại nhà đã được kiểm duyệt.",
            "provenance", "local_provider",
            "mode", "HEALTH_EDUCATION",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "safety_action", "ANSWER",
            "citations", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID,
                "title", "tiêu đề do AI gửi không được tin cậy")),
            "used_sources", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID,
                "projection_kind", "CLINICAL", "content_revision", 1L,
                "eligibility_revision", 1L, "content_hash", "a".repeat(64),
                "approval_id", "1"))
        ));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForArticle())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bài viết nào hướng dẫn đo huyết áp?", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HEALTH_EDUCATION")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("citations", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID,
                "title", "Hướng dẫn tự đo huyết áp tại nhà đúng cách")))
            .containsEntry("suggested_actions", List.of(Map.of(
                "kind", "VIEW_SOURCE", "label", "Hướng dẫn tự đo huyết áp tại nhà đúng cách",
                "href", "/articles/huong-dan-tu-do-huyet-ap")));
        verify(aiService).retrieveChat(Map.of(
            "message", "Bài viết nào hướng dẫn đo huyết áp?",
            "mode", "HEALTH_EDUCATION",
            "top_k", 20));
        verify(aiService).generateChat(Map.of(
            "message", "Bài viết nào hướng dẫn đo huyết áp?",
            "mode", "HEALTH_EDUCATION",
            "authorized_sources", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID,
                "projection_kind", "CLINICAL", "content_revision", 1L,
                "eligibility_revision", 1L, "content_hash", "a".repeat(64),
                "approval_id", "1"))));
        verify(aiService, never()).chat(any());
    }

    @Test
    void refusesToGeneratePublicEducationWhenSpringCannotAuthorizeCandidate() {
        AiService aiService = mock(AiService.class);
        when(aiService.retrieveChat(any())).thenReturn(Map.of(
            "mode", "HEALTH_EDUCATION",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "relevance_threshold", 0.45,
            "candidates", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID,
                "title", "Ứng viên chưa được duyệt", "score", 0.9))));
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.authorize(eq(ChatMode.HEALTH_EDUCATION), any())).thenReturn(List.of());

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bài viết nào hướng dẫn đo huyết áp?", null))
            .getBody();

        assertThat(body)
            .containsEntry("mode", "HEALTH_EDUCATION")
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("citations", List.of());
        verify(aiService, never()).generateChat(any());
    }

    @Test
    void publicEducationLaneHonorsHealthEducationKillSwitch() {
        AiService aiService = mock(AiService.class);
        PublicAiChatController controller = new PublicAiChatController(
            aiService, resolverForArticle(), null, null, false);

        assertThatThrownBy(() -> controller.chat(
            new PublicAiChatController.PublicChatRequest(
                "Bài viết nào hướng dẫn đo huyết áp?", null), null))
            .isInstanceOfSatisfying(com.healthcare.exception.BusinessException.class,
                ex -> {
                    assertThat(ex.getStatus()).isEqualTo(503);
                    assertThat(ex.getCode()).isEqualTo("AI_UNAVAILABLE");
                });
        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
        verify(aiService, never()).chat(any());
    }

    @Test
    void publicEducationEmergencyStillAnswersWhenKillSwitchOff() {
        AiService aiService = mock(AiService.class);
        PublicAiChatController controller = new PublicAiChatController(
            aiService, resolverForArticle(), null, null, false);

        Map<String, Object> body = controller.chat(
            new PublicAiChatController.PublicChatRequest(
                "Tôi đang muốn chết, cho tôi bài viết về bệnh", null), null)
            .getBody();

        assertThat(body).containsEntry("safety_action", "EMERGENCY");
        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
        verify(aiService, never()).chat(any());
    }

    @Test
    void overlongCrisisMessageStillReturnsEmergencyGuidance() {
        // Wave-7 ordering: Bean Validation no longer size-gates `message`, so
        // a crisis phrase past the 500-char limit reaches the emergency check
        // instead of dying as a bare 400.
        AiService aiService = mock(AiService.class);
        PublicAiChatController controller = new PublicAiChatController(
            aiService, resolverForArticle(), null, null, false);

        Map<String, Object> body = controller.chat(
            new PublicAiChatController.PublicChatRequest(
                "đau đầu nhẹ ".repeat(60) + "tôi muốn chết", null), null)
            .getBody();

        assertThat(body).containsEntry("safety_action", "EMERGENCY");
        verify(aiService, never()).chat(any());
        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
    }

    @Test
    void overlongNonCrisisMessageStillFailsLengthValidation() {
        AiService aiService = mock(AiService.class);

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForArticle())
            .chat(new PublicAiChatController.PublicChatRequest(
                "x".repeat(501), null), null))
            .isInstanceOfSatisfying(com.healthcare.exception.BusinessException.class,
                ex -> {
                    assertThat(ex.getStatus()).isEqualTo(400);
                    assertThat(ex.getCode()).isEqualTo("VALIDATION_ERROR");
                });
        verify(aiService, never()).chat(any());
    }

    @Test
    void crisisCueInsideScanWindowStillReturnsEmergencyGuidance() {
        // Window boundary, inner edge: the cue sits past the 500-char limit
        // but inside the 4096-char scan window, so it must still fire.
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(
            aiService, resolverForArticle(), null, null, false)
            .chat(new PublicAiChatController.PublicChatRequest(
                "x".repeat(600) + " tôi muốn tự tử", null), null)
            .getBody();

        assertThat(body).containsEntry("safety_action", "EMERGENCY");
        verify(aiService, never()).chat(any());
    }

    @Test
    void crisisCuePastScanWindowFallsBackToLengthValidation() {
        // Window boundary, outer edge: a cue starting after char 4096 is not
        // scanned, so the overlong message degrades to the normal 400.
        AiService aiService = mock(AiService.class);

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForArticle())
            .chat(new PublicAiChatController.PublicChatRequest(
                "x".repeat(4200) + " tôi muốn tự tử", null), null))
            .isInstanceOfSatisfying(com.healthcare.exception.BusinessException.class,
                ex -> {
                    assertThat(ex.getStatus()).isEqualTo(400);
                    assertThat(ex.getCode()).isEqualTo("VALIDATION_ERROR");
                });
        verify(aiService, never()).chat(any());
    }

    @Test
    void controlCharacterMessageStillFailsValidation() {
        AiService aiService = mock(AiService.class);

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForArticle())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Xinchào", null), null))
            .isInstanceOf(com.healthcare.exception.BusinessException.class);
        verify(aiService, never()).chat(any());
    }

    @Test
    void keepsMixedFaqBookingQuestionInOperationalMode() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Bạn có thể bắt đầu đặt lịch tại trang Đặt lịch khám.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_provider",
            "safety_action", "ANSWER",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of(Map.of(
                "source_type", "specialty", "source_id", SPECIALTY_ID, "title", "untrusted title"))));

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForSpecialty())
            .chat(new PublicAiChatController.PublicChatRequest("FAQ về đặt lịch khám", null))
            .getBody();

        assertThat(body).containsEntry("mode", "HOSPITAL_SUPPORT");
        verify(aiService, never()).chat(any());
        verify(aiService, never()).retrieveChat(any());
        verify(aiService, never()).generateChat(any());
    }

    @Test
    void rejectsPublicEducationAnswerWhenUsedSourcesAreNotExhaustive() {
        AiService aiService = mock(AiService.class);
        when(aiService.retrieveChat(any())).thenReturn(Map.of(
            "mode", "HEALTH_EDUCATION", "provenance", "local_provider",
            "safety_action", "ANSWER", "relevance_threshold", 0.45,
            "candidates", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID,
                "title", "candidate", "score", 0.9))));
        when(aiService.generateChat(any())).thenReturn(Map.of(
            "answer", "Bài viết đã được kiểm duyệt.",
            "provenance", "local_provider", "mode", "HEALTH_EDUCATION",
            "disclaimer", "Chỉ mang tính tham khảo.", "safety_action", "ANSWER",
            "citations", List.of(Map.of(
                "source_type", "article", "source_id", ARTICLE_ID, "title", "provider title")),
            "used_sources", List.of()));

        assertThatThrownBy(() -> new PublicAiChatController(aiService, resolverForArticle())
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bài viết nào hướng dẫn đo huyết áp?", null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
            .hasMessageContaining("502 BAD_GATEWAY");
        verify(aiService).retrieveChat(any());
        verify(aiService).generateChat(any());
        verify(aiService, never()).chat(any());
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null)))
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null)))
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null)))
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null)))
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null)))
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null)))
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
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null)))
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

        // A general-information question stays on the provider path so the
        // forwarded recent_turns payload can be asserted; deterministic-lane
        // intents are covered by their own provider-free tests.
        PublicAiChatController.PublicChatRequest request = new PublicAiChatController.PublicChatRequest(
            "Cho mình hỏi thông tin bệnh viện",
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
            "message", "Cho mình hỏi thông tin bệnh viện",
            "public_support_chat", true,
            "mode", "HOSPITAL_SUPPORT",
            "recent_turns", List.of(
                Map.of("role", "user", "content", "Xin chào"),
                Map.of("role", "assistant", "content", "Chào bạn, tôi có thể giúp gì?"),
                Map.of("role", "user", "content", "Bệnh viện có khoa tim mạch không?")
            )
        ));
    }

    @Test
    void answersBranchCountQuestionWithLiveBranchListWithoutProvider() {
        // The upfront deterministic lane now answers broad branch questions
        // from the live catalog before any provider call — the same verified
        // rows the degraded path used to reach only after a provider failure.
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForLiveBranchList())
            .chat(new PublicAiChatController.PublicChatRequest("Bệnh viện có mấy cơ sở?", null))
            .getBody();

        assertThat((String) body.get("answer"))
            .contains("Cơ sở 1 — Quận 1")
            .contains("Cơ sở 2 — Quận 3")
            .doesNotContain("Giờ làm việc có thể khác theo từng cơ sở");
        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_support_shortcut")
            .containsEntry("citations", List.of(
                Map.of("source_type", "branch", "source_id", BRANCH_ID, "title", "Cơ sở 1 — Quận 1"),
                Map.of("source_type", "branch", "source_id", SECOND_SPECIALTY_ID, "title", "Cơ sở 2 — Quận 3")))
            .containsKey("suggested_actions");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersDoctorSpecialtyQuestionWithLiveDoctorListWithoutProvider() {
        // Doctor-directory questions resolve from the live catalog
        // deterministically — the same verified rows the degraded path used
        // to need an AI fallback to reach.
        AiService aiService = mock(AiService.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolverForLiveDoctorList())
            .chat(new PublicAiChatController.PublicChatRequest("Bác sĩ nào giỏi về da liễu?", null))
            .getBody();

        assertThat((String) body.get("answer"))
            .contains("BS Nguyễn Văn A — Da liễu")
            .doesNotContain("Để tìm bác sĩ phù hợp");
        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("mode", "HOSPITAL_SUPPORT")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_support_shortcut")
            .containsEntry("citations", List.of(Map.of(
                "source_type", "doctor", "source_id", "00000000-0000-0000-0000-000000000005",
                "title", "BS Nguyễn Văn A — Da liễu")));
        verify(aiService, never()).chat(any());
    }

    @Test
    void keepsStaticBranchNavigationCopyWhenTheLiveBranchListIsEmpty() {
        // With an empty catalog the deterministic lane still fails soft to
        // the same server-owned navigation copy — no provider round-trip.
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.activeBranchOverview(anyInt())).thenReturn(List.of());

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Bệnh viện có mấy cơ sở?", null))
            .getBody();

        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("citations", List.of())
            .containsEntry("routingReason", "public_support_shortcut")
            .containsEntry("answer",
                "Giờ làm việc có thể khác theo từng cơ sở. Hãy mở mục Cơ sở & giờ làm việc "
                    + "để xem thông tin hiện tại trước khi đến khám.");
        verify(aiService, never()).chat(any());
    }

    @Test
    void keepsDegradedNavigationCopyWhenProviderUnavailableForGeneralIntent() {
        // A GENERAL question has no deterministic lane, so an upstream outage
        // must still degrade to the server-owned navigation copy.
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
            SERVICE_UNAVAILABLE, "AI service is unavailable"));
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Cho mình hỏi thông tin bệnh viện", null))
            .getBody();

        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_ai_degraded_navigation");
    }

    @Test
    void keepsStaticDoctorNavigationCopyWhenTheResolverFails() {
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenThrow(new org.springframework.web.server.ResponseStatusException(
            SERVICE_UNAVAILABLE, "AI service is unavailable"));
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.activeDoctorOverview(anyInt(), any()))
            .thenThrow(new RuntimeException("catalog down"));

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Bác sĩ nào giỏi về da liễu?", null))
            .getBody();

        assertThat(body)
            .containsEntry("provenance", "local_fallback")
            .containsEntry("citations", List.of())
            .containsEntry("routingReason", "public_support_shortcut")
            .containsEntry("answer",
                "Để tìm bác sĩ phù hợp, bạn có thể mở danh sách Bác sĩ để xem thông tin hiện có; "
                    + "sau đó chọn Đặt lịch khám nếu muốn tiếp tục.");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersParkingQuestionFromLiveAmenitiesWithoutProviderCall() {
        // "bãi đậu xe" must not hit the clinical handoff ("đậu" normalizes
        // to "dau"); the deterministic amenity lane answers from the live
        // amenities JSON without ever calling the provider.
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = resolverForAmenity();

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Bãi đậu xe ở đâu?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_amenity_fallback")
            .containsEntry("costTier", "local_free");
        assertThat((String) body.get("answer"))
            .contains("Cơ sở 1")
            .contains("Bãi đỗ xe");
        assertThat(body.get("citations"))
            .isEqualTo(List.of(Map.of(
                "source_type", "branch", "source_id", BRANCH_ID,
                "title", "Cơ sở 1 — Quận 1")));
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersParkingVariantAndPharmacyQuestionsFromAmenities() {
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = resolverForAmenity();

        Map<String, Object> parking = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Các cơ sở có bãi đỗ xe không?", null))
            .getBody();
        assertThat(parking)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_amenity_fallback");

        Map<String, Object> pharmacy = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Cơ sở có nhà thuốc không?", null))
            .getBody();
        assertThat(pharmacy)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_amenity_fallback");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersHonestlyWhenNoBranchAdvertisesTheAmenity() {
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.resolveAmenity(any())).thenReturn(
            new AiChatSourceResolver.AmenityResolution(
                "canteen", List.of(), List.of(), false, false));
        when(resolver.amenityDisplayName("canteen")).thenReturn("căn tin/quầy ăn uống");

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest("Bệnh viện có căn tin không?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_amenity_fallback")
            .containsEntry("citations", List.of());
        assertThat((String) body.get("answer")).contains("chưa có cơ sở nào");
        verify(aiService, never()).chat(any());
    }

    @Test
    void failsClosedWhenNamedBranchCannotResolveForAmenity() {
        // "Cơ sở 99 có bãi xe không" names an identity that does not
        // resolve — the answer must fail closed instead of silently
        // listing other branches' amenities.
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.resolveAmenity(any())).thenReturn(
            new AiChatSourceResolver.AmenityResolution(
                "parking", List.of(), List.of(), true, false));
        when(resolver.amenityDisplayName("parking")).thenReturn("bãi đậu xe/chỗ đỗ xe");
        when(resolver.hasBranchAttributeCue(any())).thenReturn(true);
        when(resolver.isSpecificBranchQuery(any())).thenReturn(true);
        when(resolver.branchDetails(any())).thenReturn(List.of());
        when(resolver.actions(any())).thenReturn(List.of());

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cơ sở 99 có bãi đậu xe không?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "INSUFFICIENT_EVIDENCE")
            .containsEntry("routingReason", "public_branch_unavailable");
        assertThat((String) body.get("answer")).doesNotContain("có bãi đậu xe");
        verify(aiService, never()).chat(any());
    }

    @Test
    void degradesHonestlyWhenAmenityCatalogIsUnreachable() {
        // A catalog outage (resolution null) must not produce an
        // authoritative "no branch advertises X" — the request falls
        // through to the honest degrade path instead.
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        when(resolver.resolveAmenity(any())).thenReturn(null);
        when(resolver.hasBranchAttributeCue(any())).thenReturn(true);
        when(resolver.isSpecificBranchQuery(any())).thenReturn(false);
        when(resolver.branchDetails(any())).thenReturn(List.of());
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "Hiện mình chưa tra cứu được tiện ích cơ sở.",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_fallback",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()));

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Bệnh viện có căn tin không?", null))
            .getBody();

        assertThat(body).isNotNull();
        assertThat((String) body.get("answer"))
            .doesNotContain("chưa có cơ sở nào công bố");
    }

    @Test
    void preparationInterceptsBeforeBranchResolutionLikeThePatientLane() {
        // Lane parity: a PREPARATION-classified message carrying branch
        // wording gets the checklist, not the branch fail-closed path.
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cơ sở ở đâu cần chuẩn bị gì trước khi khám?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("routingReason", "public_preparation_guidance");
        verify(aiService, never()).chat(any());
    }

    @Test
    void answersGenericPreparationQuestionWithoutProviderCall() {
        // The pre-visit checklist is a complete deterministic answer —
        // the provider must not be called and the response is an ANSWER,
        // not the degraded retry banner.
        AiService aiService = mock(AiService.class);
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "Cần chuẩn bị gì trước khi đi khám?", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "ANSWER")
            .containsEntry("provenance", "local_fallback")
            .containsEntry("routingReason", "public_preparation_guidance")
            .containsEntry("costTier", "local_free");
        assertThat((String) body.get("answer"))
            .contains("BHYT")
            .contains("15–30 phút");
        verify(aiService, never()).chat(any());
    }

    @Test
    void keepsClinicalLaneWhenPainAndParkingAreMixed() {
        // "đậu xe đau đầu" still carries a real symptom — the safety gate
        // must win over the amenity lane.
        AiService aiService = mock(AiService.class);
        when(aiService.chat(any())).thenReturn(Map.of(
            "answer", "safe",
            "disclaimer", "Chỉ mang tính tham khảo.",
            "provenance", "local_fallback",
            "safety_action", "INSUFFICIENT_EVIDENCE",
            "mode", "HOSPITAL_SUPPORT",
            "citations", List.of()
        ));
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);

        Map<String, Object> body = new PublicAiChatController(aiService, resolver)
            .chat(new PublicAiChatController.PublicChatRequest(
                "đậu xe đau đầu kéo dài", null))
            .getBody();

        assertThat(body)
            .containsEntry("safety_action", "HUMAN_HANDOFF");
        verify(resolver, never()).resolveAmenity(any());
    }

    private AiChatSourceResolver resolverForAmenity() {
        AiChatSourceResolver resolver = mock(AiChatSourceResolver.class);
        AiChatSourceResolver.ResolvedSource branch = new AiChatSourceResolver.ResolvedSource(
            "branch", BRANCH_ID, "Cơ sở 1 — Quận 1", "co-so-1", true, true,
            "OPERATIONAL", null, null, null, null, "/branches/co-so-1",
            "/dat-lich?branchId=" + BRANCH_ID);
        AiChatSourceResolver.BranchDetails details = new AiChatSourceResolver.BranchDetails(
            branch, "12 Nguyễn Huệ, Quận 1", "07:00–19:00", "028 38000001",
            List.of("Bãi đỗ xe", "Nhà thuốc"));
        when(resolver.resolveAmenity(any())).thenReturn(
            new AiChatSourceResolver.AmenityResolution(
                "parking", List.of(details), List.of(), false, false));
        when(resolver.amenityDisplayName(any())).thenReturn("bãi đậu xe/chỗ đỗ xe");
        when(resolver.matchedAmenityLabels(details, "parking")).thenReturn(List.of("Bãi đỗ xe"));
        when(resolver.citations(any())).thenReturn(List.of(
            Map.of("source_type", "branch", "source_id", BRANCH_ID, "title", branch.title())));
        when(resolver.actions(any())).thenReturn(List.of(
            Map.of("kind", "VIEW_SOURCE", "label", branch.title(), "href", branch.viewHref())));
        return resolver;
    }
}
