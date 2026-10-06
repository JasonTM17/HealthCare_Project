package com.healthcare.hospital.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Direct coverage for the denylist behind the stored-body gate.
 *
 * <p>The sibling {@code com.healthcare.hospital.ArticleBodySanitizationTest}
 * drives this gate through {@code AdminArticleService} and pins what a stored
 * article body looks like. This suite stays on the gate itself, because the
 * carriers added here are a parsing problem rather than an article-pipeline
 * problem: {@code svg}, {@code math}, {@code template}, {@code noscript},
 * {@code xmp}, {@code plaintext}, {@code textarea} and {@code title} each hold
 * their content under rules a second parser may not agree with, so text that is
 * inert where it sits can be re-read as markup once a serializer moves it.
 *
 * <p>What has to be true is that the element goes <em>with its body</em>: a
 * scrub that removes the tag and keeps the payload has moved the problem rather
 * than removing it.
 */
class ArticleBodySanitizerTest {

    @Test
    void removesSvgWithItsPayload() {
        String stored = ArticleBodySanitizer.sanitize(
            "<p>Trước</p><svg><script>alert(1)</script><circle r=\"1\"/></svg><p>Sau</p>");

        assertThat(stored).doesNotContain("<svg");
        assertThat(stored).doesNotContain("alert(1)");
        assertThat(stored).contains("Trước");
        assertThat(stored).contains("Sau");
    }

    @Test
    void removesMathWithItsPayload() {
        String stored = ArticleBodySanitizer.sanitize(
            "<p>Liều</p><math><mtext><img src=x onerror=alert(1)></mtext></math>");

        assertThat(stored).doesNotContain("<math");
        assertThat(stored).doesNotContain("onerror");
        assertThat(stored).doesNotContain("alert(1)");
        assertThat(stored).contains("Liều");
    }

    @Test
    void removesTemplateWithItsPayload() {
        String stored = ArticleBodySanitizer.sanitize(
            "<template><img src=x onerror=alert(1)></template><p>Nội dung</p>");

        assertThat(stored).doesNotContain("<template");
        assertThat(stored).doesNotContain("onerror");
        assertThat(stored).contains("Nội dung");
    }

    @Test
    void removesNoscriptWithItsPayload() {
        String stored = ArticleBodySanitizer.sanitize(
            "<noscript><p>Bật JavaScript</p><img src=x onerror=alert(1)></noscript>");

        assertThat(stored).doesNotContain("<noscript");
        assertThat(stored).doesNotContain("onerror");
    }

    @Test
    void removesRawTextCarriersWithTheirContent() {
        // xmp and textarea are RCDATA/raw text: a parser reads their content as
        // text, and a serializer that moves it can hand it back as markup.
        assertThat(ArticleBodySanitizer.sanitize("<xmp><img src=x onerror=alert(1)></xmp>"))
            .doesNotContain("<xmp").doesNotContain("onerror");
        assertThat(ArticleBodySanitizer.sanitize("<textarea><img src=x onerror=alert(1)></textarea>"))
            .doesNotContain("<textarea").doesNotContain("onerror");
        assertThat(ArticleBodySanitizer.sanitize("<title><img src=x onerror=alert(1)></title>"))
            .doesNotContain("<title").doesNotContain("onerror");
    }

    @Test
    void removesPlaintextBecauseItNeverCloses() {
        // <plaintext> swallows the rest of the document, so it arrives without
        // a closing tag and only the unclosed form can match it.
        String stored = ArticleBodySanitizer.sanitize("<plaintext><img src=x onerror=alert(1)>");

        assertThat(stored).doesNotContain("<plaintext");
        assertThat(stored).doesNotContain("onerror");
    }

    @Test
    void removesUnclosedAndSelfClosingFormsOfTheNewCarriers() {
        String stored = ArticleBodySanitizer.sanitize("<p>Trước</p><svg/onload=alert(1)>");

        assertThat(stored).doesNotContain("<svg");
        assertThat(stored).doesNotContain("onload");
        assertThat(stored).contains("Trước");
    }

    @Test
    void matchesTheNewCarriersRegardlessOfCase() {
        // Markup is case-insensitive, so a denylist that is not loses to <SVG>.
        String stored = ArticleBodySanitizer.sanitize("<SVG><script>alert(1)</script></SVG>");

        assertThat(stored).doesNotContain("alert(1)");
        assertThat(stored.toUpperCase(java.util.Locale.ROOT)).doesNotContain("<SVG");
    }

    @Test
    void reportsTheNewCarriersAsExecutableContent() {
        assertThat(ArticleBodySanitizer.containsExecutableContent("<svg><script>x</script></svg>")).isTrue();
        assertThat(ArticleBodySanitizer.containsExecutableContent("<noscript><img src=x onerror=alert(1)>")).isTrue();
        assertThat(ArticleBodySanitizer.containsExecutableContent("<template>x</template>")).isTrue();
        assertThat(ArticleBodySanitizer.containsExecutableContent("<plaintext>x")).isTrue();
    }

