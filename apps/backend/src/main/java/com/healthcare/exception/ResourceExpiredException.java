package com.healthcare.exception;

public class ResourceExpiredException extends BusinessException {

    public ResourceExpiredException(String message) {
        super(410, ErrorCodes.RESOURCE_EXPIRED, message);
    }

    public ResourceExpiredException(String code, String message) {
        super(410, code, message);
    }
}
