package com.healthcare.exception;

public class ServiceUnavailableException extends BusinessException {

    public ServiceUnavailableException(String message) {
        super(503, ErrorCodes.SERVICE_UNAVAILABLE, message);
    }

    public ServiceUnavailableException(String code, String message) {
        super(503, code, message);
    }
}
