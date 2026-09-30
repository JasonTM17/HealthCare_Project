package com.healthcare.payment.service;

import com.healthcare.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Transactional regression for statement ingestion: {@code confirmFromWebhook}
 * is {@code @Transactional(REQUIRED)}, so a mismatch thrown by the confirm gate
 * used to mark the shared import transaction rollback-only while {@code match()}
 * happily swallowed the exception — the commit then died with
 * {@code UnexpectedRollbackException} and the whole import, including the
 * {@code bank_statement_imports} header (the only audit trace), was lost. One
 * unmatched statement line must never poison its matched siblings: every
 * confirm runs committed-or-rolled-back in its own REQUIRES_NEW transaction,
 * exactly like the webhook evidence writer in {@code BankTransferWebhookService}.
 */
class BankStatementImportTransactionTest extends AbstractIntegrationTest {

    @Autowired
    private BankStatementImportService importService;

    private final UserDetails admin = new org.springframework.security.core.userdetails.User(
        "admin@example.test", "not-used", List.of());

    @Test
    @DisplayName("A mismatched line survives the import instead of poisoning the whole transaction")
    void unmatchedRowDoesNotKillTheImport() {
        // The payment table is empty, so every statement line walks the real
        // confirm gate and comes back 404 — the exact shape that used to mark
        // the ambient import transaction rollback-only behind the catch.
        BankStatementImportService.ImportResult result = importService.importStatement(
            "statement.csv", "200000;HC 0001;FT-1\n150000;HC 0002\n", admin);

        assertThat(result.totalRows()).isEqualTo(2);
        assertThat(result.matchedRows()).isZero();
        assertThat(result.duplicateRows()).isZero();
        assertThat(result.unmatched()).hasSize(2)
            .allSatisfy(row -> assertThat(row.note()).contains("Không tìm thấy nội dung chuyển khoản"));

        // The header row is the audit trace of the import; it used to vanish
        // together with every counted line when the commit was refused.
        Integer headerCount = jdbcTemplate.queryForObject(
            "select count(*) from bank_statement_imports", Integer.class);
        assertThat(headerCount).isEqualTo(1);

        Integer unmatchedRows = jdbcTemplate.queryForObject(
            "select count(*) from bank_statement_rows where matched = false and note is not null",
            Integer.class);
        assertThat(unmatchedRows).isEqualTo(2);
    }

    @Test
    @DisplayName("A re-imported unmatched line is re-driven by hash, never burned")
    void reimportedUnmatchedLineIsReDrivenByHash() {
        importService.importStatement("statement.csv", "200000;HC 0001;FT-1\n", admin);

        BankStatementImportService.ImportResult second = importService.importStatement(
            "statement.csv", "200000;HC 0001;FT-1\n", admin);

        assertThat(second.totalRows()).isEqualTo(1);
        // The hash already exists but stayed UNMATCHED, so the line must be
        // re-driven through the gate rather than counted as a duplicate.
        assertThat(second.duplicateRows()).isZero();
        assertThat(second.matchedRows()).isZero();
        assertThat(second.unmatched()).hasSize(1);

        Integer rowCount = jdbcTemplate.queryForObject(
            "select count(*) from bank_statement_rows", Integer.class);
        assertThat(rowCount).isEqualTo(1);
    }
}
