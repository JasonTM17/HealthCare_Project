package com.healthcare.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.List;

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
            extractPath(request)
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
            fieldErrors
        );
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

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex, WebRequest request) {
        ApiError error = new ApiError(
            401,
            "Unauthorized",
            "Invalid email or password",
            extractPath(request)
        );
        return ResponseEntity.status(401).body(error);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex, WebRequest request) {
        ApiError error = new ApiError(
            401,
            "Unauthorized",
            ex.getMessage(),
            extractPath(request)
        );
        return ResponseEntity.status(401).body(error);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        ApiError error = new ApiError(
            403,
            "Forbidden",
            "Access denied",
            extractPath(request)
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

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex, WebRequest request) {
        int status = ex.getStatusCode().value();
        HttpStatus httpStatus = HttpStatus.resolve(status);
        String message = ex.getReason() != null
            ? ex.getReason()
            : (httpStatus != null ? httpStatus.getReasonPhrase() : "Request failed");
        ApiError error = new ApiError(
            status,
            httpStatus != null ? httpStatus.getReasonPhrase() : "Request failed",
            message,
            extractPath(request)
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
            extractPath(request)
        );
        return ResponseEntity.status(500).body(error);
    }

    private String extractPath(WebRequest request) {
        if (request instanceof ServletWebRequest servletWebRequest) {
            return servletWebRequest.getRequest().getRequestURI();
        }
        return "";
    }
}
