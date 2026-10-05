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
            String[] cells = line.split("[;,]");
            BigDecimal amount = cells.length >= 1 ? parseAmount(cells[0].trim()) : null;
            // A leading non-numeric line is a column header, not an error.
            if (!seenNonEmptyLine && amount == null) {
                seenNonEmptyLine = true;
                continue;
            }
            seenNonEmptyLine = true;
            if (cells.length < 2 || cells.length > 3 || amount == null) {
                invalid++;
                continue;
            }
            String content = cells[1].trim();
            String reference = cells.length == 3 ? cells[2].trim() : null;
            // Bound the persisted column widths: transfer_content is
            // VARCHAR(64) and amount NUMERIC(12,2). Over-bound lines must be
            // counted invalid here — letting them reach the INSERT aborts the
            // whole import while earlier REQUIRES_NEW matches stay committed
            // with no recoverable provenance.
            if (content.isBlank() || content.length() > 64
                    || (reference != null && (reference.isBlank() || reference.length() > 100))
                    || amount.precision() - amount.scale() > 10 || amount.scale() > 2) {
                invalid++;
                continue;
            }
            rows.add(new StatementRow(amount, content, reference));
        }
        return new ParseResult(List.copyOf(rows), invalid);
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
