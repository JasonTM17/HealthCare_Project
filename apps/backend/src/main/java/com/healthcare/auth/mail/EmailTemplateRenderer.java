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
        String htmlBody = buildHtml(templateKey, safeVariables, subject, preheader, safePortalUrl(safeVariables.get("portalUrl")));
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
        String portalUrl
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append("<!DOCTYPE html>");
        builder.append("<html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>");
        builder.append(escapeHtml(subject));
        builder.append("</title></head><body style=\"margin:0;padding:0;background:#eef3f2;color:#17312e;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;\">");
        builder.append("<div aria-hidden=\"true\" style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;\">");
        builder.append(escapeHtml(preheader));
        builder.append("</div>");
        builder.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#eef3f2;\"><tr><td align=\"center\" style=\"padding:24px 12px 40px;\">");
        builder.append("<table role=\"presentation\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" style=\"width:100%;max-width:600px;background:#ffffff;border:1px solid #d9e5e2;\">");

        // Flat-color, table-based header remains legible in common mail clients.
        builder.append("<tr><td bgcolor=\"#0f766e\" style=\"background:#0f766e;padding:24px 32px;\">");
        builder.append("<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\"><tr>");
        builder.append("<td style=\"color:#ffffff;font-size:21px;font-weight:700;letter-spacing:0.03em;\">HealthCare</td>");
        builder.append("</tr></table></td></tr>");

        // Content body
        builder.append("<tr><td style=\"padding:32px 32px 28px;\">");
        // Category badge
        builder.append(buildBadgeHtml(templateKey));

        // Subject
        builder.append("<h1 style=\"margin:0 0 16px;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;\">");
        builder.append(escapeHtml(subject));
        builder.append("</h1>");

        if (isOtp(templateKey)) {
            String code = firstNonBlank(variables.get("code"), "******");
            String minutes = firstNonBlank(variables.get("minutes"), "10");

            builder.append("<p style=\"margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;\">");
            builder.append("Dùng mã dưới đây để hoàn tất yêu cầu của bạn. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.");
            builder.append("</p>");

            // Highlighted OTP Box
            builder.append("<div style=\"background:#f0f8f6;border:1px solid #b9dcd6;padding:24px 16px;text-align:center;margin:24px 0;\">");
            builder.append("<div style=\"font-size:12px;font-weight:700;color:#31635c;letter-spacing:0.08em;margin-bottom:8px;\">MÃ XÁC THỰC</div>");
            builder.append("<div style=\"font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:0.14em;color:#0b6259;margin:8px 0;\">");
            builder.append(escapeHtml(code));
            builder.append("</div>");
            builder.append("<div style=\"color:#31635c;font-size:13px;margin-top:8px;\">");
            builder.append("Có hiệu lực trong ").append(escapeHtml(minutes)).append(" phút");
            builder.append("</div>");
            if (isBookingOtp(templateKey) && variables.containsKey("bookingCode")) {
                builder.append("<div style=\"margin-top:12px;font-size:14px;color:#0f766e;font-weight:600;\">");
                builder.append("Mã đặt lịch: ").append(escapeHtml(variables.get("bookingCode")));
                builder.append("</div>");
            }
            builder.append("</div>");

            // Security callout
            builder.append("<div style=\"background:#fff9ed;border:1px solid #f0ddb6;padding:12px 16px;margin:20px 0;font-size:14px;color:#654a1f;line-height:1.5;\">");
            builder.append("<strong>Giữ mã riêng tư.</strong> Không chia sẻ mã xác thực với bất kỳ ai. Nhân viên hỗ trợ không cần biết mã này.");
            builder.append("</div>");
        } else {
            builder.append("<div style=\"background:#f6faf9;border:1px solid #d9e5e2;padding:18px 20px;margin:20px 0;color:#17312e;font-size:16px;line-height:1.6;\">");
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
            builder.append("<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:28px 0 14px;\"><tr><td bgcolor=\"#0f766e\" style=\"background:#0f766e;\"><a href=\"");
            builder.append(escapeHtmlAttribute(portalUrl));
            builder.append("\" style=\"display:inline-block;min-height:44px;line-height:44px;padding:0 24px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;\">");
            builder.append(escapeHtml(ctaButtonLabel(templateKey)));
            builder.append("</a></td></tr></table>");
            builder.append("<p style=\"margin:0 0 12px;color:#647b76;font-size:12px;overflow-wrap:anywhere;\">Nếu nút không mở được, dùng liên kết: <a href=\"")
                .append(escapeHtmlAttribute(portalUrl)).append("\" style=\"color:#0f766e;\">")
                .append(escapeHtml(portalUrl)).append("</a></p>");
        }

        // Divider
        builder.append("<div style=\"border-top:1px solid #e2e8f0;margin:32px 0 20px;\"></div>");

        // Keep operational contact details out of the template unless they are
        // supplied by an authoritative channel. The portal link above is vetted.
        builder.append("<p style=\"margin:0;color:#657b76;font-size:12px;line-height:1.6;\">");
        builder.append("Email tự động từ <strong style=\"color:#294a44;\">HealthCare</strong>. Vui lòng không trả lời trực tiếp email này.<br>");
        builder.append(escapeHtml(FOOTER));
        builder.append("</p>");

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
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Xác minh tài khoản";
            }
            case PASSWORD_RESET -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Đặt lại mật khẩu";
            }
            case BOOKING_OTP -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Xác nhận đặt lịch";
            }
            case BOOKING_VERIFICATION_OTP -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Xác thực lịch hẹn";
            }
            case APPOINTMENT_CONFIRMATION -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Lịch khám đã được xác nhận";
            }
            case APPOINTMENT_CHANGE -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Lịch khám đã được thay đổi";
            }
            case APPOINTMENT_CANCEL -> {
                bg = "#fff1f2"; border = "#fecdd3"; color = "#be123c"; text = "Lịch khám đã được hủy";
            }
            case PAYMENT_STATUS -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Cập nhật thanh toán";
            }
            case RESULTS_READY -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Kết quả cận lâm sàng";
            }
            case PRESCRIPTION_READY -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Toa thuốc điện tử mới";
            }
            case CONSULTATION_REPLY -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Phản hồi tư vấn y khoa";
            }
            case CARE_PLAN_REMINDER -> {
                bg = "#fffbeb"; border = "#fde68a"; color = "#b45309"; text = "Nhắc nhở chăm sóc sức khỏe";
            }
            case SYSTEM_NOTIFICATION -> {
                bg = "#f8fafc"; border = "#cbd5e1"; color = "#334155"; text = "Thông báo";
            }
            default -> {
                bg = "#f0fdfa"; border = "#99f6e4"; color = "#0f766e"; text = "Thông báo y tế";
            }
        }
        return "<div style=\"display:inline-block;background:" + bg + ";color:" + color + ";border:1px solid "
            + border + ";font-size:12px;font-weight:700;padding:5px 10px;letter-spacing:0.04em;margin-bottom:16px;\">"
            + escapeHtml(text) + "</div>";
    }

    private String buildContextualGuidanceHtml(EmailTemplateKey templateKey) {
        String title = switch (templateKey) {
            case APPOINTMENT_CONFIRMATION, APPOINTMENT_CHANGE -> "Trước buổi khám";
            case APPOINTMENT_CANCEL -> "Cần đặt lịch khác?";
            case PAYMENT_STATUS -> "Kiểm tra thanh toán";
            case RESULTS_READY -> "Bảo mật kết quả";
            case PRESCRIPTION_READY -> "Về toa thuốc";
            case CONSULTATION_REPLY -> "Về phản hồi tư vấn";
            case CARE_PLAN_REMINDER -> "Theo dõi kế hoạch";
            default -> "";
        };
        if (title.isBlank()) {
            return "";
        }
        return "<div style=\"background:#f6faf9;border:1px solid #d9e5e2;padding:14px 18px;margin:20px 0;color:#34544e;font-size:14px;line-height:1.55;\">"
            + "<strong>" + escapeHtml(title) + ":</strong> "
            + escapeHtml(contextualTextGuidance(templateKey)) + "</div>";
    }

    private String contextualTextGuidance(EmailTemplateKey templateKey) {
        return switch (templateKey) {
            case APPOINTMENT_CONFIRMATION, APPOINTMENT_CHANGE ->
                "Kiểm tra thời gian và địa điểm trong cổng bệnh nhân. Làm theo hướng dẫn chuẩn bị riêng do cơ sở khám cung cấp, nếu có.";
            case APPOINTMENT_CANCEL ->
                "Bạn có thể chọn thời gian khác trong cổng bệnh nhân nếu vẫn cần khám.";
            case PAYMENT_STATUS ->
                "Đối chiếu trạng thái và thông tin thanh toán trong cổng bệnh nhân trước khi thực hiện thêm giao dịch.";
            case RESULTS_READY ->
                "Đăng nhập cổng bệnh nhân để xem thông tin kết quả. Không chia sẻ đường dẫn hoặc thông tin tài khoản.";
            case PRESCRIPTION_READY ->
                "Xem toa thuốc và làm theo chỉ định cụ thể của bác sĩ; hỏi lại cơ sở khám nếu có điểm chưa rõ.";
            case CONSULTATION_REPLY ->
                "Đọc phản hồi trong cổng bệnh nhân. Nếu triệu chứng khẩn cấp, hãy tìm hỗ trợ y tế trực tiếp.";
            case CARE_PLAN_REMINDER ->
                "Xem các bước theo dõi và lịch nhắc trong kế hoạch chăm sóc của bạn.";
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
