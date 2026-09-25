package com.healthcare.payment.service;

import com.healthcare.payment.dto.BankTransferWebhookRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The import service is the accounting boundary of statement ingestion: rows
 * are deduplicated by content hash, every match goes through the same
 * webhook confirm gate (queue, never PAID), and the batch summary counts
 * matched / duplicate / invalid lines without ever losing one.
 */
class BankStatementImportServiceTest {

    private final BankTransferPaymentService paymentService = mock(BankTransferPaymentService.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final BankStatementImportService service =
        new BankStatementImportService(paymentService, jdbcTemplate);
    private final UserDetails admin = new org.springframework.security.core.userdetails.User(
        "admin@example.test", "not-used", List.of());

    @BeforeEach
    void stubWritesSucceedByDefault() {
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
    }

    @Test
    @DisplayName("Matched rows queue through the webhook gate; misses keep their reason")
    void importMatchesAndCounts() {
        when(paymentService.confirmFromWebhook(any(), anyString())).thenReturn(null);
        when(paymentService.confirmFromWebhook(
                org.mockito.ArgumentMatchers.argThat(
                    (BankTransferWebhookRequest request) -> "HC 0002".equals(request.transferContent())),
                anyString()))
            .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nội dung chuyển khoản"));

        BankStatementImportService.ImportResult result = service.importStatement(
            "statement.csv", "200000;HC 0001;FT-1\n150000;HC 0002\n", admin);

        assertThat(result.totalRows()).isEqualTo(2);
        assertThat(result.matchedRows()).isEqualTo(1);
        assertThat(result.duplicateRows()).isZero();
        assertThat(result.invalidRows()).isZero();
        assertThat(result.unmatched()).hasSize(1);
        assertThat(result.unmatched().getFirst().note()).contains("Không tìm thấy nội dung chuyển khoản");
        // The reference fallback names the exact source line when the bank has none.
        var requests = org.mockito.ArgumentCaptor.forClass(BankTransferWebhookRequest.class);
        verify(paymentService, times(2)).confirmFromWebhook(requests.capture(), anyString());
        assertThat(requests.getAllValues().get(0).transactionReference()).isEqualTo("FT-1");
        assertThat(requests.getAllValues().get(1).transactionReference()).startsWith("STMT-");
    }

    @Test
    @DisplayName("A re-imported MATCHED line is a counted duplicate, never a second match")
    void reimportedMatchedRowsAreDuplicates() {
        when(jdbcTemplate.update(contains("on conflict (row_hash) do nothing"), any(Object[].class)))
            .thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("select matched"), eq(Boolean.class), any(Object[].class)))
            .thenReturn(true);

        BankStatementImportService.ImportResult result = service.importStatement(
            "statement.csv", "200000;HC 0001;FT-1\n150000;HC 0002\n", admin);

        assertThat(result.duplicateRows()).isEqualTo(2);
        assertThat(result.matchedRows()).isZero();
        verify(paymentService, never()).confirmFromWebhook(any(), anyString());
    }

    @Test
    @DisplayName("A re-imported UNMATCHED line is re-driven through the confirm gate")
    void reimportedUnmatchedRowsAreRetried() {
        // First import left both rows unmatched; re-importing must retry them
        // instead of burning them as duplicates.
        when(jdbcTemplate.update(contains("on conflict (row_hash) do nothing"), any(Object[].class)))
            .thenReturn(0);
        when(jdbcTemplate.queryForObject(contains("select matched"), eq(Boolean.class), any(Object[].class)))
            .thenReturn(false);
        when(paymentService.confirmFromWebhook(any(), anyString())).thenReturn(null);

        BankStatementImportService.ImportResult result = service.importStatement(
            "statement.csv", "200000;HC 0001;FT-1\n150000;HC 0002\n", admin);

        assertThat(result.matchedRows()).isEqualTo(2);
        assertThat(result.duplicateRows()).isZero();
        assertThat(result.unmatched()).isEmpty();
        verify(paymentService, times(2)).confirmFromWebhook(any(), anyString());
    }

    @Test
    @DisplayName("An unconfirmed hold becomes an unmatched row with a retry hint")
    void unconfirmedHoldBecomesUnmatched() {
        when(paymentService.confirmFromWebhook(any(), anyString()))
            .thenThrow(new PaymentNotYetConfirmableException("Lịch hẹn chưa hoàn tất xác nhận"));

        BankStatementImportService.ImportResult result = service.importStatement(
            "statement.csv", "200000;HC 0001\n", admin);

        assertThat(result.matchedRows()).isZero();
        assertThat(result.unmatched().getFirst().note()).contains("chưa hoàn tất xác nhận");
    }

    @Test
    @DisplayName("Empty files and unreadable files are refused outright")
    void unreadableFilesAreRefused() {
        assertThatThrownBy(() -> service.importStatement("s.csv", "   \n", admin))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.importStatement("s.csv", "abc;def\n\n", admin))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.importStatement("s.csv", "x".repeat(513 * 1024), admin))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(jdbcTemplate, never()).update(contains("bank_statement_imports"), any(Object[].class));
    }
}
