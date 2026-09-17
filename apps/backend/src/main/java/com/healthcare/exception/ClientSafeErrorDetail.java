package com.healthcare.exception;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Decides whether an exception message is safe to return to a client.
 *
 * <p>This service deliberately routes user-ready Vietnamese domain copy through
 * {@link IllegalArgumentException}, {@link IllegalStateException} and
 * {@link NoSuchElementException}, and the API contract pins that passthrough.
 * The risk it carries is that the same types are also thrown by the JDK and by
 * libraries, where the message describes the implementation:
 * {@code UUID.fromString} answers "Invalid UUID string: &lt;raw input&gt;" and an
 * enum lookup answers "No enum constant com.healthcare.…", so a malformed
 * request could reflect internal class names and raw input back to the caller
 * through a 4xx body.
 *
 * <p>The rule is therefore narrow: keep a message that reads as prose the
 * product wrote, and withhold one that carries a Java identifier or a JDK
 * diagnostic shape. Withholding means the handler substitutes its generic
 * copy — the detail still reaches the server log, where it belongs.
 */
final class ClientSafeErrorDetail {

    /**
     * A fully-qualified Java type, for example com.healthcare.hospital.entity.Article.
     *
     * <p>Anchored to the root packages this application actually references
     * rather than "any lower.capital dotted token": a Vietnamese message may
     * legitimately name an app, a domain or a person ("mở app.VietMed để tiếp
     * tục", "bs.Long sẽ gọi lại"), and suppressing those would replace real
     * product copy with the generic fallback.
     */
    private static final Pattern JAVA_TYPE_REFERENCE = Pattern.compile(
        "\\b(?:com|org|net|io|java|javax|jakarta|sun|jdk)"
            + "(?:\\.[a-z][a-z0-9_]*)*\\.[A-Z][A-Za-z0-9_$]*\\b");

    /** Stack-frame or source-location fragments. */
    private static final Pattern SOURCE_LOCATION = Pattern.compile(
        "(?:\\.java:\\d+|\\.kt:\\d+|\\bat\\s+[a-z][\\w.$]*\\()");

    /** Diagnostics the JDK and common libraries produce verbatim. */
    private static final List<String> JDK_DIAGNOSTIC_PREFIXES = List.of(
        "no enum constant",
        "no value present",
        "invalid uuid string",
        "for input string",
        "cannot invoke",
        "cannot cast",
        "cannot be cast",
        "unsupported operation",
        "string index out of range",
        "array index out of range",
        "index out of bounds",
        "character ",
        "null pointer",
        "cannot parse",
        "failed to convert"
    );

    private ClientSafeErrorDetail() {
    }

    /**
     * Return the message when it can be shown to a caller, or {@code null} when
     * the handler should use its generic copy instead.
     */
    static String forClient(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String candidate = message.trim();
        if (JAVA_TYPE_REFERENCE.matcher(candidate).find()) {
            return null;
        }
        if (SOURCE_LOCATION.matcher(candidate).find()) {
            return null;
        }
        String lowered = candidate.toLowerCase(java.util.Locale.ROOT);
        for (String prefix : JDK_DIAGNOSTIC_PREFIXES) {
            if (lowered.startsWith(prefix)) {
                return null;
            }
        }
        // A single bare token is not a sentence a product would write for a
        // patient; it is almost always a reflected value.
        if (!candidate.contains(" ") && candidate.length() > 40) {
            return null;
        }
        return candidate;
    }
}
