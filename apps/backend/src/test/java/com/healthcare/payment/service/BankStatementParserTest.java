package com.healthcare.payment.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The statement parser is the trust boundary of the import: every line is
 * either a well-formed transfer or a counted invalid line — never silently
 * dropped, never accepted with a non-positive or unreadable amount.
 */
class BankStatementParserTest {

    @Test
    void parsesSemicolonAndCommaRowsAndSkipsHeaders() {
        var result = BankStatementParser.parse(
            "Số tiền;Nội dung;Mã giao dịch\n"
                + "200000;HC 260924 0001;FT-001\n"
                + "150000,HC 260924 0002,FT-002\n");

        assertThat(result.invalidLines()).isZero();
        assertThat(result.rows()).hasSize(2);
        assertThat(result.rows().getFirst().amount()).isEqualByComparingTo("200000");
        assertThat(result.rows().getFirst().transferContent()).isEqualTo("HC 260924 0001");
        assertThat(result.rows().getFirst().bankReference()).isEqualTo("FT-001");
        assertThat(result.rows().getLast().amount()).isEqualByComparingTo("150000");
        assertThat(result.rows().getLast().bankReference()).isEqualTo("FT-002");
    }

    @Test
    void countsUnreadableLinesInsteadOfDroppingThem() {
        var result = BankStatementParser.parse(
            "300000;HC 0000;FT-000\n"
                + "abc;HC 0001\n"
                + "200000\n"
                + "-5;HC 0002;FT-3\n"
                + "0;HC 0003\n"
                + "\n"
                + "  400000 ; HC 0005 ; FT-005  \n");

        assertThat(result.invalidLines()).isEqualTo(4);
        assertThat(result.rows()).hasSize(2);
        assertThat(result.rows().get(1).amount()).isEqualByComparingTo("400000");
        assertThat(result.rows().get(1).transferContent()).isEqualTo("HC 0005");
    }

    @Test
    void optionalReferenceStaysNullWhenMissing() {
        var result = BankStatementParser.parse("200000;HC 0001\n");
        assertThat(result.rows().getFirst().bankReference()).isNull();
    }
}
