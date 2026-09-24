package com.healthcare.payment.service;

import com.healthcare.payment.entity.BankTransferPayment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * VietQR image endpoint over the hospital's bank account. The QR encodes the
 * exact amount and the immutable transfer content minted at booking, so a
 * correctly scanned payment always carries a reconcilable reference.
 */
@Component
public class VietQrChannelProvider implements PaymentChannelProvider {

    public static final String PROVIDER_ID = "vietqr";

    @Value("${app.payment.bank-transfer.enabled:false}")
    private boolean enabled;
    @Value("${app.payment.bank-transfer.bank-name:}")
    private String bankName;
    @Value("${app.payment.bank-transfer.account-number:}")
    private String bankAccount;
    @Value("${app.payment.bank-transfer.account-holder:}")
    private String accountHolder;
    @Value("${app.payment.bank-transfer.bank-bin:}")
    private String bankBin;

    @Override
    public String id() {
        return PROVIDER_ID;
    }

    @Override
    public boolean isConfigured() {
        return enabled && !bankName.isBlank() && !bankAccount.isBlank() && !bankBin.isBlank();
    }

    @Override
    public String bankName() {
        return bankName;
    }

    @Override
    public String bankAccount() {
        return bankAccount;
    }

    @Override
    public String accountHolder() {
        return accountHolder;
    }

    @Override
    public String buildQrUrl(BankTransferPayment payment) {
        StringBuilder url = new StringBuilder("https://img.vietqr.io/image/")
            .append(URLEncoder.encode(bankBin, StandardCharsets.UTF_8)).append('-')
            .append(URLEncoder.encode(bankAccount, StandardCharsets.UTF_8)).append("-compact2.png?amount=")
            .append(payment.getAmount().toBigIntegerExact()).append("&addInfo=")
            .append(URLEncoder.encode(payment.getTransferContent(), StandardCharsets.UTF_8));
        if (accountHolder != null && !accountHolder.isBlank()) {
            url.append("&accountName=").append(URLEncoder.encode(accountHolder, StandardCharsets.UTF_8));
        }
        return url.toString();
    }
}
