package com.healthcare.auth.mail;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Sensitive delivery context. Only the recipient and code-owned template
 * variables are encrypted at rest. Rendered subject/HTML/plain text never
 * enter the outbox table and are materialized by the delivery worker.
 */
public record EmailOutboxPayload(String recipient, Map<String, String> variables) {

    private static final int MAX_VARIABLES = 32;
    private static final int MAX_KEY_LENGTH = 64;
    private static final int MAX_VALUE_LENGTH = 4_096;
    private static final int MAX_TOTAL_VALUE_LENGTH = 16_384;

    public EmailOutboxPayload {
        if (recipient == null || recipient.isBlank()) {
            throw new IllegalArgumentException("Email recipient is required");
        }
        recipient = recipient.trim().toLowerCase(Locale.ROOT);
        Map<String, String> source = variables == null ? Map.of() : variables;
        if (source.size() > MAX_VARIABLES) {
            throw new IllegalArgumentException("Too many email template variables");
        }
        int totalLength = 0;
        Map<String, String> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : source.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (key == null || key.isBlank() || key.length() > MAX_KEY_LENGTH || value == null) {
                throw new IllegalArgumentException("Invalid email template variable");
            }
            if (value.length() > MAX_VALUE_LENGTH) {
                throw new IllegalArgumentException("Email template variable is too long");
            }
            totalLength += value.length();
            if (totalLength > MAX_TOTAL_VALUE_LENGTH) {
                throw new IllegalArgumentException("Email template payload is too large");
            }
            normalized.put(key, value);
        }
        variables = Map.copyOf(normalized);
    }
}
