package com.healthcare.payment.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Parser for the hospital's statement upload format: one transfer per line,
 * columns separated by ";" or ",", optional header line. Column order is
 * amount, transfer content, optional bank reference. Lines that do not parse
 * are counted, never silently dropped.
 */
public final class BankStatementParser {

    public record StatementRow(BigDecimal amount, String transferContent, String bankReference) {
    }

    public record ParseResult(List<StatementRow> rows, int invalidLines) {
    }

    private BankStatementParser() {
    }

    public static ParseResult parse(String csv) {
        List<StatementRow> rows = new ArrayList<>();
        int invalid = 0;
        boolean seenNonEmptyLine = false;
        for (String rawLine : csv.replace("\r\n", "\n").replace('\r', '\n').split("\n", -1)) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                continue;
            }
            // One dialect per line: a semicolon statement keeps commas inside
            // fields (e.g. decimal amounts "1234,56"), only comma-only lines
            // use the comma dialect.
            String[] cells = line.contains(";") ? line.split(";") : line.split(",");
            BigDecimal amount = cells.length >= 1 ? parseAmount(normalizeSpaces(cells[0]).trim()) : null;
            // A leading non-numeric, digit-free line is a column header, not
            // an error; a malformed first data row is counted, never dropped.
            if (!seenNonEmptyLine && amount == null) {
                seenNonEmptyLine = true;
                if (line.chars().anyMatch(Character::isDigit)) {
                    invalid++;
                }
                continue;
            }
            seenNonEmptyLine = true;
            if (cells.length < 2 || cells.length > 3 || amount == null) {
                invalid++;
                continue;
            }
            String content = normalizeSpaces(cells[1]).trim();
            String reference = cells.length == 3 ? normalizeSpaces(cells[2]).trim() : null;
            // Bound the persisted column widths: transfer_content is
            // VARCHAR(64) and amount NUMERIC(12,2). Over-bound lines must be
            // counted invalid here — letting them reach the INSERT aborts the
            // whole import while earlier REQUIRES_NEW matches stay committed
            // with no recoverable provenance.
            if (content.isEmpty() || content.length() > 64
                    || (reference != null && (reference.isEmpty() || reference.length() > 100))
                    || amount.precision() - amount.scale() > 10 || amount.scale() > 2) {
                invalid++;
                continue;
            }
            rows.add(new StatementRow(amount, content, reference));
        }
        return new ParseResult(List.copyOf(rows), invalid);
    }

    // String.trim/isBlank use Character.isWhitespace, which excludes NBSP and
    // the other Unicode space separators a bank export can emit; normalize them
    // to plain spaces so a visually-blank cell is truly blank.
    private static String normalizeSpaces(String value) {
        return value.replace(' ', ' ').replace(' ', ' ').replace(' ', ' ').replace(' ', ' ');
    }

    private static BigDecimal parseAmount(String value) {
        try {
            BigDecimal amount = new BigDecimal(value);
            return amount.signum() > 0 ? amount : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
