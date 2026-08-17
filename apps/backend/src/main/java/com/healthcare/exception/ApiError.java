package com.healthcare.exception;

import java.time.Instant;
import java.util.List;

public record ApiError(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path,
    List<FieldError> fieldErrors
) {
    public ApiError(int status, String error, String message, String path) {
        this(Instant.now(), status, error, message, path, List.of());
    }

    public ApiError(int status, String error, String message, String path, List<FieldError> fieldErrors) {
        this(Instant.now(), status, error, message, path, fieldErrors);
    }

    public record FieldError(String field, String message) {
    }
}
