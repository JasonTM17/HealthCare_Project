package com.healthcare.exception;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.entity.FeedbackRating;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MissingPathVariableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import jakarta.validation.ConstraintViolationException;

import java.util.List;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler({AsyncRequestNotUsableException.class, AsyncRequestTimeoutException.class})
    public ResponseEntity<Void> handleCompletedAsyncRequest(Exception ex, WebRequest request) {
        // SSE disconnects/timeouts are normal lifecycle events. In particular, never send
        // the JSON ApiError envelope after text/event-stream has already been selected.
        log.debug("Async response completed for {}: {}", extractPath(request), ex.getMessage());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiError> handleBusinessException(BusinessException ex, WebRequest request) {
        ApiError error = new ApiError(
            ex.getStatus(),
            HttpStatus.valueOf(ex.getStatus()).getReasonPhrase(),
            ex.getMessage(),
            extractPath(request),
            List.of(),
            ex.getCode()
        );
        return ResponseEntity.status(ex.getStatus()).body(error);
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiError> handleValidationException(ValidationException ex, WebRequest request) {
        ApiError error = new ApiError(
            ex.getStatus(),
            HttpStatus.valueOf(ex.getStatus()).getReasonPhrase(),
            ex.getMessage(),
            extractPath(request),
            ex.getFieldErrors(),
            ex.getCode()
        );
        return ResponseEntity.status(ex.getStatus()).body(error);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, WebRequest request) {
        ApiError error = new ApiError(
            404,
            "Not Found",
            ex.getMessage(),
            extractPath(request)
        );
        return ResponseEntity.status(404).body(error);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiError> handleDuplicate(DuplicateResourceException ex, WebRequest request) {
        ApiError error = new ApiError(
            409,
            "Conflict",
            ex.getMessage(),
            extractPath(request)
        );
        return ResponseEntity.status(409).body(error);
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrityViolation(org.springframework.dao.DataIntegrityViolationException ex, WebRequest request) {
        log.warn("Data integrity constraint violated on {}: {}", extractPath(request), ex.getMessage());
        ApiError error = new ApiError(
            409,
            "Conflict",
            "Dữ liệu đang được liên kết hoặc vi phạm ràng buộc toàn vẹn của hệ thống. Vui lòng kiểm tra lại.",
            extractPath(request)
        );
        return ResponseEntity.status(409).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, WebRequest request) {
        List<ApiError.FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
            .toList();

        ApiError error = new ApiError(
            400,
            "Bad Request",
            "Thông tin gửi lên chưa hợp lệ.",
            extractPath(request),
            fieldErrors,
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex, WebRequest request) {
        String code;
        String message;
        if (isInvalidChatMode(ex)) {
            code = ErrorCodes.CHAT_MODE_INVALID;
            message = "Invalid chat mode";
        } else if (isInvalidFeedbackRating(ex)) {
            code = ErrorCodes.CHAT_FEEDBACK_INVALID;
            message = "Invalid feedback rating";
        } else {
            code = ErrorCodes.REQUEST_FAILED;
            message = "Request body is invalid";
        }
        ApiError error = new ApiError(400, "Bad Request", message, extractPath(request), List.of(), code);
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingRequestParameter(
            MissingServletRequestParameterException ex,
            WebRequest request) {
        ApiError error = new ApiError(
            400,
            "Bad Request",
            "Required request parameter is missing: " + ex.getParameterName(),
            extractPath(request)
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleArgumentTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            WebRequest request) {
        ApiError error = new ApiError(
            400,
            "Bad Request",
            "Tham số yêu cầu không hợp lệ.",
            extractPath(request),
            List.of(),
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(
            ConstraintViolationException ex,
            WebRequest request) {
        List<ApiError.FieldError> fieldErrors = ex.getConstraintViolations().stream()
            .map(cv -> {
                String path = cv.getPropertyPath() != null ? cv.getPropertyPath().toString() : "";
                int lastDot = path.lastIndexOf('.');
                String fieldName = (lastDot >= 0 && lastDot < path.length() - 1) ? path.substring(lastDot + 1) : path;
                return new ApiError.FieldError(fieldName, cv.getMessage());
            })
            .toList();

        ApiError error = new ApiError(
            400,
            "Bad Request",
            "Thông tin tham số chưa hợp lệ.",
            extractPath(request),
            fieldErrors,
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(MissingPathVariableException.class)
    public ResponseEntity<ApiError> handleMissingPathVariable(
            MissingPathVariableException ex,
            WebRequest request) {
        ApiError error = new ApiError(
            400,
            "Bad Request",
            "Required path variable is missing: " + ex.getVariableName(),
            extractPath(request),
            List.of(),
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiError> handleMissingRequestHeader(
            MissingRequestHeaderException ex,
            WebRequest request) {
        ApiError error = new ApiError(
            400,
            "Bad Request",
            "Required request header is missing: " + ex.getHeaderName(),
            extractPath(request),
            List.of(),
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException ex, WebRequest request) {
        // Without this the multipart limit surfaces as a generic 500; clients
        // need 413 so the UI can ask for a smaller file.
        log.info("Rejected oversized upload for {}: {}", extractPath(request), ex.getMessage());
        ApiError error = new ApiError(
            413,
            "Payload Too Large",
            "Tệp tải lên vượt quá giới hạn cho phép.",
            extractPath(request),
            List.of(),
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.status(413).body(error);
    }

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotSupported(
            org.springframework.web.HttpRequestMethodNotSupportedException ex,
            WebRequest request) {
        ApiError error = new ApiError(
            405,
            "Method Not Allowed",
            "HTTP method not allowed for this endpoint",
            extractPath(request)
        );
        return ResponseEntity.status(405).body(error);
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> handleMediaTypeNotSupported(
            org.springframework.web.HttpMediaTypeNotSupportedException ex,
            WebRequest request) {
        ApiError error = new ApiError(
            415,
            "Unsupported Media Type",
            "Unsupported request content type",
            extractPath(request)
        );
        return ResponseEntity.status(415).body(error);
    }

    @ExceptionHandler(org.springframework.web.multipart.support.MissingServletRequestPartException.class)
    public ResponseEntity<ApiError> handleMissingRequestPart(
            org.springframework.web.multipart.support.MissingServletRequestPartException ex,
            WebRequest request) {
        ApiError error = new ApiError(
            400,
            "Bad Request",
            "Required request part is missing: " + ex.getRequestPartName(),
            extractPath(request),
            List.of(),
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex, WebRequest request) {
        ApiError error = new ApiError(
            401,
            "Unauthorized",
            "Invalid email or password",
            extractPath(request),
            List.of(),
            ErrorCodes.INVALID_CREDENTIALS
        );
        return ResponseEntity.status(401).body(error);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex, WebRequest request) {
        ApiError error = new ApiError(
            401,
            "Unauthorized",
            ex.getMessage(),
            extractPath(request),
            List.of(),
            ErrorCodes.AUTHENTICATION_FAILED
        );
        return ResponseEntity.status(401).body(error);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        ApiError error = new ApiError(
            403,
            "Forbidden",
            "Access denied",
            extractPath(request),
            List.of(),
            ErrorCodes.ACCESS_DENIED
        );
        return ResponseEntity.status(403).body(error);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiError> handleNoHandler(NoHandlerFoundException ex, WebRequest request) {
        ApiError error = new ApiError(
            404,
            "Not Found",
            "Resource not found",
            extractPath(request)
        );
        return ResponseEntity.status(404).body(error);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResourceFound(NoResourceFoundException ex, WebRequest request) {
        ApiError error = new ApiError(
            404,
            "Not Found",
            "Resource not found",
            extractPath(request)
        );
        return ResponseEntity.status(404).body(error);
    }

    /*
     * Contract ruling (2026-09-11): IAE/ISE/NSE are the repo's controlled
     * channel for user-ready Vietnamese domain copy ("Lịch hẹn đã hoàn thành
     * không thể hủy"…), pinned by GlobalExceptionHandlerSuiteTest. Throw sites
     * are therefore author-disciplined; the typed exception taxonomy is the
     * long-term replacement (phase-08). Keep passthrough with server logs.
     */

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex, WebRequest request) {
        log.warn("Illegal argument on {}: {}", extractPath(request), ex.getMessage());
        ApiError error = new ApiError(
            400,
            "Bad Request",
            ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : "Yêu cầu không hợp lệ.",
            extractPath(request),
            List.of(),
            ErrorCodes.VALIDATION_ERROR
        );
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> handleIllegalState(IllegalStateException ex, WebRequest request) {
        log.warn("Illegal state on {}: {}", extractPath(request), ex.getMessage());
        ApiError error = new ApiError(
            409,
            "Conflict",
            ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : "Trạng thái hiện tại không cho phép thực hiện thao tác này.",
            extractPath(request),
            List.of(),
            ErrorCodes.CONFLICT
        );
        return ResponseEntity.status(409).body(error);
    }

    @ExceptionHandler({NoSuchElementException.class, EmptyResultDataAccessException.class})
    public ResponseEntity<ApiError> handleNoSuchElement(Exception ex, WebRequest request) {
        log.info("Resource not found on {}: {}", extractPath(request), ex.getMessage());
        ApiError error = new ApiError(
            404,
            "Not Found",
            ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : "Không tìm thấy tài nguyên yêu cầu.",
            extractPath(request),
            List.of(),
            ErrorCodes.RESOURCE_NOT_FOUND
        );
        return ResponseEntity.status(404).body(error);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleOptimisticLockingFailure(ObjectOptimisticLockingFailureException ex, WebRequest request) {
        log.warn("Optimistic locking failure on {}: {}", extractPath(request), ex.getMessage());
        ApiError error = new ApiError(
            409,
            "Conflict",
            "Dữ liệu đã được cập nhật bởi một thao tác khác cùng thời điểm. Vui lòng tải lại và thử lại.",
            extractPath(request),
            List.of(),
            ErrorCodes.CONFLICT
        );
        return ResponseEntity.status(409).body(error);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex, WebRequest request) {
        int status = ex.getStatusCode().value();
        HttpStatus httpStatus = HttpStatus.resolve(status);
        String message = ex.getReason() != null
            ? ex.getReason()
            : (httpStatus != null ? httpStatus.getReasonPhrase() : "Request failed");
        String code = switch (status) {
            case 400 -> ErrorCodes.BAD_REQUEST;
            case 401 -> ErrorCodes.AUTHENTICATION_REQUIRED;
            case 403 -> ErrorCodes.ACCESS_DENIED;
            case 404 -> ErrorCodes.RESOURCE_NOT_FOUND;
            case 409 -> ErrorCodes.CONFLICT;
            case 410 -> ErrorCodes.RESOURCE_EXPIRED;
            case 429 -> ErrorCodes.RATE_LIMIT_EXCEEDED;
            case 503 -> ErrorCodes.SERVICE_UNAVAILABLE;
            default -> status >= 500 ? ErrorCodes.INTERNAL_ERROR : ErrorCodes.REQUEST_FAILED;
        };
        ApiError error = new ApiError(
            status,
            httpStatus != null ? httpStatus.getReasonPhrase() : "Request failed",
            message,
            extractPath(request),
            List.of(),
            code
        );
        return ResponseEntity.status(status).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric(Exception ex, WebRequest request) {
        log.error("Unhandled exception while processing request {}", extractPath(request), ex);
        ApiError error = new ApiError(
            500,
            "Internal Server Error",
            "An unexpected error occurred",
            extractPath(request),
            List.of(),
            ErrorCodes.INTERNAL_ERROR
        );
        return ResponseEntity.status(500).body(error);
    }

    private String extractPath(WebRequest request) {
        if (request instanceof ServletWebRequest servletWebRequest) {
            return servletWebRequest.getRequest().getRequestURI();
        }
        return "";
    }

    private boolean isInvalidChatMode(Throwable failure) {
        Throwable current = failure;
        while (current != null) {
            if (current instanceof InvalidFormatException invalid
                    && ChatMode.class.equals(invalid.getTargetType())) {
                return true;
            }
            if (current instanceof JsonMappingException mapping
                    && mapping.getPath().stream().anyMatch(reference -> "mode".equals(reference.getFieldName()))) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean isInvalidFeedbackRating(Throwable failure) {
        Throwable current = failure;
        while (current != null) {
            if (current instanceof InvalidFormatException invalid
                    && FeedbackRating.class.equals(invalid.getTargetType())) {
                return true;
            }
            if (current instanceof JsonMappingException mapping
                    && mapping.getPath().stream().anyMatch(reference -> "rating".equals(reference.getFieldName()))) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
