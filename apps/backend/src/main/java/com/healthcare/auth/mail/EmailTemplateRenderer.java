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
        String htmlBody = buildHtml(subject, preheader, textBody, safePortalUrl(safeVariables.get("portalUrl")));
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

    private String buildHtml(String subject, String preheader, String textBody, String portalUrl) {
        StringBuilder builder = new StringBuilder();
        builder.append("<html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>");
        builder.append(escapeHtml(subject));
        builder.append("</title></head><body style=\"margin:0;padding:0;background:#f7faf8;color:#15323a;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;\">");
        builder.append("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f7faf8;padding:24px 0;\"><tr><td align=\"center\">");
        builder.append("<table role=\"presentation\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" style=\"width:600px;max-width:600px;background:#ffffff;border:1px solid #dff7ef;border-radius:12px;overflow:hidden;\"><tr><td style=\"padding:32px;\">");
        builder.append("<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;\">");
        builder.append(escapeHtml(preheader));
        builder.append("</div><div style=\"margin:0 0 16px;color:#0f766e;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;\">");
        builder.append(BRAND);
        builder.append("</div><h1 style=\"margin:0 0 20px;font-size:24px;line-height:1.3;color:#15323a;font-weight:700;\">");
        builder.append(escapeHtml(subject));
        builder.append("</h1>");

        for (String paragraph : splitParagraphs(textBody)) {
            builder.append("<p style=\"margin:0 0 16px;color:#15323a;\">")
                .append(escapeHtml(paragraph).replace("\n", "<br>"))
                .append("</p>");
        }

        if (portalUrl != null) {
            builder.append("<p style=\"margin:24px 0 0;\"><a href=\"");
            builder.append(escapeHtmlAttribute(portalUrl));
            builder.append("\" style=\"display:inline-block;min-height:44px;line-height:44px;padding:0 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;\">Đăng nhập cổng bệnh nhân</a></p>");
        }

        builder.append("<p style=\"margin:24px 0 0;color:#4b5563;font-size:14px;\">");
        builder.append(escapeHtml(FOOTER));
        builder.append("</p></td></tr></table></td></tr></table></body></html>");
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
