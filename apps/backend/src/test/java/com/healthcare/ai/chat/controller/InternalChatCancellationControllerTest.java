package com.healthcare.ai.chat.controller;

import com.healthcare.ai.chat.service.ChatRequestCancellationRegistry;
import com.healthcare.auth.security.BffRequestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

class InternalChatCancellationControllerTest {

    @Test
    void reportsServiceUnavailableWhenSharedCancellationStateCannotBeWritten() {
        String token = "test-bff-cancellation-token-32-bytes-minimum";
        String requestId = UUID.randomUUID().toString();
        BffRequestVerifier verifier = new BffRequestVerifier(new MockEnvironment()
            .withProperty("app.security.bff.service-token", token)
            .withProperty("app.security.bff.required", "true"));
        ChatRequestCancellationRegistry cancellations = mock(ChatRequestCancellationRegistry.class);
        doThrow(new IllegalStateException("synthetic Redis outage"))
            .when(cancellations)
            .cancel(requestId);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(BffRequestVerifier.CREDENTIAL_HEADER, token);

        InternalChatCancellationController controller = new InternalChatCancellationController(
            verifier,
            cancellations);

        assertThatThrownBy(() -> controller.cancel(request, UUID.fromString(requestId)))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));
    }
}
