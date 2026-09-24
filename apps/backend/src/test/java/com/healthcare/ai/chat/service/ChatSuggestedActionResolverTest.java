package com.healthcare.ai.chat.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ChatSuggestedActionResolverTest {

    @Test
    void routesSymptomSpecialtyQuestionsToUsefulNextSteps() {
        assertThat(ChatSuggestedActionResolver.classify(
            "Tôi bị đau đầu kéo dài, nên khám chuyên khoa nào?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.SPECIALTY_GUIDANCE);

        assertThat(ChatSuggestedActionResolver.hospitalSupportFallback(
            "Tôi bị đau đầu kéo dài, nên khám chuyên khoa nào?"))
            .containsExactly(
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Chuyên khoa", "href", "/specialties"),
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Bác sĩ", "href", "/doctors"),
                Map.of("kind", "START_BOOKING", "label", "Đặt lịch khám", "href", "/dat-lich"));
    }

    @Test
    void keepsCatalogAndHoursQuestionsDistinct() {
        assertThat(ChatSuggestedActionResolver.classify(
            "Bệnh viện có những chuyên khoa và cơ sở nào?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.CATALOG);
        assertThat(ChatSuggestedActionResolver.classify(
            "Tôi muốn biết giờ làm việc của bệnh viện"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.BRANCH);

        List<Map<String, String>> actions = ChatSuggestedActionResolver.hospitalSupportFallback(
            "Bệnh viện có những chuyên khoa và cơ sở nào?");
        assertThat(actions).allSatisfy(action ->
            assertThat(action.get("kind")).isIn("VIEW_SOURCE", "START_BOOKING"));
        assertThat(actions).extracting(action -> action.get("href"))
            .containsExactly("/specialties", "/branches", "/dat-lich");
    }

    @Test
    void neverEmitsLegacyActionKindsOrExternalLinks() {
        assertThat(ChatSuggestedActionResolver.hospitalSupportFallback("Xin chào"))
            .containsExactly(
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Chuyên khoa", "href", "/specialties"),
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Cơ sở", "href", "/branches"))
            .allSatisfy(action -> {
                assertThat(action.keySet()).containsExactlyInAnyOrder("kind", "label", "href");
                assertThat(action.get("href")).startsWith("/");
                assertThat(action.get("kind")).isIn("VIEW_SOURCE", "START_BOOKING");
            });

        assertThat(ChatSuggestedActionResolver.hospitalSupportFallback("Xin chào!"))
            .containsExactly(
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Chuyên khoa", "href", "/specialties"),
                Map.of("kind", "VIEW_SOURCE", "label", "Xem Cơ sở", "href", "/branches"));
    }

    @Test
    void routesSimpleDoctorNavigationToDoctorFirstActions() {
        assertThat(ChatSuggestedActionResolver.classify("Tôi muốn xem bác sĩ"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.DOCTOR);
        assertThat(ChatSuggestedActionResolver.hospitalSupportFallback("Tôi muốn xem bác sĩ"))
            .extracting(action -> action.get("href"))
            .startsWith("/doctors", "/dat-lich");
    }

    @Test
    void preparationQuestionAboutGeneralCheckupDoesNotBecomePackageShopping() {
        String question = "Cần chuẩn bị gì trước buổi khám tổng quát tại HealthCare?";
        assertThat(ChatSuggestedActionResolver.classify(question))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.PREPARATION);
        assertThat(ChatSuggestedActionResolver.hospitalSupportFallback(question))
            .extracting(action -> action.get("href"))
            .containsExactly("/dat-lich", "/branches", "/specialties");
        assertThat(ChatSuggestedActionResolver.classify("Có những gói khám tổng quát nào?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.PACKAGE);
    }

    @Test
    void doesNotTreatAWordFragmentAsASymptom() {
        assertThat(ChatSuggestedActionResolver.classify("Bạn cho tôi biết nên khám khoa nào"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.GENERAL);
    }
}
