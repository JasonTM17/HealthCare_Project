package com.healthcare.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.HttpMethod;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.mockito.Mockito.mock;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerAsyncTest {

    @Test
    void completedSseRequestHasNoJsonErrorBody() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/cms/content/events");

        var response = handler.handleCompletedAsyncRequest(
            new AsyncRequestNotUsableException("client disconnected"),
            new ServletWebRequest(request)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(response.getBody()).isNull();
    }

    @Test
    void timedOutSseRequestHasNoJsonErrorBody() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/cms/content/events");

        var response = handler.handleCompletedAsyncRequest(
            new AsyncRequestTimeoutException(),
            new ServletWebRequest(request)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(response.getBody()).isNull();
    }

    @Test
    void malformedPathParameterIsAClientErrorWithoutTechnicalDetails() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest(
            "GET", "/api/v1/doctor/consultations/not-a-uuid");

        var response = handler.handleArgumentTypeMismatch(
            mock(MethodArgumentTypeMismatchException.class),
            new ServletWebRequest(request)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.VALIDATION_ERROR);
        assertThat(response.getBody().message()).isEqualTo("Tham số yêu cầu không hợp lệ.");
        assertThat(response.getBody().message()).doesNotContain("UUID", "Invalid", "java.");
    }

    @Test
    void unknownStaticResourceIsA404WithoutTechnicalDetails() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/hospital/=0&size=1");

        var response = handler.handleNoResourceFound(
            new NoResourceFoundException(HttpMethod.GET, "api/v1/hospital/=0&size=1"),
            new ServletWebRequest(request)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(ErrorCodes.RESOURCE_NOT_FOUND);
        assertThat(response.getBody().message()).isEqualTo("Resource not found");
        assertThat(response.getBody().message()).doesNotContain("NoResourceFoundException", "java.");
    }
}
