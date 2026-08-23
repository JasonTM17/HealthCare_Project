package com.healthcare.exception;

public class DuplicateResourceException extends BusinessException {

    public DuplicateResourceException(String message) {
        super(409, message);
    }

    public DuplicateResourceException(String code, String message) {
        super(409, code, message);
    }
}
