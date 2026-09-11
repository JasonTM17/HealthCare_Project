package com.healthcare.exception;

public class UnauthorizedException extends BusinessException {

    public UnauthorizedException(String message) {
        super(401, ErrorCodes.AUTHENTICATION_REQUIRED, message);
    }

    public UnauthorizedException(String code, String message) {
        super(401, code, message);
    }
}
