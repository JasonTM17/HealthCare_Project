package com.healthcare.exception;

public class RateLimitExceededException extends BusinessException {

    public RateLimitExceededException(String message) {
        super(429, ErrorCodes.RATE_LIMIT_EXCEEDED, message);
    }

    public RateLimitExceededException(String code, String message) {
        super(429, code, message);
    }
}
