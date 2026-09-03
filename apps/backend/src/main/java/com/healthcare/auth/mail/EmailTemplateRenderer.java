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
        switch (templateKey) {
            case EMAIL_VERIFICATION, PASSWORD_RESET, BOOKING_OTP, BOOKING_VERIFICATION_OTP -> {
                String code = firstNonBlank(variables.get("code"), "******");
                String minutes = firstNonBlank(variables.get("minutes"), "10");
                lines.add("Mã xác minh của bạn là " + code + ".");
                if (isBookingOtp(templateKey) && variables.containsKey("bookingCode")) {
                    lines.add("Mã đặt lịch: " + variables.get("bookingCode") + ".");
                }
                lines.add("Mã này hết hạn sau " + minutes + " phút.");
            }
            default -> {
                String message = firstNonBlank(variables.get("message"), "Có một cập nhật mới từ HealthCare.");
                lines.add(message);
            }
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

        // Header brand banner
        builder.append("<tr><td style=\"background:linear-gradient(135deg,#0f766e 0%,#0d9488 50%,#14b8a6 100%);padding:28px 32px;text-align:left;\">");
        builder.append("<div style=\"color:#ffffff;font-size:16px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;\">🏥 BỆNH VIỆN ĐA KHOA QUỐC TẾ HEALTHCARE</div>");
        builder.append("<div style=\"color:#ccfbf1;font-size:12px;margin-top:4px;font-weight:500;\">Hệ Thống Y Tế &amp; Chăm Sóc Sức Khỏe Tiêu Chuẩn Quốc Tế</div>");
        builder.append("</td></tr>");

        // Content body
        builder.append("<tr><td style=\"padding:32px 32px 28px;\">");
        builder.append("<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;\">");
        builder.append(escapeHtml(preheader));
        builder.append("</div>");

        // Category badge
        builder.append("<div style=\"display:inline-block;background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:16px;\">");
        builder.append(isOtp(templateKey) ? "Xác thực bảo mật" : "Thông báo y tế");
        builder.append("</div>");

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
            builder.append("<div style=\"background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0;color:#1e293b;font-size:15px;line-height:1.6;\">");
            for (String paragraph : splitParagraphs(textBody)) {
                builder.append("<p style=\"margin:0 0 12px;color:#1e293b;\">")
                    .append(escapeHtml(paragraph).replace("\n", "<br>"))
                    .append("</p>");
            }
            builder.append("</div>");
        }

        if (portalUrl != null) {
            builder.append("<div style=\"text-align:center;margin:28px 0 16px;\">");
            builder.append("<a href=\"");
            builder.append(escapeHtmlAttribute(portalUrl));
            builder.append("\" style=\"display:inline-block;min-height:44px;line-height:44px;padding:0 28px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 4px rgba(15,118,110,0.2);\">Đăng nhập cổng bệnh nhân</a>");
            builder.append("</div>");
        }

        // Divider
        builder.append("<div style=\"border-top:1px solid #e2e8f0;margin:32px 0 20px;\"></div>");

        // Professional Medical Footer
        builder.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"font-size:12px;color:#64748b;line-height:1.6;\"><tr><td>");
        builder.append("<div style=\"font-weight:700;color:#334155;font-size:13px;margin-bottom:6px;\">HỆ THỐNG Y TẾ QUỐC TẾ HEALTHCARE</div>");
        builder.append("<div>📍 123 Đường Sức Khỏe, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh</div>");
        builder.append("<div>📞 Hotline Cấp cứu &amp; Đặt khám: <strong style=\"color:#0f766e;\">1900 1234</strong> (24/7)</div>");
        builder.append("<div>🌐 Cổng dịch vụ trực tuyến: <a href=\"https://healthcare-two-olive.vercel.app\" style=\"color:#0f766e;text-decoration:none;\">healthcare-two-olive.vercel.app</a></div>");
        builder.append("<div style=\"margin-top:12px;color:#94a3b8;font-size:11px;border-top:1px dashed #e2e8f0;padding-top:10px;\">");
        builder.append(escapeHtml(FOOTER));
        builder.append("<br>© 2026 HealthCare Hospital System. Tất cả các quyền được bảo lưu.</div>");
        builder.append("</td></tr></table>");

        builder.append("</td></tr></table>");
        builder.append("</td></tr></table>");
        builder.append("</body></html>");
        return builder.toString();
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
