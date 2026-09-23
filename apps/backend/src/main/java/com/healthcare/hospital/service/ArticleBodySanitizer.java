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
 *
 * <p>The raw-text and foreign-content elements are on the list for the
 * mutation-XSS class of defect, which is a parsing problem rather than a tag
 * problem. {@code <svg>}, {@code <math>}, {@code <template>}, {@code <noscript>},
 * {@code <xmp>}, {@code <plaintext>}, {@code <textarea>} and {@code <title>} each
 * hold their content under rules a second parser may not agree with: text that
 * is inert where it sits can be re-read as markup once a serializer moves it,
 * and {@code <plaintext>}, {@code <xmp>} and {@code <textarea>} swallow the rest
 * of the document because they never close. Removing them with their contents
 * keeps this a list of constructs rather than a list of tricks.
 */
final class ArticleBodySanitizer {

    /** Blocks whose entire content is unsafe, removed with their bodies. */
    private static final Pattern DANGEROUS_BLOCK = Pattern.compile(
        "(?is)<\\s*(script|style|iframe|object|embed|applet|frame|frameset|form|meta|link|base"
            + "|svg|math|template|noscript|xmp|plaintext|textarea|title)"
            + "\\b[^>]*>.*?<\\s*/\\s*\\1\\s*>");

    /** Self-closing or unclosed forms of the same blocks. */
    private static final Pattern DANGEROUS_VOID = Pattern.compile(
        "(?is)<\\s*/?\\s*(script|style|iframe|object|embed|applet|frame|frameset|form|meta|link|base"
            + "|svg|math|template|noscript|xmp|plaintext|textarea|title)"
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

    /**
     * Bound on the scrub loop. Every pass either leaves the string untouched
     * or makes it strictly shorter, so a fixed point is reached well within
     * this many iterations for any realistic input; the cap exists so a
     * pathological string fails closed (rejection) instead of spinning.
     */
    private static final int MAX_PASSES = 10;

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
     * <p>The same reassembly argument applies between the tag passes
     * themselves, so the sequence runs to a fixed point rather than once:
     * {@code <scr<iframe>ipt>} lost its {@code <iframe>} to the void-element
     * pass and closed up into a working {@code <script>}. Each iteration
     * strictly shrinks the string or stops, and the loop is capped at
     * {@value #MAX_PASSES} iterations; a body that neither settles nor
     * cleans within that budget is rejected with the same validation failure
     * the comment gate raises, as is anything still carrying an executable
     * construct at the fixed point.
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
        int passes = 0;
        String previous;
        do {
            previous = cleaned;
            if (previous.indexOf('<') >= 0) {
                cleaned = DANGEROUS_BLOCK.matcher(previous).replaceAll("");
                cleaned = DANGEROUS_VOID.matcher(cleaned).replaceAll("");
                cleaned = EVENT_HANDLER.matcher(cleaned).replaceAll("");
                cleaned = SCRIPT_URL.matcher(cleaned).replaceAll("$1=\"#\"");
                cleaned = CSS_ESCAPE.matcher(cleaned).replaceAll("");
            }
            if (++passes > MAX_PASSES) {
                throw unsafeContent();
            }
        } while (!cleaned.equals(previous));
        if (containsExecutableContent(cleaned)) {
            throw unsafeContent();
        }
        return cleaned;
    }

    /**
     * Fail closed with the request-level validation error the content gates
     * already raise (see {@code ArticleCommentService}), so a body this
     * sanitizer cannot vouch for is refused rather than silently stored.
     */
    private static com.healthcare.exception.BusinessException unsafeContent() {
        return new com.healthcare.exception.BusinessException(
            400,
            com.healthcare.exception.ErrorCodes.VALIDATION_ERROR,
            "Nội dung chứa mã hoặc thẻ HTML không an toàn.");
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
