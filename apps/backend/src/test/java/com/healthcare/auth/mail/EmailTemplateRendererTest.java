package com.healthcare.auth.mail;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EmailTemplateRendererTest {

    private final EmailTemplateRenderer renderer = new EmailTemplateRenderer();

    @Test
    void rendersEveryCodeOwnedTemplateWithSafeSubjectAndAccessibleMarkup() {
        for (EmailTemplateKey key : EmailTemplateKey.values()) {
            Map<String, String> variables = switch (key) {
                case EMAIL_VERIFICATION, PASSWORD_RESET, BOOKING_OTP, BOOKING_VERIFICATION_OTP -> Map.of(
                    "code", "<123456>", "minutes", "10", "portalUrl", "https://portal.example.test/patient");
                default -> Map.of("message", "<script>alert(1)</script>",
                    "portalUrl", "https://portal.example.test/patient");
            };
            RenderedEmail rendered = renderer.render(key, variables);

            assertEquals(key.defaultSubject(), rendered.subject());
            assertEquals(key.defaultPreheader(), rendered.preheader());
            assertEquals(key.templateVersion(), rendered.templateVersion());
            assertEquals(rendered.textBody(), rendered.plainTextBody());
            assertFalse(rendered.subject().contains("<"));
            assertTrue(rendered.htmlBody().contains("<meta charset=\"utf-8\">"));
            assertTrue(rendered.htmlBody().contains("min-height:44px"));
            assertTrue(rendered.htmlBody().contains("role=\"presentation\""));
            assertTrue(rendered.htmlBody().indexOf("display:none")
                < rendered.htmlBody().indexOf("bgcolor=\"#0f766e\""));
            assertFalse(rendered.htmlBody().contains("linear-gradient"));
            assertFalse(rendered.htmlBody().contains("<img"));
            assertFalse(rendered.htmlBody().contains("1900 1234"));
            assertFalse(rendered.htmlBody().contains("123 Đường Sức Khỏe"));
            assertFalse(rendered.textBody().contains("1900 1234"));
            assertFalse(rendered.textBody().isBlank());
        }
    }

    @Test
    void keepsClinicalEmailLayoutCalmReadableAndOutlookFriendly() {
        RenderedEmail rendered = renderer.render(EmailTemplateKey.APPOINTMENT_CONFIRMATION, Map.of(
            "message", "Lịch khám đã được xác nhận.",
            "portalUrl", "https://portal.example.test/appointments/123"
        ));
        String html = rendered.htmlBody();

        assertTrue(html.contains("width=\"600\""));
        assertTrue(html.contains("style=\"width:100%;max-width:600px;"));
        assertTrue(html.contains("color:#17312e;font-size:16px;line-height:1.6;"));
        assertFalse(html.contains("border-left:"));
        assertFalse(html.contains(">+</td>"));

        RenderedEmail otp = renderer.render(EmailTemplateKey.BOOKING_OTP, Map.of(
            "code", "123456",
            "minutes", "10"
        ));
        assertTrue(otp.htmlBody().contains("margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;"));
    }

    @Test
    void rejectsUnsafePortalUrlAndEscapesDynamicValues() {
        assertThrows(IllegalArgumentException.class, () -> renderer.render(EmailTemplateKey.SYSTEM_NOTIFICATION, Map.of(
            "message", "A < B & C", "portalUrl", "javascript:alert(1)")));

        RenderedEmail rendered = renderer.render(EmailTemplateKey.SYSTEM_NOTIFICATION, Map.of("message", "A < B & C"));

        assertTrue(rendered.htmlBody().contains("A &lt; B &amp; C"));
        assertTrue(rendered.textBody().contains("A < B & C"));
        assertFalse(rendered.htmlBody().contains("javascript:"));
        assertFalse(rendered.htmlBody().contains("Mở cổng bệnh nhân"));
    }

    @Test
    void rejectsMissingAndUnknownTemplateVariables() {
        assertThrows(IllegalArgumentException.class,
            () -> renderer.render(EmailTemplateKey.BOOKING_OTP, Map.of("code", "123456")));
        assertThrows(IllegalArgumentException.class,
            () -> renderer.render(EmailTemplateKey.SYSTEM_NOTIFICATION, Map.of("message", "ok", "extra", "nope")));
    }

    @Test
    void includesBookingCodeWhenProvidedForConcurrentMailboxCorrelation() {
        RenderedEmail rendered = renderer.render(EmailTemplateKey.BOOKING_OTP, Map.of(
            "code", "123456",
            "minutes", "5",
            "bookingCode", "APT-20260828-0001"
        ));

        assertTrue(rendered.textBody().contains("Mã đặt lịch: APT-20260828-0001."));
        assertTrue(rendered.htmlBody().contains("APT-20260828-0001"));
    }

    @Test
    void rendersDedicatedCategoryBadgesAndContextualGuidanceForClinicalTemplates() {
        // 1. Appointment confirmation
        RenderedEmail appointment = renderer.render(EmailTemplateKey.APPOINTMENT_CONFIRMATION, Map.of(
            "message", "Bác sĩ Nguyễn Văn A xác nhận lịch khám.",
            "portalUrl", "https://portal.example.test/appointments/123"
        ));
        assertTrue(appointment.htmlBody().contains("Lịch khám đã được xác nhận"));
        assertTrue(appointment.htmlBody().contains("Trước buổi khám"));
        assertTrue(appointment.htmlBody().contains("Xem chi tiết lịch hẹn"));
        assertFalse(appointment.htmlBody().contains("nhịn ăn"));
        assertTrue(appointment.textBody().contains("hướng dẫn chuẩn bị riêng"));

        // 2. Payment status
        RenderedEmail payment = renderer.render(EmailTemplateKey.PAYMENT_STATUS, Map.of(
            "message", "Thanh toán 500,000 VND thành công.",
            "portalUrl", "https://portal.example.test/billing/456"
        ));
        assertTrue(payment.htmlBody().contains("Cập nhật thanh toán"));
        assertTrue(payment.htmlBody().contains("Kiểm tra thanh toán"));
        assertTrue(payment.htmlBody().contains("Xem biên lai thanh toán"));
        assertTrue(payment.textBody().contains("Đối chiếu trạng thái"));

        // 3. Results ready
        RenderedEmail results = renderer.render(EmailTemplateKey.RESULTS_READY, Map.of(
            "message", "Kết quả xét nghiệm sinh hóa máu đã hoàn tất.",
            "portalUrl", "https://portal.example.test/results/789"
        ));
        assertTrue(results.htmlBody().contains("Kết quả cận lâm sàng"));
        assertTrue(results.htmlBody().contains("Bảo mật kết quả"));
        assertTrue(results.htmlBody().contains("Xem kết quả xét nghiệm"));

        // 4. Prescription ready
        RenderedEmail rx = renderer.render(EmailTemplateKey.PRESCRIPTION_READY, Map.of(
            "message", "Bác sĩ đã kê đơn thuốc mới.",
            "portalUrl", "https://portal.example.test/prescriptions/101"
        ));
        assertTrue(rx.htmlBody().contains("Toa thuốc điện tử mới"));
        assertTrue(rx.htmlBody().contains("Về toa thuốc"));
        assertTrue(rx.htmlBody().contains("Xem toa thuốc điện tử"));

        // 5. Consultation reply
        RenderedEmail consult = renderer.render(EmailTemplateKey.CONSULTATION_REPLY, Map.of(
            "message", "Bác sĩ đã trả lời thắc mắc của bạn.",
            "portalUrl", "https://portal.example.test/consultations/202"
        ));
        assertTrue(consult.htmlBody().contains("Phản hồi tư vấn"));
        assertTrue(consult.htmlBody().contains("Về phản hồi tư vấn"));
        assertTrue(consult.htmlBody().contains("Xem phản hồi bác sĩ"));

        // 6. Care plan reminder
        RenderedEmail reminder = renderer.render(EmailTemplateKey.CARE_PLAN_REMINDER, Map.of(
            "message", "Đã đến thời gian kiểm tra huyết áp định kỳ.",
            "portalUrl", "https://portal.example.test/care-plans/303"
        ));
        assertTrue(reminder.htmlBody().contains("Nhắc chăm sóc"));
        assertTrue(reminder.htmlBody().contains("Theo dõi kế hoạch"));
        assertTrue(reminder.htmlBody().contains("Xem kế hoạch chăm sóc"));

        // 7. Appointment cancel
        RenderedEmail cancel = renderer.render(EmailTemplateKey.APPOINTMENT_CANCEL, Map.of(
            "message", "Lịch hẹn ngày 20/09 đã được hủy theo yêu cầu.",
            "portalUrl", "https://portal.example.test/appointments/new"
        ));
        assertTrue(cancel.htmlBody().contains("Lịch khám đã được hủy"));
        assertTrue(cancel.htmlBody().contains("Cần đặt lịch khác?"));
        assertTrue(cancel.htmlBody().contains("Truy cập cổng đặt lịch"));
    }

    @Test
    void exportSampleHtmlPreviews() throws java.io.IOException {
        java.nio.file.Path previewDir = java.nio.file.Paths.get("target", "email-previews");
        java.nio.file.Files.createDirectories(previewDir);

        EmailTemplateRenderer liveRenderer = new EmailTemplateRenderer("https://www.healthcare.id.vn");

        // 1. Booking OTP
        RenderedEmail bookingOtp = liveRenderer.render(EmailTemplateKey.BOOKING_OTP, Map.of(
            "code", "826194",
            "minutes", "10",
            "bookingCode", "APT-20260916-088",
            "portalUrl", "https://www.healthcare.id.vn/patient/appointments"
        ));
        java.nio.file.Files.writeString(previewDir.resolve("booking_otp.html"), bookingOtp.htmlBody());

        // 2. Appointment Confirmation
        RenderedEmail apptConfirm = liveRenderer.render(EmailTemplateKey.APPOINTMENT_CONFIRMATION, Map.of(
            "message", "Lịch khám của quý khách với BS. CKI Nguyễn Văn An (Chuyên khoa Tim Mạch) vào lúc 08:30 ngày 22/09/2026 tại Phòng 302, Bệnh viện Đa khoa Quốc tế HealthCare - Chi nhánh 1 đã được xác nhận thành công.",
            "portalUrl", "https://www.healthcare.id.vn/patient/appointments"
        ));
        java.nio.file.Files.writeString(previewDir.resolve("appointment_confirmation.html"), apptConfirm.htmlBody());

        // 3. Payment Status
        RenderedEmail payment = liveRenderer.render(EmailTemplateKey.PAYMENT_STATUS, Map.of(
            "message", "Khoản thanh toán 500,000 VNĐ cho mã lịch hẹn APT-20260916-088 đã được ghi nhận thành công qua chuyển khoản ngân hàng (VietQR). Biên lai điện tử đã được cập nhật.",
            "portalUrl", "https://www.healthcare.id.vn/patient/billing"
        ));
        java.nio.file.Files.writeString(previewDir.resolve("payment_status.html"), payment.htmlBody());

        // 4. Results Ready
        RenderedEmail results = liveRenderer.render(EmailTemplateKey.RESULTS_READY, Map.of(
            "message", "Kết quả xét nghiệm Sinh hóa máu và Chụp X-quang Tim phổi thẳng của quý khách đã có kết quả và được bác sĩ chuyên khoa phê duyệt. Quý khách vui lòng truy cập cổng bệnh nhân để xem chi tiết.",
            "portalUrl", "https://www.healthcare.id.vn/patient/records"
        ));
        java.nio.file.Files.writeString(previewDir.resolve("results_ready.html"), results.htmlBody());

        assertTrue(java.nio.file.Files.exists(previewDir.resolve("booking_otp.html")));
        assertTrue(java.nio.file.Files.exists(previewDir.resolve("appointment_confirmation.html")));
    }
}