    @Test
    void leavesOrdinaryClinicalContentAlone() {
        // The reason the comment field is scrubbed rather than refused: a
        // comparison sign is ordinary clinical prose, not a construct.
        String body = "<p>Huyết áp mục tiêu < 140/90 mmHg, đường huyết < 7 mmol/L.</p>"
            + "<div class=\"clinical-warning\" data-callout=\"clinical-warning\">"
            + "<p>Không dùng quá 4 g/ngày.</p></div>"
            + "<table><tr><td>5 mg | 3 lần/ngày</td></tr></table>";

        assertThat(ArticleBodySanitizer.sanitize(body)).isEqualTo(body);
        assertThat(ArticleBodySanitizer.containsExecutableContent(body)).isFalse();
    }

    @Test
    void nestedTagsCannotReassembleIntoAnExecutableBlock() {
        // A single sweep of the passes was the defect: <scr<iframe>ipt> lost
        // its inner <iframe> to the void-element pass and closed up into a
        // working <script>, exactly like the control-character carrier did
        // before the strip was moved first. The pass sequence now runs to a
        // fixed point, so the reassembled block dies in the next iteration.
        String stored = ArticleBodySanitizer.sanitize("<scr<iframe>ipt>alert(1)</scr<iframe>ipt>");

        assertThat(stored).doesNotContain("<script");
        assertThat(stored).doesNotContain("alert(1)");
        assertThat(ArticleBodySanitizer.containsExecutableContent(stored)).isFalse();
    }

    @Test
    void repeatedlyNestedReassemblyEitherSettlesCleanOrFailsClosed() {
        String nested = "<scr<scr<iframe>ipt>iframe>ipt>alert(1)</scr<scr<iframe>ipt>iframe>ipt>";
        try {
            String stored = ArticleBodySanitizer.sanitize(nested);
            assertThat(ArticleBodySanitizer.containsExecutableContent(stored)).isFalse();
            assertThat(stored).doesNotContain("<script");
        } catch (com.healthcare.exception.BusinessException rejected) {
            // Refusing the body is the other safe outcome: the sanitizer
            // bounds its loop and fails closed rather than storing what it
            // could not clean.
            assertThat(rejected.getStatus()).isEqualTo(400);
        }
    }

    @Test
    void keepsEventHandlerLookingTextOutsideTags() {
        // Regression pin (wave-14 F6): the handler pass used to run on the
        // whole body, so a stored markdown link or URL path containing
        // "/onload=x" — or prose "nút onkey = bật" — was silently truncated
        // as soon as any "<" elsewhere put the string through the scrub.
        String body = "<p>Lưu ý.</p> [hướng dẫn](https://ex.com/onload=a/y) "
            + "và nút onkey = bật đều là văn bản thường.";

        assertThat(ArticleBodySanitizer.sanitize(body)).isEqualTo(body);
        assertThat(ArticleBodySanitizer.containsExecutableContent(body)).isFalse();
    }

    @Test
    void stillStripsEventHandlersInsideTags() {
        String stored = ArticleBodySanitizer.sanitize(
            "<figure><img src=\"/media/x.png\" onerror=\"alert(1)\" onload=go()></figure>");

        assertThat(stored).doesNotContain("onerror");
        assertThat(stored).doesNotContain("onload");
        assertThat(stored).contains("<img src=\"/media/x.png\"");
        assertThat(ArticleBodySanitizer.containsExecutableContent(stored)).isFalse();
    }

    @Test
    void authoredSectionsGoThroughTheSameGateAsBody() {
        // wave-14 N-F2: sections[].heading/body used to bypass the scrub
        // while the body payload was cleaned or refused.
        com.fasterxml.jackson.databind.node.ArrayNode stored = HospitalJsonMapper.articleSections(
            java.util.List.of(
                new com.healthcare.hospital.dto.ArticleSectionRequest(
                    "Sốt cao", "Nội dung bình thường"),
                new com.healthcare.hospital.dto.ArticleSectionRequest(
                    "<script>alert(1)</script>", "<img src=x onerror=alert(1)>")));

        assertThat(stored.get(0).path("heading").asText()).isEqualTo("Sốt cao");
        assertThat(stored.get(1).path("heading").asText()).doesNotContain("<script");
        assertThat(stored.get(1).path("body").asText()).doesNotContain("onerror");
    }

    @Test
    void stillRemovesTheOriginalCarriers() {
        // The denylist grew; nothing that was already on it may have moved.
        String stored = ArticleBodySanitizer.sanitize(
            "<script>alert(1)</script><style>body{}</style><iframe src=\"https://evil.test\"></iframe>"
                + "<object data=\"x\"></object><embed src=\"x\"><form action=\"/x\"></form>");

        assertThat(stored).doesNotContain("<script").doesNotContain("<style")
            .doesNotContain("<iframe").doesNotContain("<object")
            .doesNotContain("<embed").doesNotContain("<form");
    }
}
