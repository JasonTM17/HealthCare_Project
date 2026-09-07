package com.healthcare.payment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.payment.dto.BankTransferPaymentResponse;
import com.healthcare.payment.dto.BankTransferWebhookRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Set;

@Service
public class BankTransferWebhookService {

    private static final int MAX_RAW_BODY_LENGTH = 4096;

    private final BankTransferPaymentService paymentService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final TransactionTemplate eventTemplate;
    private final TransactionTemplate requiredTemplate;

    @Value("${app.payment.bank-transfer.webhook-secret:}")
    private String webhookSecret;

    @Value("${app.payment.bank-transfer.webhook-tolerance-seconds:300}")
    private long toleranceSeconds;

    public BankTransferWebhookService(BankTransferPaymentService paymentService, JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper, Validator validator, PlatformTransactionManager transactionManager) {
        this.paymentService = paymentService;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.eventTemplate = new TransactionTemplate(transactionManager);
        this.eventTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.requiredTemplate = new TransactionTemplate(transactionManager);
    }

    public BankTransferPaymentResponse process(String eventId, String timestamp, String signature, String rawBody) {
        requireConfigured();
        validateEventId(eventId);
        if (rawBody == null || rawBody.isBlank() || rawBody.length() > MAX_RAW_BODY_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payload webhook không hợp lệ");
        }
        long epochSeconds = parseTimestamp(timestamp);
        if (Math.abs(Instant.now().getEpochSecond() - epochSeconds) > toleranceSeconds) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Webhook đã hết hiệu lực");
        }
        verifySignature(timestamp, rawBody, signature);
        BankTransferWebhookRequest request = parse(rawBody);
        String payloadHash = sha256(rawBody);
        // process() is deliberately NOT @Transactional. Evidence survival and
        // deadlock-freedom come from the order below:
        //  1) The replay check reads in the AMBIENT transaction, so a caller
        //     that already touched this event id sees its own uncommitted row
        //     and takes the duplicate path without a nested write.
        //  2) The evidence insert runs in REQUIRES_NEW and commits immediately.
        //     It is only reached when no ambient transaction ever touched this
        //     event id (step 1 returned), so the nested insert cannot block on
        //     a caller-held lock — the self-deadlock shape this class once had.
        //  3) When the payment row does not exist yet (the patient never
        //     opened the payment panel), confirmFromWebhook throws 404 AFTER
        //     step 2 committed — the bank's notification evidence survives as
        //     an unprocessed row instead of being rolled away.
        String ambientHash = ambientPayloadHash(eventId);
        if (ambientHash != null) {
            requireSamePayload(payloadHash, ambientHash);
            return paymentService.getByTransferContent(request.transferContent());
        }
        Integer inserted = eventTemplate.execute(status ->
            jdbcTemplate.update(
                "insert into payment_webhook_events (event_id, payload_hash) values (?, ?) on conflict (event_id) do nothing",
                eventId, payloadHash
            ));
        if (inserted == null || inserted == 0) {
            // Another transaction (or an earlier delivery of this event)
            // committed this event id. A row left unprocessed by a previous
            // 404 — the payment row appeared only after the bank's first
            // delivery — must be re-matched now, not just re-read.
            String committedHash = jdbcTemplate.queryForObject(
                "select payload_hash from payment_webhook_events where event_id = ?", String.class, eventId
            );
            requireSamePayload(payloadHash, committedHash);
            boolean processed = jdbcTemplate.queryForObject(
                "select processed_at is not null from payment_webhook_events where event_id = ?", Boolean.class, eventId
            );
            if (!processed) {
                return requiredTemplate.execute(status -> {
                    BankTransferPaymentResponse result = paymentService.confirmFromWebhook(request, eventId);
                    jdbcTemplate.update(
                        "update payment_webhook_events set payment_id = ?, processed_at = current_timestamp where event_id = ?",
                        result.id(), eventId
                    );
                    return result;
                });
            }
            return paymentService.getByTransferContent(request.transferContent());
        }
        return requiredTemplate.execute(status -> {
            BankTransferPaymentResponse result = paymentService.confirmFromWebhook(request, eventId);
            jdbcTemplate.update(
                "update payment_webhook_events set payment_id = ?, processed_at = current_timestamp where event_id = ?",
                result.id(), eventId
            );
            return result;
        });
    }

    /** Null when the event id is unknown to the caller's current transaction. */
    private String ambientPayloadHash(String eventId) {
        try {
            return jdbcTemplate.queryForObject(
                "select payload_hash from payment_webhook_events where event_id = ?", String.class, eventId
            );
        } catch (EmptyResultDataAccessException ignored) {
            return null;
        }
    }

    private void requireSamePayload(String payloadHash, String existingHash) {
        if (existingHash == null || !MessageDigest.isEqual(payloadHash.getBytes(StandardCharsets.UTF_8), existingHash.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Webhook ID đã được dùng với nội dung khác");
        }
    }

    private BankTransferWebhookRequest parse(String rawBody) {
        try {
            BankTransferWebhookRequest request = objectMapper.readValue(rawBody, BankTransferWebhookRequest.class);
            Set<ConstraintViolation<BankTransferWebhookRequest>> violations = validator.validate(request);
            if (!violations.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payload webhook không hợp lệ");
            return request;
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON webhook không hợp lệ");
        }
    }

    private long parseTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu timestamp webhook");
        try { return Long.parseLong(timestamp); }
        catch (NumberFormatException exception) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Timestamp webhook không hợp lệ"); }
    }

    private void verifySignature(String timestamp, String rawBody, String provided) {
        if (provided == null || provided.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu chữ ký webhook");
        String expected;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            expected = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + rawBody).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể kiểm tra chữ ký webhook", exception);
        }
        String normalized = provided.startsWith("sha256=") ? provided.substring(7) : provided;
        if (!normalized.matches("(?i)[0-9a-f]{64}")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Chữ ký webhook không hợp lệ");
        }
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), normalized.toLowerCase().getBytes(StandardCharsets.US_ASCII))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Chữ ký webhook không hợp lệ");
        }
    }

    private void validateEventId(String eventId) {
        if (eventId == null || eventId.isBlank() || eventId.length() > 120
                || !eventId.matches("[A-Za-z0-9._:-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook ID không hợp lệ");
        }
    }

    private String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private void requireConfigured() {
        if (webhookSecret == null || webhookSecret.length() < 32) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Webhook thanh toán chưa được cấu hình an toàn");
        }
    }
}
