package com.healthcare.auth.mail;

import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Renders safe HTML/plain-text email bodies from closed template keys. */
@Component
public class EmailTemplateRenderer {

    private static final String BRAND = "HealthCare";
    private static final String FOOTER =
        "Nếu bạn không mong đợi email này, hãy bỏ qua và đăng nhập cổng bệnh nhân nếu cần kiểm tra.";
    private static final Set<String> OTP_VARIABLES = Set.of("code", "minutes", "portalUrl");
    private static final Set<String> BOOKING_OTP_VARIABLES = Set.of("code", "minutes", "portalUrl", "bookingCode");
    private static final Set<String> MESSAGE_VARIABLES = Set.of("message", "portalUrl");
    private final URI portalOrigin;

    /** Test-friendly constructor uses the documented synthetic portal origin. */
    public EmailTemplateRenderer() {
        this("https://portal.example.test");
    }

    @Autowired
    public EmailTemplateRenderer(@Value("${app.mail.portal-base-url:}") String portalBaseUrl) {
        this.portalOrigin = parsePortalOrigin(portalBaseUrl);
    }

    public RenderedEmail render(EmailTemplateKey templateKey, Map<String, String> variables) {
        Objects.requireNonNull(templateKey, "templateKey");
        Map<String, String> safeVariables = variables == null ? Map.of() : variables;
        validateVariables(templateKey, safeVariables);

        String subject = sanitizeSubject(templateKey.defaultSubject());
        String preheader = templateKey.defaultPreheader();
        String textBody = buildTextBody(templateKey, safeVariables, subject, preheader);
        String htmlBody = buildHtml(templateKey, safeVariables, subject, preheader, textBody, safePortalUrl(safeVariables.get("portalUrl")));
        return new RenderedEmail(subject, preheader, textBody, htmlBody, templateKey.templateVersion());
    }

    private void validateVariables(EmailTemplateKey templateKey, Map<String, String> variables) {
        Set<String> allowed = isBookingOtp(templateKey)
            ? BOOKING_OTP_VARIABLES
            : (isOtp(templateKey) ? OTP_VARIABLES : MESSAGE_VARIABLES);
        if (!allowed.containsAll(variables.keySet())) {
            throw new IllegalArgumentException("Unknown email template variable");
        }
        if (isOtp(templateKey)) {
            requireVariable(variables, "code");
            requireVariable(variables, "minutes");
        } else {
            requireVariable(variables, "message");
        }
        if (variables.containsKey("portalUrl") && safePortalUrl(variables.get("portalUrl")) == null) {
            throw new IllegalArgumentException("Email portal URL is not allowlisted");
        }
    }

