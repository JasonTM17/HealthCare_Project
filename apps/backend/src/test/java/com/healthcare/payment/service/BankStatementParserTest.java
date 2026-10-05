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

    @Test
    void rejectsLinesThatWouldOverflowPersistedColumns() {
        var result = BankStatementParser.parse(
            "200000;HC 0001;FT-001\n"
                // transfer_content is VARCHAR(64)
                + "200000;" + "X".repeat(65) + ";FT-002\n"
                // amount is NUMERIC(12,2) → at most 10 integer digits
                + "99999999999;HC 0003;FT-003\n"
                // bank_reference is VARCHAR(100)
                + "200000;HC 0004;" + "R".repeat(101) + "\n"
                // extra fractional precision beyond scale 2
                + "150.123;HC 0005\n"
                + "9999999999.99;HC 0006;FT-006\n");

        assertThat(result.invalidLines()).isEqualTo(4);
        assertThat(result.rows()).hasSize(2);
        assertThat(result.rows().get(0).transferContent()).isEqualTo("HC 0001");
        assertThat(result.rows().get(1).amount()).isEqualByComparingTo("9999999999.99");
    }

    @Test
    void blankContentCountsInvalidWhileWhitespaceOnlyReferenceReadsAsAbsent() {
        var result = BankStatementParser.parse(
            "200000;HC 0001;   \n"
                + "100000;   ;FT-002\n");

        // Line 1: the whitespace-only trailing cell trims to an absent
        // reference — a valid row with null bankReference.
        // Line 2: blank transfer content is a counted invalid line.
        assertThat(result.invalidLines()).isEqualTo(1);
        assertThat(result.rows()).hasSize(1);
        assertThat(result.rows().getFirst().transferContent()).isEqualTo("HC 0001");
        assertThat(result.rows().getFirst().bankReference()).isNull();
    }

    @Test
    void unicodeSpaceBlankContentCountsInvalid() {
        // U+00A0 (and other Unicode separators) are not Character.isWhitespace:
        // a visually-blank transfer content must never reach the INSERT.
        var result = BankStatementParser.parse(
            "200000;HC 0001;FT-001\n"
                + "100000; ;FT-002\n"
                + "100000; ;FT-003\n");

        assertThat(result.invalidLines()).isEqualTo(2);
        assertThat(result.rows()).hasSize(1);
    }

    @Test
    void malformedFirstDataLineWithDigitsCountsInvalid() {
        // A header line is digit-free; a first line carrying digits whose
        // amount does not parse is a malformed data row — counted, not dropped.
        var result = BankStatementParser.parse(
            "N/A;REAL PAYMENT;FT-1\n"
                + "200000;HC 0001;FT-002\n");

        assertThat(result.invalidLines()).isEqualTo(1);
        assertThat(result.rows()).hasSize(1);
    }

    @Test
    void commaDecimalInsideSemicolonRowDoesNotSplitIntoPhantomCells() {
        // Semicolon-dialect row with a comma decimal amount: splitting on both
        // separators would fabricate a plausible but wrong row.
        var result = BankStatementParser.parse(
            "1234,56;HC 0001\n"
                + "200000;HC 0002;FT-002\n");

        assertThat(result.invalidLines()).isEqualTo(1);
        assertThat(result.rows()).hasSize(1);
        assertThat(result.rows().getFirst().transferContent()).isEqualTo("HC 0002");
    }
}
