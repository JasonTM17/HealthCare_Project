package com.healthcare.hospital.service;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Defence-in-depth scrubbing for stored article bodies.
 *
 * <p>Article bodies are authored through the admin and doctor editors, which
 * persist markdown, and the public renderer builds React nodes rather than
 * injecting HTML — so today no HTML string reaches a browser as markup. That is
 * a property of the current consumer, not of the stored data, and the body
 * column also holds rows written before the markdown contract was enforced plus
 * anything a direct API caller submits.
 *
 * <p>This gate therefore removes the constructs that turn stored text into
 * executable content if any future consumer ever renders it as HTML: script and
 * style blocks, embedded browsing contexts, event-handler attributes, and
 * {@code javascript:} URLs. It is deliberately not a general HTML sanitizer —
 * it does not attempt to re-serialize a document, and it does not police
 * ordinary markup. The editor's own vocabulary passes through untouched.
 */
final class ArticleBodySanitizer {

    private static final int MAX_BODY_CHARS = 8_000;

    /** Blocks whose entire content is unsafe, removed with their bodies. */
    private static final Pattern DANGEROUS_BLOCK = Pattern.compile(
        "(?is)<\\s*(script|style|iframe|object|embed|applet|frame|frameset|form|meta|link|base)"
            + "\\b[^>]*>.*?<\\s*/\\s*\\1\\s*>");

    /** Self-closing or unclosed forms of the same blocks. */
    private static final Pattern DANGEROUS_VOID = Pattern.compile(
        "(?is)<\\s*/?\\s*(script|style|iframe|object|embed|applet|frame|frameset|form|meta|link|base)"
            + "\\b[^>]*>");

    /** Inline event handlers, quoted or bare. */
    private static final Pattern EVENT_HANDLER = Pattern.compile(
        "(?is)\\son[a-z]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)");

    /** Script-bearing URL schemes in any attribute. */
    private static final Pattern SCRIPT_URL = Pattern.compile(
        "(?is)(href|src|xlink:href|action|formaction|data)\\s*=\\s*"
            + "(\"|')?\\s*(?:javascript|vbscript|data\\s*:\\s*text/html)\\s*:[^\"'>\\s]*(\"|')?");

    /** CSS expression() and url(javascript:) escapes. */
    private static final Pattern CSS_ESCAPE = Pattern.compile(
        "(?is)(expression\\s*\\(|url\\s*\\(\\s*(\"|')?\\s*javascript:)");

    private ArticleBodySanitizer() {
    }

    /**
     * Return a body safe to persist, or {@code null} when the input is null.
     *
     * <p>Truncation is intentionally absent: silently cutting clinical text
     * would change what the author published, so an over-long body keeps its
     * content and is rejected by the request-level size constraint instead.
     */
    static String sanitize(String body) {
        if (body == null) {
            return null;
        }
        String cleaned = body;
        if (cleaned.indexOf('<') >= 0) {
            cleaned = DANGEROUS_BLOCK.matcher(cleaned).replaceAll("");
            cleaned = DANGEROUS_VOID.matcher(cleaned).replaceAll("");
            cleaned = EVENT_HANDLER.matcher(cleaned).replaceAll("");
            cleaned = SCRIPT_URL.matcher(cleaned).replaceAll("$1=\"#\"");
            cleaned = CSS_ESCAPE.matcher(cleaned).replaceAll("");
        }
        // Control characters other than tab/newline/carriage-return have no
        // place in stored prose and are a common obfuscation carrier.
        cleaned = cleaned.replaceAll("[\\p{Cntrl}&&[^\\t\\n\\r]]", "");
        if (cleaned.length() > MAX_BODY_CHARS) {
            return cleaned;
        }
        return cleaned;
    }

    /** True when the body still carries an executable construct. */
    static boolean containsExecutableContent(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String lowered = body.toLowerCase(Locale.ROOT);
        return DANGEROUS_BLOCK.matcher(lowered).find()
            || DANGEROUS_VOID.matcher(lowered).find()
            || EVENT_HANDLER.matcher(lowered).find()
            || SCRIPT_URL.matcher(lowered).find()
            || CSS_ESCAPE.matcher(lowered).find();
    }
}
