package com.healthcare.payment.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * The bank observed a transfer for a booking whose hold has not been
 * OTP-confirmed yet. The evidence row stays unprocessed and the retry worker
 * re-drives it after confirmation, so this failure is transient by design —
 * unlike the permanent conflicts (amount mismatch, cancelled appointment)
 * which go straight to the admin dead-letter view.
 */
public class PaymentNotYetConfirmableException extends ResponseStatusException {

    public PaymentNotYetConfirmableException(String reason) {
        super(HttpStatus.CONFLICT, reason);
    }
}
