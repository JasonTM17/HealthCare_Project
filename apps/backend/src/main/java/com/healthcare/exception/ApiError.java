package com.healthcare.exception;

import java.time.Instant;
import java.util.List;

public record ApiError(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path,
    List<FieldError> fieldErrors,
    String code
) {
    public ApiError(int status, String error, String message, String path) {
        this(Instant.now(), status, error, message, path, List.of(), defaultCode(status));
    }

    public ApiError(int status, String error, String message, String path, List<FieldError> fieldErrors) {
        this(Instant.now(), status, error, message, path, fieldErrors, defaultCode(status));
    }

    public ApiError(int status, String error, String message, String path,
                    List<FieldError> fieldErrors, String code) {
        this(Instant.now(), status, error, message, path, fieldErrors, code);
    }

    private static String defaultCode(int status) {
        return switch (status) {
            case 400 -> ErrorCodes.REQUEST_FAILED;
            case 401 -> ErrorCodes.AUTHENTICATION_REQUIRED;
            case 403 -> ErrorCodes.ACCESS_DENIED;
            case 404 -> ErrorCodes.RESOURCE_NOT_FOUND;
            case 409 -> ErrorCodes.CONFLICT;
            case 429 -> ErrorCodes.RATE_LIMIT_EXCEEDED;
            default -> status >= 500 ? ErrorCodes.INTERNAL_ERROR : ErrorCodes.REQUEST_FAILED;
        };
    }

    public record FieldError(String field, String message) {
    }
}
