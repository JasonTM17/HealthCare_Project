package com.healthcare.exception;

public class ConflictException extends BusinessException {

    public ConflictException(String message) {
        super(409, ErrorCodes.CONFLICT, message);
    }

    public ConflictException(String code, String message) {
        super(409, code, message);
    }
}
