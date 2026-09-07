package com.healthcare.payment.worker;

import com.healthcare.payment.service.BankTransferWebhookService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.payment.bank-transfer", name = {"enabled", "retry-enabled"}, havingValue = "true")
public class BankTransferWebhookRetryWorker {
    private final BankTransferWebhookService webhookService;

    public BankTransferWebhookRetryWorker(BankTransferWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @Scheduled(fixedDelayString = "${app.payment.bank-transfer.retry-poll-ms:60000}")
    public void retryPendingEvents() {
        webhookService.retryPendingEvents();
    }
}
