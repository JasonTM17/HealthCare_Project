package com.healthcare.exception;

public class BadRequestException extends BusinessException {

    public BadRequestException(String message) {
        super(400, ErrorCodes.VALIDATION_ERROR, message);
    }

    public BadRequestException(String code, String message) {
        super(400, code, message);
    }
}
