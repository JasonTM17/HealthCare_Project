package com.healthcare.auth.mail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * HTTPS email delivery through the Resend transactional API
 * ({@link https://api.resend.com/emails}). Render Free cannot reach outbound
 * SMTP (smtp.gmail.com:587 connection attempts time out even with a 20s
 * budget), while HTTPS egress works — so when an API key is configured the
 * send goes over HTTPS, and without a key this sender defers to the SMTP
 * implementation.
 *
 * <p>The API key is read from the environment ({@code RESEND_API_KEY} via
 * {@code app.mail.resend-api-key}) and is never logged. The recipient and the
 * provider response body are logged on failure for diagnosability.</p>
 */
@Component
@Primary
@ConditionalOnProperty(prefix = "app.mail", name = "enabled", havingValue = "true")
public class ApiEmailSender implements EmailSender, RichEmailDelivery {

    private static final Logger log = LoggerFactory.getLogger(ApiEmailSender.class);
    private static final String RESEND_ENDPOINT = "https://api.resend.com/emails";

    private final String apiKey;
    private final String from;
    private final ObjectProvider<SmtpEmailSender> smtpFallback;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper =
        new com.fasterxml.jackson.databind.ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    public ApiEmailSender(@Value("${app.mail.resend-api-key:}") String apiKey,
                          @Value("${app.mail.from:no-reply@healthcare.local}") String from,
                          ObjectProvider<SmtpEmailSender> smtpFallback) {
        this.apiKey = apiKey == null ? "" : apiKey.strip();
        this.from = from;
        this.smtpFallback = smtpFallback;
    }

    @Override
    public void send(String recipient, String subject, String body) {
        if (apiKey.isEmpty()) {
            smtpFallback.getObject().send(recipient, subject, body);
            return;
        }
        String escaped = body == null ? "" : body
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        sendRich(recipient, subject, "<pre style=\"font-family:inherit;white-space:pre-wrap\">" + escaped + "</pre>", body);
    }

    @Override
    public void sendRich(String recipient, String subject, String htmlBody, String plainTextBody) {
        sendRichWithMessageId(recipient, subject, htmlBody, plainTextBody, null);
    }

    public void sendRichWithMessageId(String recipient, String subject, String htmlBody,
                                      String plainTextBody, String messageId) {
        if (apiKey.isEmpty()) {
            smtpFallback.getObject().sendRichWithMessageId(recipient, subject, htmlBody, plainTextBody, messageId);
            return;
        }
        try {
            var payload = objectMapper.createObjectNode();
            payload.put("from", from);
            payload.put("to", recipient);
            payload.put("subject", subject);
            payload.put("html", htmlBody == null ? "" : htmlBody);
            if (plainTextBody != null && !plainTextBody.isBlank()) {
                payload.put("text", plainTextBody);
            }
            if (messageId != null && !messageId.isBlank()) {
                var headers = payload.putObject("headers");
                headers.put("Message-ID", "<" + messageId.replaceAll("[^A-Za-z0-9._-]", "") + "@healthcare.local>");
            }
            HttpRequest request = HttpRequest.newBuilder(URI.create(RESEND_ENDPOINT))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                log.warn("Resend API send failed recipient={} status={} body={}",
                    recipient, response.statusCode(),
                    response.body() == null ? "" : response.body().substring(0, Math.min(400, response.body().length())));
                throw new com.healthcare.exception.BusinessException(
                    503,
                    com.healthcare.exception.ErrorCodes.EMAIL_DELIVERY_UNAVAILABLE,
                    "Email delivery is temporarily unavailable"
                );
            }
            log.info("Email delivered via Resend API recipient={} subject={}", recipient, subject);
        } catch (java.io.IOException | InterruptedException exception) {
            log.warn("Resend API send failed recipient={} transport error={}",
                recipient, exception.getMessage());
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new com.healthcare.exception.BusinessException(
                503,
                com.healthcare.exception.ErrorCodes.EMAIL_DELIVERY_UNAVAILABLE,
                "Email delivery is temporarily unavailable"
            );
        }
    }
}
