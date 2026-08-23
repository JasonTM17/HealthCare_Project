package com.healthcare.auth;

import com.healthcare.exception.BusinessException;

/** OTP validation failure whose challenge mutation must still be committed. */
public class OtpVerificationException extends BusinessException {

    public OtpVerificationException(int status, String code, String message) {
        super(status, code, message);
    }
}
