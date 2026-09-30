package com.healthcare.infrastructure;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * The warmer must never throw into the scheduler: a missed ping is the
 * expected state it exists to fix, so both a healthy 200 and an upstream
 * failure have to stay silent no-throw ticks.
 */
@ExtendWith(MockitoExtension.class)
class SelfWarmerTest {

    @Mock
    private RestTemplate restTemplate;

    @Test
    void warm_withHealthyEndpoints_doesNotThrowAndPingsBothTargets() {
        whenGetForEntityReturnsOk();
        SelfWarmer warmer = new SelfWarmer(10000, "http://localhost:8000", restTemplate);

        assertThatCode(warmer::warm).doesNotThrowAnyException();

        verify(restTemplate).getForEntity(URI.create("http://127.0.0.1:10000/actuator/health"), String.class);
        verify(restTemplate).getForEntity(URI.create("http://localhost:8000/livez"), String.class);
    }

    @Test
    void warm_whenAiServiceUnreachable_swallowsAndStillPingsBackend() {
        whenGetForEntityReturnsOk();
        doThrow(new RestClientException("connection refused"))
            .when(restTemplate).getForEntity(URI.create("http://ai:8000/livez"), String.class);
        SelfWarmer warmer = new SelfWarmer(8080, "ai:8000", restTemplate);

        assertThatCode(warmer::warm).doesNotThrowAnyException();

        // The bare host:port form (Render fromService hostport) is normalized
        // to an absolute http URL before the ping, and the backend ping still
        // ran despite the ai-service failure.
        verify(restTemplate).getForEntity(URI.create("http://ai:8000/livez"), String.class);
        verify(restTemplate).getForEntity(URI.create("http://127.0.0.1:8080/actuator/health"), String.class);
    }

    /**
     * L1: after every restart/deploy the first scheduled tick only fires after
     * up to the full interval, leaving the ai-service cold for minutes while
     * chat turns hit the BFF deadline. The warmer must run once the moment the
     * application is ready — and that immediate run must still be exactly the
     * two cheap GETs (own /actuator/health + ai-service /livez), never a
     * chat/quota endpoint.
     */
    @Test
    void onApplicationReady_firesWarmImmediatelyWithOnlyTheTwoHealthGets() {
        whenGetForEntityReturnsOk();
        SelfWarmer warmer = new SelfWarmer(10000, "http://localhost:8000", restTemplate);

        assertThatCode(warmer::onApplicationReady).doesNotThrowAnyException();

        verify(restTemplate, org.mockito.Mockito.times(1))
            .getForEntity(URI.create("http://127.0.0.1:10000/actuator/health"), String.class);
        verify(restTemplate, org.mockito.Mockito.times(1))
            .getForEntity(URI.create("http://localhost:8000/livez"), String.class);
    }

    @Test
    void onApplicationReady_whenAiServiceCold_swallowsAndStillPingsBackend() {
        whenGetForEntityReturnsOk();
        doThrow(new RestClientException("connection refused"))
            .when(restTemplate).getForEntity(URI.create("http://localhost:8000/livez"), String.class);
        SelfWarmer warmer = new SelfWarmer(10000, "http://localhost:8000", restTemplate);

        assertThatCode(warmer::onApplicationReady).doesNotThrowAnyException();

        verify(restTemplate).getForEntity(URI.create("http://127.0.0.1:10000/actuator/health"), String.class);
    }

    private void whenGetForEntityReturnsOk() {
        org.mockito.Mockito.when(restTemplate.getForEntity(any(URI.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok("ok"));
    }
}
