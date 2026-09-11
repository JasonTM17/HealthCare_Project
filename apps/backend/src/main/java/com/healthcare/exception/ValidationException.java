package com.healthcare.exception;

import java.util.List;

public class ValidationException extends BusinessException {

    private final List<ApiError.FieldError> fieldErrors;

    public ValidationException(String message) {
        this(ErrorCodes.VALIDATION_ERROR, message, List.of());
    }

    public ValidationException(String message, List<ApiError.FieldError> fieldErrors) {
        this(ErrorCodes.VALIDATION_ERROR, message, fieldErrors);
    }

    public ValidationException(String code, String message, List<ApiError.FieldError> fieldErrors) {
        super(400, code, message);
        this.fieldErrors = fieldErrors != null ? fieldErrors : List.of();
    }

    public List<ApiError.FieldError> getFieldErrors() {
        return fieldErrors;
    }
}
