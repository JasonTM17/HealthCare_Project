package com.healthcare.exception;

public class BusinessException extends RuntimeException {

    private final int status;
    private final String code;

    public BusinessException(int status, String message) {
        this(status, defaultCode(status), message);
    }

    public BusinessException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    private static String defaultCode(int status) {
        return switch (status) {
            case 400 -> ErrorCodes.REQUEST_FAILED;
            case 401 -> ErrorCodes.INVALID_CREDENTIALS;
            case 403 -> ErrorCodes.ACCESS_DENIED;
            case 404 -> ErrorCodes.RESOURCE_NOT_FOUND;
            case 409 -> ErrorCodes.CONFLICT;
            case 429 -> ErrorCodes.RATE_LIMIT_EXCEEDED;
            default -> ErrorCodes.REQUEST_FAILED;
        };
    }
}
