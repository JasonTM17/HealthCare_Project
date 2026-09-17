package com.healthcare.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.context.request.WebRequest;

/**
 * The API returns user-ready Vietnamese copy straight from
 * {@link IllegalArgumentException} and friends, which is a deliberate contract.
 * The same types are also thrown by the JDK, where the message describes the
 * implementation instead: a malformed UUID or an unknown enum constant reflects
 * a fully-qualified class name and the raw input back to the caller. These
 * tests pin the line between the two.
 */
class ClientSafeErrorDetailTest {

    @Test
    @DisplayName("domain copy survives unchanged")
    void keepsDomainCopy() {
        assertThat(ClientSafeErrorDetail.forClient("Độ tuổi không được âm"))
            .isEqualTo("Độ tuổi không được âm");
        assertThat(ClientSafeErrorDetail.forClient("Lịch hẹn đã hoàn thành không thể hủy"))
            .isEqualTo("Lịch hẹn đã hoàn thành không thể hủy");
        assertThat(ClientSafeErrorDetail.forClient("Không tìm thấy hồ sơ"))
            .isEqualTo("Không tìm thấy hồ sơ");
    }

    @Test
    @DisplayName("a reflected enum constant is withheld")
    void withholdsEnumConstantDetail() {
        assertThat(ClientSafeErrorDetail.forClient(
            "No enum constant com.healthcare.hospital.entity.ArticleStatus.PUBLISHD"))
            .isNull();
    }

    @Test
    @DisplayName("a reflected UUID is withheld")
    void withholdsUuidDetail() {
        assertThat(ClientSafeErrorDetail.forClient("Invalid UUID string: not-a-uuid"))
            .isNull();
    }

    @Test
    @DisplayName("JVM diagnostics are withheld")
    void withholdsJvmDiagnostics() {
        assertThat(ClientSafeErrorDetail.forClient("Cannot invoke \"String.length()\" because ...")).isNull();
        assertThat(ClientSafeErrorDetail.forClient("class java.lang.String cannot be cast to ...")).isNull();
        assertThat(ClientSafeErrorDetail.forClient("For input string: \"abc\"")).isNull();
        assertThat(ClientSafeErrorDetail.forClient("No value present")).isNull();
    }

    @Test
    @DisplayName("a stack frame is withheld")
    void withholdsStackTraceFragment() {
        assertThat(ClientSafeErrorDetail.forClient(
            "failed at com.healthcare.hospital.service.AdminArticleService.create(AdminArticleService.java:58)"))
            .isNull();
    }

    @Test
    @DisplayName("blank and null fall through to the generic message")
    void withholdsBlank() {
        assertThat(ClientSafeErrorDetail.forClient(null)).isNull();
        assertThat(ClientSafeErrorDetail.forClient("   ")).isNull();
    }

    @Test
    @DisplayName("the handler substitutes its generic copy rather than leaking")
    void handlerSubstitutesGenericCopy() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        WebRequest request = mock(WebRequest.class);

        var response = handler.handleIllegalArgument(
            new IllegalArgumentException(
                "No enum constant com.healthcare.hospital.entity.ArticleStatus.PUBLISHD"),
            request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("Yêu cầu không hợp lệ.");
        assertThat(response.getBody().message()).doesNotContain("com.healthcare");
    }

    @Test
    @DisplayName("the handler still returns domain copy verbatim")
    void handlerKeepsDomainCopy() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        WebRequest request = mock(WebRequest.class);

        var response = handler.handleIllegalArgument(
            new IllegalArgumentException("Độ tuổi không được âm"), request);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("Độ tuổi không được âm");
    }
}
