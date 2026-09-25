package com.healthcare.payment.service;

import com.healthcare.payment.dto.BankTransferWebhookRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Batch import of a bank statement file. Each parsed transfer goes through the
 * exact same confirm gate as a webhook — matching transfer content, exact
 * amount, payable appointment — so an import can only ever queue a payment
 * for admin review, never mark it PAID. Row hashes make a re-imported file a
 * counted no-op for already-matched rows, while previously UNMATCHED rows are
 * re-driven through the gate (a 404 or an unconfirmed hold is transient, and
 * a later import must be able to pick them up).
 */
@Service
public class BankStatementImportService {

    /** Hard cap on one import: bounded transaction, bounded review queue noise. */
    private static final int MAX_ROWS = 500;
    private static final int MAX_FILE_LENGTH = 512 * 1024;

    private final BankTransferPaymentService paymentService;
    private final JdbcTemplate jdbcTemplate;

    public BankStatementImportService(BankTransferPaymentService paymentService, JdbcTemplate jdbcTemplate) {
        this.paymentService = paymentService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public record ImportResult(UUID importId, int totalRows, int matchedRows, int duplicateRows,
            int invalidRows, List<UnmatchedRow> unmatched) {
    }

    public record UnmatchedRow(String transferContent, String bankReference, String amount, String note) {
    }

    @Transactional
    public ImportResult importStatement(String fileName, String csv, UserDetails principal) {
        if (csv == null || csv.isBlank() || csv.length() > MAX_FILE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tệp sao kê rỗng hoặc vượt quá 512KB");
        }
        BankStatementParser.ParseResult parsed = BankStatementParser.parse(csv);
        if (parsed.rows().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Không đọc được dòng nào từ tệp sao kê (định dạng: số tiền ; nội dung chuyển khoản ; mã giao dịch)");
        }
        if (parsed.rows().size() > MAX_ROWS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Tệp sao kê có quá nhiều dòng (tối đa " + MAX_ROWS + ")");
        }
        UUID importId = UUID.randomUUID();
        jdbcTemplate.update(
            """
            insert into bank_statement_imports
                (id, file_name, imported_by, imported_at, total_rows, matched_rows, duplicate_rows, invalid_rows)
            values (?, ?, ?, current_timestamp, 0, 0, 0, 0)
            """,
            importId, sanitize(fileName, 200), actorOf(principal));

        int matched = 0;
        int duplicates = 0;
        List<UnmatchedRow> unmatched = new ArrayList<>();
        for (BankStatementParser.StatementRow row : parsed.rows()) {
            String rowHash = rowHash(row);
            Integer inserted = jdbcTemplate.update(
                """
                insert into bank_statement_rows
                    (id, import_id, row_hash, amount, transfer_content, bank_reference)
                values (?, ?, ?, ?, ?, ?)
                on conflict (row_hash) do nothing
                """,
                UUID.randomUUID(), importId, rowHash, row.amount(), row.transferContent(), row.bankReference());
            if (inserted == null || inserted == 0) {
                // Hash-dedup keeps one ingest per statement line. A row that was
                // previously recorded UNMATCHED (payment not initialized yet, hold
                // not yet OTP-confirmed) must not stay burned: re-drive the match
                // so a later import of the same file can pick it up. Genuinely
                // matched rows stay counted duplicates.
                Boolean alreadyMatched = jdbcTemplate.queryForObject(
                    "select matched from bank_statement_rows where row_hash = ?",
                    Boolean.class, rowHash);
                if (alreadyMatched == null || alreadyMatched) {
                    duplicates++;
                    continue;
                }
            }
            String note = match(row, rowHash);
            if (note == null) {
                matched++;
            } else {
                unmatched.add(new UnmatchedRow(row.transferContent(), row.bankReference(),
                    row.amount().toPlainString(), note));
            }
        }
        int invalid = parsed.invalidLines();
        jdbcTemplate.update(
            """
            update bank_statement_imports
               set total_rows = ?, matched_rows = ?, duplicate_rows = ?, invalid_rows = ?
             where id = ?
            """,
            parsed.rows().size(), matched, duplicates, invalid, importId);
        return new ImportResult(importId, parsed.rows().size(), matched, duplicates, invalid, unmatched);
    }

    /**
     * Reuses the webhook confirm gate verbatim; returns null on success or the
     * unmatched note. The evidence-style event id keeps audit fingerprints
     * stable across a re-import that arrives after the booking is confirmed.
     */
    private String match(BankStatementParser.StatementRow row, String rowHash) {
        String eventId = "stmt-" + rowHash.substring(0, 16);
        try {
            paymentService.confirmFromWebhook(
                new BankTransferWebhookRequest(row.transferContent(), row.amount(), bankReference(row)), eventId);
            jdbcTemplate.update("update bank_statement_rows set matched = true, note = null where row_hash = ?",
                rowHash);
            return null;
        } catch (ResponseStatusException conflict) {
            String reason = conflict.getReason() == null ? "Không ghép được" : conflict.getReason();
            jdbcTemplate.update("update bank_statement_rows set matched = false, note = ? where row_hash = ?",
                sanitize(reason, 300), rowHash);
            return reason;
        }
    }

    private String bankReference(BankStatementParser.StatementRow row) {
        String reference = row.bankReference() == null ? "" : row.bankReference();
        if (reference.isBlank()) {
            // confirmFromWebhook requires a non-blank reference; fall back to the
            // statement hash so the queue entry still names exactly one source line.
            reference = "STMT-" + rowHash(row).substring(0, 12);
        }
        return reference;
    }

    private String rowHash(BankStatementParser.StatementRow row) {
        String normalizedContent = row.transferContent().trim().replaceAll("\\s+", " ")
            .toUpperCase(java.util.Locale.ROOT);
        String payload = row.amount().toPlainString() + "|" + normalizedContent + "|"
            + (row.bankReference() == null ? "" : row.bankReference().trim());
        return sha256(payload);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private String sanitize(String value, int limit) {
        String normalized = value == null ? "" : value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.substring(0, Math.min(limit, normalized.length()));
    }

    private String actorOf(UserDetails principal) {
        return principal == null ? "unknown" : principal.getUsername();
    }
}
