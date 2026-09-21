package com.healthcare.hospital.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins {@link ArticleSectionsDeriver} to the V92 seed derivation semantics so a
 * TinyMCE body edit can never desync the public disease-guide sections.
 */
class ArticleSectionsDeriverTest {

    @Test
    void mirrorsV92SeedDerivation() {
        String body = """
                Giới thiệu tổng quan về bệnh.

                ## Triệu chứng thường gặp
                Đau đầu, chóng mặt.

                ## Khi nào cần gặp bác sĩ
                """;;

        var sections = ArticleSectionsDeriver.derive(body);

        assertThat(sections).hasSize(3);
        assertThat(sections.get(0).get("heading").asText()).isEqualTo("Tổng quan");
        assertThat(sections.get(0).get("body").asText()).isEqualTo("Giới thiệu tổng quan về bệnh.");
        assertThat(sections.get(1).get("heading").asText()).isEqualTo("Triệu chứng thường gặp");
        assertThat(sections.get(1).get("body").asText()).isEqualTo("Đau đầu, chóng mặt.");
        // A bare heading yields an empty body, exactly like the SQL derivation.
        assertThat(sections.get(2).get("heading").asText()).isEqualTo("Khi nào cần gặp bác sĩ");
        assertThat(sections.get(2).get("body").asText()).isEmpty();
    }

    @Test
    void ignoresH3AndDeeperHeadings() {
        String body = "Mở đầu\n\n## Mục chính\nNội dung\n\n### Mục phụ vẫn thuộc section\nTiếp tục.";

        var sections = ArticleSectionsDeriver.derive(body);

        assertThat(sections).hasSize(2);
        assertThat(sections.get(1).get("heading").asText()).isEqualTo("Mục chính");
        assertThat(sections.get(1).get("body").asText())
            .contains("### Mục phụ vẫn thuộc section")
            .contains("Tiếp tục.");
    }

    @Test
    void crlfLineEndingsSplitCleanly() {
        String body = "Preamble.\r\n\r\n## Section A\r\nBody A.\r\n\r\n## Section B\r\nBody B.";

        var sections = ArticleSectionsDeriver.derive(body);

        // Improvement over the raw V92 SQL (whose btrim keeps a stray \r in the
        // heading): the deriver splits CRLF documents into clean sections.
        assertThat(sections).hasSize(3);
        assertThat(sections.get(0).get("heading").asText()).isEqualTo("Tổng quan");
        assertThat(sections.get(1).get("heading").asText()).isEqualTo("Section A");
        assertThat(sections.get(1).get("body").asText()).isEqualTo("Body A.");
        assertThat(sections.get(2).get("heading").asText()).isEqualTo("Section B");
        assertThat(sections.get(2).get("body").asText()).isEqualTo("Body B.");
    }

    @Test
    void emptyBodyYieldsSinglePreambleSection() {
        var sections = ArticleSectionsDeriver.derive("");

        assertThat(sections).hasSize(1);
        assertThat(sections.get(0).get("heading").asText()).isEqualTo("Tổng quan");
        assertThat(sections.get(0).get("body").asText()).isEmpty();
    }
}
