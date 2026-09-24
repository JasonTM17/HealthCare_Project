package com.healthcare.payment.service;

import com.healthcare.payment.dto.PaymentWebhookEventAdminView;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

/**
 * Read-only admin surface for stored bank webhook evidence. Rows that never
 * matched a payment (unknown transfer content, amount mismatch, a booking that
 * ended before the money arrived) used to be retried and then silently
 * abandoned; this is the view that makes them actionable instead.
 */
@Service
public class PaymentWebhookEventAdminService {

    private static final Set<String> ALLOWED_SCOPES = Set.of("unprocessed", "all");
    private static final int MAX_LIMIT = 200;

    private static final String SELECT_COLUMNS = """
        select event_id, transfer_content, amount, transaction_reference, received_at,
               retry_attempts, next_retry_at, processed_at, permanent_failure, failure_reason
          from payment_webhook_events
        """;

    private final JdbcTemplate jdbcTemplate;

    public PaymentWebhookEventAdminService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<PaymentWebhookEventAdminView> list(String rawScope, int limit) {
        String scope = rawScope == null || rawScope.isBlank() ? "unprocessed" : rawScope.trim().toLowerCase();
        if (!ALLOWED_SCOPES.contains(scope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phạm vi webhook không hợp lệ");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit phải từ 1 đến " + MAX_LIMIT);
        }
        String sql = "unprocessed".equals(scope)
            ? SELECT_COLUMNS
                + " where processed_at is null"
                + " order by permanent_failure desc, received_at desc limit ?"
            : SELECT_COLUMNS
                + " order by received_at desc limit ?";
        return jdbcTemplate.query(sql, (rs, row) -> new PaymentWebhookEventAdminView(
            rs.getString("event_id"),
            rs.getString("transfer_content"),
            rs.getBigDecimal("amount"),
            rs.getString("transaction_reference"),
            rs.getObject("received_at", java.time.OffsetDateTime.class),
            (Integer) rs.getObject("retry_attempts"),
            rs.getObject("next_retry_at", java.time.OffsetDateTime.class),
            rs.getObject("processed_at", java.time.OffsetDateTime.class),
            rs.getBoolean("permanent_failure"),
            rs.getString("failure_reason")
        ), limit);
    }
}
