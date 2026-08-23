package com.healthcare.exception;

public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String message) {
        super(404, message);
    }

    public ResourceNotFoundException(String code, String message) {
        super(404, code, message);
    }
}
