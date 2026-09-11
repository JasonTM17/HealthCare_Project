package com.healthcare.exception;

public class ForbiddenException extends BusinessException {

    public ForbiddenException(String message) {
        super(403, ErrorCodes.ACCESS_DENIED, message);
    }

    public ForbiddenException(String code, String message) {
        super(403, code, message);
    }
}