    private void requireVariable(Map<String, String> variables, String key) {
        String value = variables.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Required email template variable is missing");
        }
    }

    private boolean isOtp(EmailTemplateKey templateKey) {
        return templateKey == EmailTemplateKey.EMAIL_VERIFICATION
            || templateKey == EmailTemplateKey.PASSWORD_RESET
            || templateKey == EmailTemplateKey.BOOKING_OTP
            || templateKey == EmailTemplateKey.BOOKING_VERIFICATION_OTP;
    }

    private boolean isBookingOtp(EmailTemplateKey templateKey) {
        return templateKey == EmailTemplateKey.BOOKING_OTP
            || templateKey == EmailTemplateKey.BOOKING_VERIFICATION_OTP;
    }

    private String buildTextBody(
        EmailTemplateKey templateKey,
        Map<String, String> variables,
        String subject,
        String preheader
    ) {
        List<String> lines = new ArrayList<>();
        lines.add(BRAND);
        lines.add(subject);
        if (preheader != null && !preheader.isBlank()) {
            lines.add(preheader);
        }
        lines.add("");
        switch (templateKey) {
            case EMAIL_VERIFICATION, PASSWORD_RESET, BOOKING_OTP, BOOKING_VERIFICATION_OTP -> {
                String code = firstNonBlank(variables.get("code"), "******");
                String minutes = firstNonBlank(variables.get("minutes"), "10");
                lines.add("Mã xác minh của bạn là " + code + ".");
                if (isBookingOtp(templateKey) && variables.containsKey("bookingCode")) {
                    lines.add("Mã đặt lịch: " + variables.get("bookingCode") + ".");
                }
                lines.add("Mã này hết hạn sau " + minutes + " phút.");
                lines.add("Lưu ý an toàn: Tuyệt đối không cung cấp mã này cho người khác.");
            }
            default -> {
                String message = firstNonBlank(variables.get("message"), "Có một cập nhật mới từ HealthCare.");
                lines.add(message);
            }
        }

        String guidance = contextualTextGuidance(templateKey);
        if (!guidance.isBlank()) {
            lines.add("");
            lines.add(guidance);
        }

        String portalUrl = safePortalUrl(variables.get("portalUrl"));
        if (portalUrl != null) {
            lines.add("");
            lines.add("Xem tại cổng bệnh nhân: " + portalUrl);
        }
        lines.add("");
        lines.add(FOOTER);
        return String.join("\n", lines);
    }

    private String buildHtml(
        EmailTemplateKey templateKey,
        Map<String, String> variables,
        String subject,
        String preheader,
        String textBody,
        String portalUrl
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append("<!DOCTYPE html>");
        builder.append("<html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>");
        builder.append(escapeHtml(subject));
        builder.append("</title></head><body style=\"margin:0;padding:0;background:#f1f5f9;color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;\">");
        builder.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f1f5f9;padding:32px 12px;\"><tr><td align=\"center\">");
        builder.append("<table role=\"presentation\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" style=\"width:600px;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);\">");

        // Header brand banner with emergency hotline pill
        builder.append("<tr><td style=\"background:linear-gradient(135deg,#0f766e 0%,#0d9488 50%,#14b8a6 100%);padding:28px 32px;text-align:left;\">");
        builder.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\"><tr>");
        builder.append("<td style=\"vertical-align:middle;\">");
        builder.append("<div style=\"color:#ffffff;font-size:16px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;\">🏥 BỆNH VIỆN ĐA KHOA QUỐC TẾ HEALTHCARE</div>");
        builder.append("<div style=\"color:#ccfbf1;font-size:12px;margin-top:4px;font-weight:500;\">Hệ Thống Y Tế &amp; Chăm Sóc Sức Khỏe Tiêu Chuẩn Quốc Tế</div>");
        builder.append("</td>");
        builder.append("<td align=\"right\" style=\"vertical-align:middle;\">");
        builder.append("<span style=\"display:inline-block;background:rgba(255,255,255,0.18);color:#ffffff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:14px;letter-spacing:0.03em;white-space:nowrap;\">🚨 CẤP CỨU 24/7: 1900 1234</span>");
        builder.append("</td>");
        builder.append("</tr></table>");
        builder.append("</td></tr>");

        // Content body
        builder.append("<tr><td style=\"padding:32px 32px 28px;\">");
        builder.append("<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;\">");
        builder.append(escapeHtml(preheader));
        builder.append("</div>");

        // Category badge
        builder.append(buildBadgeHtml(templateKey));

        // Subject
        builder.append("<h1 style=\"margin:0 0 16px;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;\">");
        builder.append(escapeHtml(subject));
        builder.append("</h1>");

        if (isOtp(templateKey)) {
            String code = firstNonBlank(variables.get("code"), "******");
            String minutes = firstNonBlank(variables.get("minutes"), "10");

            builder.append("<p style=\"margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;\">");
            builder.append("Xin chào quý khách,<br>Hệ thống nhận được yêu cầu xác thực tài khoản từ bạn. Dưới đây là mã bảo mật dùng một lần (OTP) của bạn:");
            builder.append("</p>");

            // Highlighted OTP Box
            builder.append("<div style=\"background:#f0fdfa;border:2px dashed #0d9488;border-radius:12px;padding:24px;text-align:center;margin:24px 0;\">");
            builder.append("<div style=\"font-size:11px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px;\">MÃ XÁC THỰC CỦA BẠN</div>");
            builder.append("<div style=\"font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#0f766e;margin:10px 0;\">");
            builder.append(escapeHtml(code));
            builder.append("</div>");
            builder.append("<div style=\"display:inline-block;background:#ccfbf1;color:#0f766e;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-top:6px;\">");
            builder.append("⏱️ Có hiệu lực trong ").append(escapeHtml(minutes)).append(" phút");
            builder.append("</div>");
            if (isBookingOtp(templateKey) && variables.containsKey("bookingCode")) {
                builder.append("<div style=\"margin-top:12px;font-size:14px;color:#0f766e;font-weight:600;\">");
                builder.append("Mã đặt lịch: ").append(escapeHtml(variables.get("bookingCode")));
                builder.append("</div>");
            }
            builder.append("</div>");

            // Security callout
            builder.append("<div style=\"background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:20px 0;font-size:13px;color:#92400e;line-height:1.5;\">");
            builder.append("<strong>🔒 Lưu ý an toàn:</strong> Tuyệt đối không cung cấp mã này cho người khác (kể cả nhân viên y tế). HealthCare không bao giờ liên hệ yêu cầu đọc mã OTP.");
            builder.append("</div>");
        } else {
            String accentColor = getCategoryAccentColor(templateKey);
            builder.append("<div style=\"background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ")
                .append(accentColor)
                .append(";border-radius:10px;padding:20px 24px;margin:20px 0;color:#1e293b;font-size:15px;line-height:1.65;\">");
            String message = firstNonBlank(variables.get("message"), "Có một cập nhật mới từ HealthCare.");
            for (String paragraph : splitParagraphs(message)) {
                builder.append("<p style=\"margin:0 0 12px;color:#1e293b;\">")
                    .append(escapeHtml(paragraph).replace("\n", "<br>"))
                    .append("</p>");
            }
            builder.append("</div>");
            builder.append(buildContextualGuidanceHtml(templateKey));
        }

        if (portalUrl != null) {
            builder.append("<div style=\"text-align:center;margin:28px 0 16px;\">");
            builder.append("<a href=\"");
            builder.append(escapeHtmlAttribute(portalUrl));
            builder.append("\" style=\"display:inline-block;min-height:44px;line-height:44px;padding:0 28px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 4px rgba(15,118,110,0.2);\">");
            builder.append(escapeHtml(ctaButtonLabel(templateKey)));
            builder.append("</a>");
            builder.append("</div>");
        }

        // Divider
        builder.append("<div style=\"border-top:1px solid #e2e8f0;margin:32px 0 20px;\"></div>");

        // Professional Medical Footer
        builder.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"font-size:12px;color:#64748b;line-height:1.6;\"><tr><td>");
        builder.append("<div style=\"font-weight:700;color:#334155;font-size:13px;margin-bottom:6px;\">HỆ THỐNG Y TẾ QUỐC TẾ HEALTHCARE</div>");
        builder.append("<div>📍 123 Đường Sức Khỏe, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh</div>");
        builder.append("<div>📞 Hotline Cấp cứu &amp; Đặt khám: <strong style=\"color:#0f766e;\">1900 1234</strong> (24/7) | Email: <a href=\"mailto:cskh@healthcare.id.vn\" style=\"color:#0f766e;text-decoration:none;\">cskh@healthcare.id.vn</a></div>");
        builder.append("<div>🌐 Cổng dịch vụ trực tuyến: <a href=\"https://www.healthcare.id.vn\" style=\"color:#0f766e;text-decoration:none;font-weight:600;\">www.healthcare.id.vn</a></div>");
        builder.append("<div style=\"margin-top:12px;color:#94a3b8;font-size:11px;border-top:1px dashed #e2e8f0;padding-top:10px;\">");
        builder.append(escapeHtml(FOOTER));
        builder.append("<br><span style=\"color:#94a3b8;font-size:10px;line-height:1.4;\">🔒 Tuyên bố bảo mật: Thông tin trong email này chứa dữ liệu y tế cá nhân thuộc quyền sở hữu của người nhận và được bảo vệ theo Luật Khám bệnh, chữa bệnh số 15/2023/QH15.</span>");
        builder.append("<br>© 2026 HealthCare Hospital System. Tất cả các quyền được bảo lưu.</div>");
        builder.append("</td></tr></table>");

        builder.append("</td></tr></table>");
        builder.append("</td></tr></table>");
        builder.append("</body></html>");
        return builder.toString();
    }

    private String buildBadgeHtml(EmailTemplateKey templateKey) {
        String bg;
        String border;
        String color;
        String text;
        switch (templateKey) {
            case EMAIL_VERIFICATION -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "🔒 Xác minh tài khoản";
            }
            case PASSWORD_RESET -> {
                bg = "#fffbeb"; border = "#fde68a"; color = "#b45309"; text = "🔐 Đặt lại mật khẩu";
            }
            case BOOKING_OTP -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "📅 Xác nhận đặt lịch";
            }
            case BOOKING_VERIFICATION_OTP -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "📅 Xác thực lịch hẹn";
            }
            case APPOINTMENT_CONFIRMATION -> {
                bg = "#ecfdf5"; border = "#a7f3d0"; color = "#047857"; text = "✅ Lịch khám đã được xác nhận";
            }
            case APPOINTMENT_CHANGE -> {
                bg = "#f0f9ff"; border = "#bae6fd"; color = "#0369a1"; text = "🔄 Lịch khám đã được thay đổi";
            }
            case APPOINTMENT_CANCEL -> {
                bg = "#fff1f2"; border = "#fecdd3"; color = "#be123c"; text = "❌ Lịch khám đã được hủy";
            }
            case PAYMENT_STATUS -> {
                bg = "#eef2ff"; border = "#c7d2fe"; color = "#4338ca"; text = "💳 Cập nhật thanh toán viện phí";
            }
            case RESULTS_READY -> {
                bg = "#eff6ff"; border = "#bfdbfe"; color = "#1d4ed8"; text = "📋 Kết quả cận lâm sàng";
            }
            case PRESCRIPTION_READY -> {
                bg = "#faf5ff"; border = "#e9d5ff"; color = "#7e22ce"; text = "💊 Toa thuốc điện tử mới";
            }
            case CONSULTATION_REPLY -> {
                bg = "#ecfeff"; border = "#a5f3fc"; color = "#0e7490"; text = "💬 Phản hồi tư vấn y khoa";
            }
            case CARE_PLAN_REMINDER -> {
                bg = "#fffbeb"; border = "#fde68a"; color = "#b45309"; text = "🔔 Nhắc nhở chăm sóc sức khỏe";
            }
            case SYSTEM_NOTIFICATION -> {
                bg = "#f8fafc"; border = "#cbd5e1"; color = "#334155"; text = "📢 Thông báo từ bệnh viện";
            }
            default -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Thông báo y tế";
            }
        }
        return "<div style=\"display:inline-block;background:" + bg + ";color:" + color + ";border:1px solid "
            + border + ";font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:16px;\">"
            + escapeHtml(text) + "</div>";
    }

    private String getCategoryAccentColor(EmailTemplateKey templateKey) {
        return switch (templateKey) {
            case APPOINTMENT_CONFIRMATION -> "#059669";
            case APPOINTMENT_CHANGE -> "#0284c7";
            case APPOINTMENT_CANCEL -> "#e11d48";
            case PAYMENT_STATUS -> "#4f46e5";
            case RESULTS_READY -> "#2563eb";
            case PRESCRIPTION_READY -> "#9333ea";
            case CONSULTATION_REPLY -> "#0891b2";
            case CARE_PLAN_REMINDER -> "#d97706";
            default -> "#0d9488";
        };
    }

    private String buildContextualGuidanceHtml(EmailTemplateKey templateKey) {
        return switch (templateKey) {
            case APPOINTMENT_CONFIRMATION, APPOINTMENT_CHANGE ->
                "<div style=\"background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0d9488;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#334155;line-height:1.6;\">"
                + "<strong style=\"color:#0f766e;\">📌 Hướng dẫn chuẩn bị trước khi khám:</strong>"
                + "<ul style=\"margin:8px 0 0;padding-left:18px;color:#475569;\">"
                + "<li>Quý khách vui lòng có mặt trước giờ hẹn 15 phút tại quầy tiếp đón để hoàn tất thủ tục check-in.</li>"
                + "<li>Mang theo Căn cước công dân (CCCD), thẻ BHYT (nếu có) và hồ sơ hoặc kết quả khám trước đó.</li>"
                + "<li>Đối với xét nghiệm máu hoặc nội soi tiêu hóa, quý khách nên nhịn ăn sáng trước giờ khám.</li>"
                + "</ul>"
                + "</div>";
            case APPOINTMENT_CANCEL ->
                "<div style=\"background:#fff1f2;border:1px solid #fecdd3;border-left:4px solid #f43f5e;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#9f1239;line-height:1.6;\">"
                + "<strong>ℹ️ Hỗ trợ đặt lại lịch hẹn:</strong> Lịch khám đã được hủy thành công. Nếu quý khách muốn đặt lại thời gian khám khác thuận tiện hơn, vui lòng truy cập Cổng bệnh nhân hoặc gọi Hotline <strong>1900 1234</strong> để được nhân viên y tế hỗ trợ kịp thời."
                + "</div>";
            case PAYMENT_STATUS ->
                "<div style=\"background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#166534;line-height:1.6;\">"
                + "<strong>🔒 Giao dịch an toàn &amp; Bảo mật:</strong> Hóa đơn điện tử hợp lệ đã được lưu trữ an toàn trong hồ sơ viện phí trực tuyến của quý khách. Mọi thắc mắc về đối soát giao dịch, xin vui lòng liên hệ phòng Tài chính - Kế toán qua hotline 1900 1234."
                + "</div>";
            case RESULTS_READY ->
                "<div style=\"background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#1e40af;line-height:1.6;\">"
                + "<strong>🔒 Bảo mật hồ sơ bệnh án:</strong> Vì lý do bảo mật dữ liệu y tế cá nhân theo quy định của Bộ Y Tế, chi tiết kết quả cận lâm sàng chỉ hiển thị khi quý khách đăng nhập vào tài khoản bệnh nhân chính chủ."
                + "</div>";
            case PRESCRIPTION_READY ->
                "<div style=\"background:#faf5ff;border:1px solid #e9d5ff;border-left:4px solid #9333ea;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#6b21a8;line-height:1.6;\">"
                + "<strong>⚠️ Hướng dẫn an toàn dùng thuốc:</strong> Quý khách vui lòng dùng thuốc đúng liều lượng, đúng giờ và đủ liệu trình theo chỉ định của bác sĩ. Không tự ý chia sẻ đơn thuốc hoặc tự ý ngừng thuốc khi thấy triệu chứng thuyên giảm."
                + "</div>";
            case CONSULTATION_REPLY ->
                "<div style=\"background:#ecfeff;border:1px solid #a5f3fc;border-left:4px solid #0891b2;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#155e75;line-height:1.6;\">"
                + "<strong>🩺 Lưu ý y khoa:</strong> Ý kiến tư vấn trực tuyến mang tính chất định hướng lâm sàng ban đầu. Trường hợp người bệnh có các biểu hiện cấp tính (khó thở, đau thắt ngực, sốt cao co giật), vui lòng gọi cấp cứu 115 hoặc đến ngay cơ sở y tế gần nhất."
                + "</div>";
            case CARE_PLAN_REMINDER ->
                "<div style=\"background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#92400e;line-height:1.6;\">"
                + "<strong>💡 Lời khuyên sức khỏe:</strong> Tuân thủ phác đồ theo dõi và chế độ dinh dưỡng hàng ngày giúp tăng hiệu quả điều trị và phục hồi thể trạng nhanh chóng. Hãy cập nhật chỉ số sức khỏe định kỳ trên cổng bệnh nhân."
                + "</div>";
            default -> "";
        };
    }

    private String contextualTextGuidance(EmailTemplateKey templateKey) {
        return switch (templateKey) {
            case APPOINTMENT_CONFIRMATION, APPOINTMENT_CHANGE ->
                "Lưu ý trước khi khám: Quý khách vui lòng có mặt trước 15 phút, mang theo CCCD, thẻ BHYT (nếu có) và kết quả khám cũ.";
            case APPOINTMENT_CANCEL ->
                "Hỗ trợ đặt lại: Quý khách có thể đặt lại lịch khám qua Cổng bệnh nhân hoặc Tổng đài 1900 1234 (24/7).";
            case PAYMENT_STATUS ->
                "Giao dịch an toàn: Hóa đơn điện tử hợp lệ đã được lưu trữ trong hồ sơ viện phí trực tuyến của quý khách.";
            case RESULTS_READY ->
                "Bảo mật: Kết quả xét nghiệm chỉ hiển thị đầy đủ khi quý khách đăng nhập tài khoản chính chủ.";
            case PRESCRIPTION_READY ->
                "Lưu ý: Dùng thuốc đúng liều lượng, đúng giờ và đủ liệu trình theo chỉ định của bác sĩ.";
            case CONSULTATION_REPLY ->
                "Lưu ý: Tư vấn trực tuyến mang tính định hướng ban đầu. Trường hợp cấp tính, hãy đến ngay cơ sở y tế gần nhất.";
            case CARE_PLAN_REMINDER ->
                "Lời khuyên: Tuân thủ phác đồ điều trị và tái khám đúng hẹn để đảm bảo hiệu quả điều trị.";
            default -> "";
        };
    }

    private String ctaButtonLabel(EmailTemplateKey templateKey) {
        return switch (templateKey) {
            case EMAIL_VERIFICATION, PASSWORD_RESET -> "Đăng nhập cổng bệnh nhân";
            case BOOKING_OTP, BOOKING_VERIFICATION_OTP -> "Kiểm tra lịch đặt khám";
            case APPOINTMENT_CONFIRMATION, APPOINTMENT_CHANGE -> "Xem chi tiết lịch hẹn";
            case APPOINTMENT_CANCEL -> "Truy cập cổng đặt lịch";
            case PAYMENT_STATUS -> "Xem biên lai thanh toán";
            case RESULTS_READY -> "Xem kết quả xét nghiệm";
            case PRESCRIPTION_READY -> "Xem toa thuốc điện tử";
            case CONSULTATION_REPLY -> "Xem phản hồi bác sĩ";
            case CARE_PLAN_REMINDER -> "Xem kế hoạch chăm sóc";
            case SYSTEM_NOTIFICATION -> "Đăng nhập cổng bệnh nhân";
        };
    }


    private List<String> splitParagraphs(String textBody) {
        String normalized = textBody == null ? "" : textBody.strip().replace("\r\n", "\n");
        if (normalized.isBlank()) {
            return List.of("");
        }
        String[] rawParagraphs = normalized.split("\\n\\s*\\n");
        List<String> paragraphs = new ArrayList<>(rawParagraphs.length);
        for (String paragraph : rawParagraphs) {
            paragraphs.add(paragraph.stripTrailing());
        }
        return paragraphs;
    }

    private String firstNonBlank(String first, String fallback) {
        if (first != null && !first.isBlank()) {
            return first.strip();
        }
        return fallback;
    }

    private String sanitizeSubject(String subject) {
        if (subject == null) {
            return "";
        }
        return subject.replace("\r", " ").replace("\n", " ").replace("<", "").replace(">", "").strip();
    }

    private String safePortalUrl(String portalUrl) {
        if (portalUrl == null || portalUrl.isBlank()) {
            return null;
        }
        if (portalOrigin == null || portalUrl.indexOf('\\') >= 0
                || portalUrl.codePoints().anyMatch(Character::isISOControl)) {
            return null;
        }
        try {
            URI uri = URI.create(portalUrl.trim());
            String scheme = uri.getScheme();
            if (scheme == null) {
                return null;
            }
            String lowerScheme = scheme.toLowerCase(Locale.ROOT);
            if (!"http".equals(lowerScheme) && !"https".equals(lowerScheme)) {
                return null;
            }
            if (uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !sameOrigin(uri, portalOrigin) || uri.getPath() == null || !uri.getPath().startsWith("/")) {
                return null;
            }
            return uri.toString();
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private URI parsePortalOrigin(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) return null;
        try {
            URI uri = URI.create(baseUrl.trim());
            if (uri.getScheme() == null || uri.getHost() == null || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                return null;
            }
            return new URI(uri.getScheme().toLowerCase(Locale.ROOT), null, uri.getHost().toLowerCase(Locale.ROOT),
                uri.getPort(), null, null, null);
        } catch (Exception exception) {
            return null;
        }
    }

    private boolean sameOrigin(URI candidate, URI origin) {
        return candidate.getScheme().equalsIgnoreCase(origin.getScheme())
            && candidate.getHost().equalsIgnoreCase(origin.getHost())
            && candidate.getPort() == origin.getPort();
    }

    private String escapeHtml(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        for (char ch : value.toCharArray()) {
            switch (ch) {
                case '&' -> escaped.append("&amp;");
                case '<' -> escaped.append("&lt;");
                case '>' -> escaped.append("&gt;");
                case '"' -> escaped.append("&quot;");
                case '\'' -> escaped.append("&#39;");
                default -> escaped.append(ch);
            }
        }
        return escaped.toString();
    }

    private String escapeHtmlAttribute(String value) {
        return escapeHtml(value).replace("\n", "").replace("\r", "");
    }
}
