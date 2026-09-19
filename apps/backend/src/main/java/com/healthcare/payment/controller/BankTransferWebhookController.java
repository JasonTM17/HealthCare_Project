package com.healthcare.payment.controller;

import com.healthcare.payment.dto.BankTransferPaymentResponse;
import com.healthcare.payment.service.BankTransferWebhookService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Payments & Invoices", description = "Cổng thanh toán viện phí VietQR, xác nhận chuyển khoản ngân hàng và đối soát hóa đơn")
@RestController
@RequestMapping("/api/v1/payments/webhooks/bank-transfer")
public class BankTransferWebhookController {

    private final BankTransferWebhookService webhookService;

    public BankTransferWebhookController(BankTransferWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @Operation(summary = "Tiếp nhận webhook thanh toán tự động", description = "Endpoint tiếp nhận thông báo biến động số dư từ cổng thanh toán đối tác với chữ ký HMAC-SHA256")
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BankTransferPaymentResponse> receive(
            @RequestHeader("X-Webhook-Id") String eventId,
            @RequestHeader("X-Webhook-Timestamp") String timestamp,
            @RequestHeader("X-Webhook-Signature") String signature,
            @RequestBody String rawBody) {
        return ResponseEntity.ok(webhookService.process(eventId, timestamp, signature, rawBody));
    }
}
