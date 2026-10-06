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
            .containsExactly("/faq", "/branches", "/dat-lich");
        assertThat(ChatSuggestedActionResolver.classify("Có những gói khám tổng quát nào?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.PACKAGE);
    }

    @Test
    void doesNotTreatAWordFragmentAsASymptom() {
        assertThat(ChatSuggestedActionResolver.classify("Bạn cho tôi biết nên khám khoa nào"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.GENERAL);
    }

    @Test
    void routesFacilityQuestionsToAmenityIntent() {
        // "đậu" (to park) and "nhà thuốc" (pharmacy storefront) normalize
        // onto clinical tokens; the facility reading must classify first.
        assertThat(ChatSuggestedActionResolver.classify("Bãi đậu xe ở đâu?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("Các cơ sở có bãi đỗ xe không?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("Bệnh viện có chỗ đậu xe không?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("Cơ sở 4 có nhà thuốc không?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("Bệnh viện có ATM không?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("Có wifi miễn phí không?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        // Reversed word order and vehicle compounds classify the same way.
        assertThat(ChatSuggestedActionResolver.classify("Xe đậu ở đâu?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("chỗ đậu xe tay ga"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("xe máy đậu ở đâu"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("ô tô đậu ở đâu"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("xe tay ga đậu chỗ nào"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        // "để" phrasing (xe để ở đâu) classifies too; the " o" guard keeps
        // "đề xét nghiệm" / "xe máy đến" out of the amenity lane.
        assertThat(ChatSuggestedActionResolver.classify("Xe máy để ở đâu?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("Có chỗ để xe không?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("ô tô để ở đâu"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        // Laundry phrasings classify as amenity questions — the folded
        // "co giat" reaching this classifier already passed the emergency
        // gate's convulsion disambiguation.
        assertThat(ChatSuggestedActionResolver.classify("Có giặt đồ cho khách không?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("phòng khám có giặt ủi không"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("giặt ủi ở đâu"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("dịch vụ giặt là có không"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        // "giật mình" (startle reflex) is a symptom — bare "giat" must not
        // pull it into the amenity lane.
        assertThat(ChatSuggestedActionResolver.classify("tôi hay giật mình"))
            .isNotEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(ChatSuggestedActionResolver.classify("đề xét nghiệm máu"))
            .isNotEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.AMENITY);
        assertThat(
                ChatSuggestedActionResolver.hospitalSupportFallback("Bãi đậu xe ở đâu?"))
            .extracting(action -> action.get("href"))
            .contains("/branches");
        // A pure branch question is still BRANCH — amenity wording does not
        // steal plain address/hours lookups.
        assertThat(ChatSuggestedActionResolver.classify("Địa chỉ cơ sở 4 là gì?"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.BRANCH);
    }

    @Test
    void routesIdentityAndHelpQuestionsToGreetingShortcut() {
        assertThat(ChatSuggestedActionResolver.classify("Bạn là ai á"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.GREETING);
        assertThat(ChatSuggestedActionResolver.classify("Bạn là ai vậy"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.GREETING);
        assertThat(ChatSuggestedActionResolver.classify("Em là ai"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.GREETING);
        assertThat(ChatSuggestedActionResolver.classify("Giới thiệu về bạn"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.GREETING);
        assertThat(ChatSuggestedActionResolver.classify("Bạn có thể giúp gì cho tôi"))
            .isEqualTo(ChatSuggestedActionResolver.HospitalSupportIntent.GREETING);
    }
}
