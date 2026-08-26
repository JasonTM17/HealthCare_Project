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
            assertFalse(rendered.textBody().isBlank());
        }
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
}
