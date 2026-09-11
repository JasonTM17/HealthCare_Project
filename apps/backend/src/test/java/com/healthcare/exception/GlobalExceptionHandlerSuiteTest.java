package com.healthcare.exception;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MissingPathVariableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerSuiteTest {

    private GlobalExceptionHandler handler;
    private ServletWebRequest request;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/api/v1/test");
        request = new ServletWebRequest(servletRequest);
    }

    @Test
    @DisplayName("BadRequestException maps to 400 and VALIDATION_ERROR")
    void handleBadRequestException() {
        BadRequestException ex = new BadRequestException("Tham số không hợp lệ");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.VALIDATION_ERROR);
        assertThat(response.getBody().message()).isEqualTo("Tham số không hợp lệ");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/test");
    }

    @Test
    @DisplayName("UnauthorizedException maps to 401 and AUTHENTICATION_REQUIRED")
    void handleUnauthorizedException() {
        UnauthorizedException ex = new UnauthorizedException("Phiên đăng nhập đã hết hạn");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.AUTHENTICATION_REQUIRED);
    }

    @Test
    @DisplayName("ForbiddenException maps to 403 and ACCESS_DENIED")
    void handleForbiddenException() {
        ForbiddenException ex = new ForbiddenException("Không có quyền truy cập");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.ACCESS_DENIED);
    }

    @Test
    @DisplayName("ConflictException maps to 409 and CONFLICT")
    void handleConflictException() {
        ConflictException ex = new ConflictException("Tài nguyên đã tồn tại");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.CONFLICT);
    }

    @Test
    @DisplayName("ResourceExpiredException maps to 410 and RESOURCE_EXPIRED")
    void handleResourceExpiredException() {
        ResourceExpiredException ex = new ResourceExpiredException("Mã kích hoạt đã hết hạn");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.RESOURCE_EXPIRED);
    }

    @Test
    @DisplayName("RateLimitExceededException maps to 429 and RATE_LIMIT_EXCEEDED")
    void handleRateLimitExceededException() {
        RateLimitExceededException ex = new RateLimitExceededException("Quá nhiều yêu cầu");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.RATE_LIMIT_EXCEEDED);
    }

    @Test
    @DisplayName("ServiceUnavailableException maps to 503 and SERVICE_UNAVAILABLE")
    void handleServiceUnavailableException() {
        ServiceUnavailableException ex = new ServiceUnavailableException("Hệ thống bảo trì");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.SERVICE_UNAVAILABLE);
    }

    @Test
    @DisplayName("AppointmentConflictException maps to 409 and APPOINTMENT_CONFLICT")
    void handleAppointmentConflictException() {
        AppointmentConflictException ex = new AppointmentConflictException("Lịch khám đã có bệnh nhân đặt");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.APPOINTMENT_CONFLICT);
    }

    @Test
    @DisplayName("DoctorUnavailableException maps to 409 and DOCTOR_UNAVAILABLE")
    void handleDoctorUnavailableException() {
        DoctorUnavailableException ex = new DoctorUnavailableException("Bác sĩ không có lịch làm việc");
        var response = handler.handleBusinessException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.DOCTOR_UNAVAILABLE);
    }

    @Test
    @DisplayName("ValidationException maps to 400 with field errors")
    void handleValidationException() {
        List<ApiError.FieldError> fieldErrors = List.of(
            new ApiError.FieldError("patientName", "Tên không được để trống"),
            new ApiError.FieldError("email", "Email không đúng định dạng")
        );
        ValidationException ex = new ValidationException("Dữ liệu không hợp lệ", fieldErrors);
        var response = handler.handleValidationException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.VALIDATION_ERROR);
        assertThat(response.getBody().fieldErrors()).hasSize(2);
        assertThat(response.getBody().fieldErrors().get(0).field()).isEqualTo("patientName");
    }

    @Test
    @DisplayName("IllegalArgumentException maps to 400 Bad Request instead of 500")
    void handleIllegalArgumentException() {
        IllegalArgumentException ex = new IllegalArgumentException("Độ tuổi không được âm");
        var response = handler.handleIllegalArgument(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.VALIDATION_ERROR);
        assertThat(response.getBody().message()).isEqualTo("Độ tuổi không được âm");
    }

    @Test
    @DisplayName("IllegalStateException maps to 409 Conflict instead of 500")
    void handleIllegalStateException() {
        IllegalStateException ex = new IllegalStateException("Lịch hẹn đã hoàn thành không thể hủy");
        var response = handler.handleIllegalState(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.CONFLICT);
        assertThat(response.getBody().message()).isEqualTo("Lịch hẹn đã hoàn thành không thể hủy");
    }

    @Test
    @DisplayName("NoSuchElementException maps to 404 Not Found")
    void handleNoSuchElementException() {
        NoSuchElementException ex = new NoSuchElementException("Không tìm thấy hồ sơ");
        var response = handler.handleNoSuchElement(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.RESOURCE_NOT_FOUND);
        assertThat(response.getBody().message()).isEqualTo("Không tìm thấy hồ sơ");
    }

    @Test
    @DisplayName("EmptyResultDataAccessException maps to 404 Not Found")
    void handleEmptyResultDataAccessException() {
        EmptyResultDataAccessException ex = new EmptyResultDataAccessException("Không có kết quả", 1);
        var response = handler.handleNoSuchElement(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    @Test
    @DisplayName("ConstraintViolationException maps to 400 Bad Request with field errors")
    void handleConstraintViolationException() {
        ConstraintViolation<?> violation = mock(ConstraintViolation.class);
        Path path = mock(Path.class);
        when(path.toString()).thenReturn("createBooking.patientPhone");
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("Số điện thoại không hợp lệ");

        ConstraintViolationException ex = new ConstraintViolationException(Set.of(violation));
        var response = handler.handleConstraintViolation(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.VALIDATION_ERROR);
        assertThat(response.getBody().fieldErrors()).hasSize(1);
        assertThat(response.getBody().fieldErrors().get(0).field()).isEqualTo("patientPhone");
        assertThat(response.getBody().fieldErrors().get(0).message()).isEqualTo("Số điện thoại không hợp lệ");
    }

    @Test
    @DisplayName("MissingPathVariableException maps to 400 Bad Request")
    void handleMissingPathVariableException() throws NoSuchMethodException {
        Method method = this.getClass().getDeclaredMethod("setUp");
        MethodParameter parameter = new MethodParameter(method, -1);
        MissingPathVariableException ex = new MissingPathVariableException("doctorId", parameter);

        var response = handler.handleMissingPathVariable(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.VALIDATION_ERROR);
        assertThat(response.getBody().message()).contains("doctorId");
    }

    @Test
    @DisplayName("MissingRequestHeaderException maps to 400 Bad Request")
    void handleMissingRequestHeaderException() throws NoSuchMethodException {
        Method method = this.getClass().getDeclaredMethod("setUp");
        MethodParameter parameter = new MethodParameter(method, -1);
        MissingRequestHeaderException ex = new MissingRequestHeaderException("X-Idempotency-Key", parameter);

        var response = handler.handleMissingRequestHeader(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.VALIDATION_ERROR);
        assertThat(response.getBody().message()).contains("X-Idempotency-Key");
    }

    @Test
    @DisplayName("ObjectOptimisticLockingFailureException maps to 409 Conflict")
    void handleOptimisticLockingFailure() {
        ObjectOptimisticLockingFailureException ex =
            new ObjectOptimisticLockingFailureException("Appointment", "123");
        var response = handler.handleOptimisticLockingFailure(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.CONFLICT);
        assertThat(response.getBody().message()).contains("Dữ liệu đã được cập nhật");
    }

    @Test
    @DisplayName("ResponseStatusException maps dynamic status codes to accurate ErrorCodes")
    void handleResponseStatusExceptionDynamicMapping() {
        var resp400 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad data"), request);
        assertThat(resp400.getBody().code()).isEqualTo(ErrorCodes.BAD_REQUEST);

        var resp401 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.UNAUTHORIZED), request);
        assertThat(resp401.getBody().code()).isEqualTo(ErrorCodes.AUTHENTICATION_REQUIRED);

        var resp403 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.FORBIDDEN), request);
        assertThat(resp403.getBody().code()).isEqualTo(ErrorCodes.ACCESS_DENIED);

        var resp404 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.NOT_FOUND), request);
        assertThat(resp404.getBody().code()).isEqualTo(ErrorCodes.RESOURCE_NOT_FOUND);

        var resp409 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.CONFLICT), request);
        assertThat(resp409.getBody().code()).isEqualTo(ErrorCodes.CONFLICT);

        var resp410 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.GONE), request);
        assertThat(resp410.getBody().code()).isEqualTo(ErrorCodes.RESOURCE_EXPIRED);

        var resp429 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS), request);
        assertThat(resp429.getBody().code()).isEqualTo(ErrorCodes.RATE_LIMIT_EXCEEDED);

        var resp503 = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE), request);
        assertThat(resp503.getBody().code()).isEqualTo(ErrorCodes.SERVICE_UNAVAILABLE);
    }
}
