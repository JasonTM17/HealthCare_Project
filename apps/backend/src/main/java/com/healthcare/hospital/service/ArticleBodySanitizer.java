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

    /** Blocks whose entire content is unsafe, removed with their bodies. */
    private static final Pattern DANGEROUS_BLOCK = Pattern.compile(
        "(?is)<\\s*(script|style|iframe|object|embed|applet|frame|frameset|form|meta|link|base)"
            + "\\b[^>]*>.*?<\\s*/\\s*\\1\\s*>");

    /** Self-closing or unclosed forms of the same blocks. */
    private static final Pattern DANGEROUS_VOID = Pattern.compile(
        "(?is)<\\s*/?\\s*(script|style|iframe|object|embed|applet|frame|frameset|form|meta|link|base)"
            + "\\b[^>]*>");

    /** Inline event handlers. HTML5 accepts "/" as an attribute separator too. */
    private static final Pattern EVENT_HANDLER = Pattern.compile(
        "(?is)[\\s/]+on[a-z]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)");

    /**
     * Script-bearing URL schemes in any attribute. Browsers strip tab, newline
     * and carriage return from a URL before parsing the scheme, so the
     * separator class has to allow them inside the scheme itself.
     */
    private static final Pattern SCRIPT_URL = Pattern.compile(
        "(?is)(href|src|xlink:href|action|formaction)\\s*=\\s*"
            + "(\"|')?\\s*(?:java|vb)[\\s\\t\\n\\r]*script[\\s\\t\\n\\r]*:[^\"'>\\s]*(\"|')?"
            + "|(?is)(href|src|xlink:href|action|formaction)\\s*=\\s*"
            + "(\"|')?\\s*data\\s*:\\s*text/html[^\"'>\\s]*(\"|')?");

    /** CSS expression() and url(javascript:) escapes. */
    private static final Pattern CSS_ESCAPE = Pattern.compile(
        "(?is)(expression\\s*\\(|url\\s*\\(\\s*(\"|')?\\s*(?:java|vb)[\\s\\t\\n\\r]*script\\s*:)");

    /** Control characters with no place in stored prose, and a common carrier. */
    private static final Pattern CONTROL_CHARACTERS = Pattern.compile(
        "[\\p{Cntrl}&&[^\\t\\n\\r]]");

    private ArticleBodySanitizer() {
    }

    /**
     * Return a body safe to persist, or {@code null} when the input is null.
     *
     * <p>Control characters are removed <em>first</em>. Stripping them last
     * reassembled the very tags the earlier passes had removed: a body written
     * as {@code <scr\0ipt>} survived the tag passes as {@code <scr\0ipt>}, and
     * deleting the null afterwards produced a working {@code <script>}.
     *
     * <p>Truncation is intentionally absent: silently cutting clinical text
     * would change what the author published, so an over-long body keeps its
     * content and is rejected by the request-level size constraint instead.
     */
    static String sanitize(String body) {
        if (body == null) {
            return null;
        }
        String cleaned = CONTROL_CHARACTERS.matcher(body).replaceAll("");
        if (cleaned.indexOf('<') >= 0) {
            cleaned = DANGEROUS_BLOCK.matcher(cleaned).replaceAll("");
            cleaned = DANGEROUS_VOID.matcher(cleaned).replaceAll("");
            cleaned = EVENT_HANDLER.matcher(cleaned).replaceAll("");
            cleaned = SCRIPT_URL.matcher(cleaned).replaceAll("$1=\"#\"");
            cleaned = CSS_ESCAPE.matcher(cleaned).replaceAll("");
        }
        return cleaned;
    }

    /**
     * True when the body still carries an executable construct.
     *
     * <p>Reports what this gate can recognise, not a proof of safety: it exists
     * so a caller can assert a body was cleaned, and it shares the patterns
     * above rather than promising more than they check.
     */
    static boolean containsExecutableContent(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String lowered = CONTROL_CHARACTERS.matcher(body).replaceAll("").toLowerCase(Locale.ROOT);
        return DANGEROUS_BLOCK.matcher(lowered).find()
            || DANGEROUS_VOID.matcher(lowered).find()
            || EVENT_HANDLER.matcher(lowered).find()
            || SCRIPT_URL.matcher(lowered).find()
            || CSS_ESCAPE.matcher(lowered).find();
    }
}
