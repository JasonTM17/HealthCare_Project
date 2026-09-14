package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.entity.AiMessageRole;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiChatHistorySanitizerTest {

    @Test
    void replacesLegacyFixtureBlocksWithCurrentBranchAwareDoctorLabels() {
        String legacy = "Dựa trên nguồn thông tin đã được kiểm duyệt, Thần kinh: "
            + "Khám và điều trị rối loạn giấc ngủ. Bác sĩ mẫu 3: Bác sĩ mẫu 3 "
            + "DỮ LIỆU MINH HỌA: Hồ sơ giả lập. Cơ sở mẫu: Thủ Đức. "
            + "Lịch thử nghiệm 08:00-17:00. Bác sĩ mẫu 3: Bác sĩ mẫu 3 "
            + "DỮ LIỆU MINH HỌA: Hồ sơ giả lập.";
        AiChatSourceResolver.ResolvedSource doctor = new AiChatSourceResolver.ResolvedSource(
            "doctor", "doctor-3", "Bác sĩ mẫu 3 — Phòng khám ngoại trú HealthCare — Thủ Đức",
            "bac-si-mau-3", true, true, "OPERATIONAL", null, null, null, null,
            "/doctors/bac-si-mau-3", "/dat-lich?doctorId=doctor-3");

        String cleaned = AiChatHistorySanitizer.sanitize(
            AiMessageRole.ASSISTANT, legacy, List.of(doctor));

        assertThat(cleaned)
            .contains("Thần kinh")
            .contains("Bác sĩ mẫu 3 — Phòng khám ngoại trú HealthCare — Thủ Đức")
            .contains("Nếu cần quyết định phù hợp")
            .doesNotContain("DỮ LIỆU MINH HỌA")
            .doesNotContain("Lịch thử nghiệm")
            .containsOnlyOnce("Bác sĩ mẫu 3 — Phòng khám ngoại trú HealthCare — Thủ Đức");
    }

    @Test
    void leavesUserContentAndModernAssistantContentUntouched() {
        String content = "Câu trả lời hiện tại không chứa fixture.";

        assertThat(AiChatHistorySanitizer.sanitize(
            AiMessageRole.USER, content, List.of())).isEqualTo(content);
        assertThat(AiChatHistorySanitizer.sanitize(
            AiMessageRole.ASSISTANT, content, List.of())).isEqualTo(content);
    }

    @Test
    void focusesHistoricalSpecialtyAnswersOnSpecialtySources() {
        AiChatSourceResolver.ResolvedSource specialty = new AiChatSourceResolver.ResolvedSource(
            "specialty", "specialty-neuro", "Thần kinh", "than-kinh", true, true,
            "OPERATIONAL", null, null, null, null, "/specialties/than-kinh", "/dat-lich");
        AiChatSourceResolver.ResolvedSource doctor = new AiChatSourceResolver.ResolvedSource(
            "doctor", "doctor-3", "Bác sĩ mẫu 3 — Nội tổng hợp", "bac-si-mau-3", true, true,
            "OPERATIONAL", null, null, null, null, "/doctors/bac-si-mau-3", "/dat-lich");
        String modern = "Dựa trên nguồn thông tin đã được kiểm duyệt, Thần kinh: Thần kinh "
            + "Khám và điều trị rối loạn giấc ngủ. Bác sĩ: Bác sĩ mẫu 3 — Nội tổng hợp. "
            + "Nếu cần quyết định phù hợp với tình trạng riêng, hãy trao đổi trực tiếp với nhân viên y tế.";
        String question = "Tôi bị mất ngủ kéo dài 3 tuần, nên khám chuyên khoa nào?";

        assertThat(AiChatHistorySanitizer.focusSourcesForQuestion(
            question, List.of(specialty, doctor))).containsExactly(specialty);
        assertThat(AiChatHistorySanitizer.sanitize(
            AiMessageRole.ASSISTANT, modern, question, List.of(specialty, doctor)))
            .contains("Thần kinh")
            .doesNotContain("Bác sĩ mẫu 3")
            .doesNotContain("Thần kinh: Thần kinh")
            .contains("Nếu cần quyết định phù hợp");
    }

    @Test
    void replacesAnUnsourcedSpecialtyFallbackWithAConservativeMessage() {
        String genericFallback = "Bệnh viện đa khoa HealthCare quy tụ đội ngũ bác sĩ chuyên khoa đầu ngành.\n"
            + "Khoa Tim mạch & Can thiệp mạch máu\nKhoa Thần kinh & Đột quỵ";

        assertThat(AiChatHistorySanitizer.sanitize(
            AiMessageRole.ASSISTANT,
            genericFallback,
            "Tôi bị mất ngủ kéo dài 3 tuần, nên khám chuyên khoa nào?",
            List.of(),
            "local_fallback"))
            .contains("chưa tìm thấy nguồn thông tin đủ cụ thể")
            .doesNotContain("Khoa Tim mạch")
            .doesNotContain("Khoa Thần kinh");
    }
}
