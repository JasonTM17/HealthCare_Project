package com.healthcare.payment.service;

import com.healthcare.payment.entity.BankTransferPayment;

/**
 * The seam a future gateway (VNPay, MoMo, ...) plugs into: everything that
 * varies per payment channel — availability of its credentials and how a QR
 * or payment artifact is presented. Money movement, the state machine and
 * the human-in-the-loop review stay in the service, deliberately outside
 * this interface.
 */
public interface PaymentChannelProvider {

    /** Stable selector matched against {@code app.payment.provider}. */
    String id();

    /** True when the channel's credentials are fully configured. */
    boolean isConfigured();

    String bankName();

    String bankAccount();

    String accountHolder();

    String buildQrUrl(BankTransferPayment payment);
}
