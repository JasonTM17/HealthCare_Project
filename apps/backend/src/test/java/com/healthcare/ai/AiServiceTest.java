package com.healthcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.service.AiService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AiServiceTest {

    private AiService aiService;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        aiService = new AiService(new RestTemplateBuilder(), new ObjectMapper());
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(aiService, "restTemplate");
        ReflectionTestUtils.setField(aiService, "aiServiceUrl", "http://ai.test");
        ReflectionTestUtils.setField(aiService, "aiServiceRuntime", "local");
        ReflectionTestUtils.setField(aiService, "allowUnauthenticatedLocal", true);
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    @Test
    void symptomCheckUsesFastApiTriageContract() {
        server.expect(requestTo("http://ai.test/triage"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().json("{\"symptoms\":\"đau đầu\"}"))
            .andRespond(withSuccess("{\"recommended_specialty\":\"Nội thần kinh\"}", MediaType.APPLICATION_JSON));

        Map<String, Object> response = aiService.symptomCheck(Map.of("symptoms", "đau đầu"));

        assertThat(response).containsEntry("recommended_specialty", "Nội thần kinh");
        server.verify();
    }

    @Test
    void liveGatewayUsesHttp11InsteadOfH2cUpgrade() throws Exception {
        AtomicReference<String> upgradeHeader = new AtomicReference<>();
        HttpServer httpServer = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        httpServer.createContext("/triage", exchange -> {
            upgradeHeader.set(exchange.getRequestHeaders().getFirst("Upgrade"));
            byte[] response = "{\"recommended_specialty\":\"Nội thần kinh\"}"
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(response);
            }
        });
        httpServer.start();

        try {
            AiService liveService = new AiService(new RestTemplateBuilder(), new ObjectMapper());
            ReflectionTestUtils.setField(
                liveService,
                "aiServiceUrl",
                "http://localhost:" + httpServer.getAddress().getPort()
            );
            ReflectionTestUtils.setField(liveService, "aiServiceToken", "shared-service-token");

            assertThat(liveService.symptomCheck(Map.of("symptoms", "đau đầu")))
                .containsEntry("recommended_specialty", "Nội thần kinh");
            assertThat(upgradeHeader.get()).isNull();
        } finally {
            httpServer.stop(0);
        }
    }

    @Test
    void invalidSymptomsAreRejectedBeforeCallingUpstream() {
        assertThatThrownBy(() -> aiService.symptomCheck(Map.of("symptoms", "x")))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(BAD_REQUEST));
    }

    @Test
    void upstreamFailureBecomesBadGateway() {
        server.expect(requestTo("http://ai.test/recommendations/specialty"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withServerError());

        assertThatThrownBy(() -> aiService.recommendSpecialty(Map.of("symptoms", "đau đầu")))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(BAD_GATEWAY));
        server.verify();
    }

    @Test
    void semanticSearchUsesBoundedGatewayContract() {
        server.expect(requestTo("http://ai.test/search"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().json("{\"query\":\"headache\",\"top_k\":2}"))
            .andRespond(withSuccess("{\"results\":[],\"query\":\"headache\"}", MediaType.APPLICATION_JSON));

        Map<String, Object> response = aiService.search("  headache  ", 2);

        assertThat(response).containsEntry("query", "headache");
        server.verify();
    }

    @Test
    void configuredInputLimitIsEnforcedBeforeUpstreamCall() {
        ReflectionTestUtils.setField(aiService, "maxInputChars", 4);

        assertThatThrownBy(() -> aiService.symptomCheck(Map.of("symptoms", "đau đầu")))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(BAD_REQUEST));
    }

    @Test
    void oversizedUpstreamResponseBecomesBadGateway() {
        ReflectionTestUtils.setField(aiService, "maxResponseBytes", 10);
        server.expect(requestTo("http://ai.test/triage"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"recommended_specialty\":\"Nội thần kinh\"}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> aiService.symptomCheck(Map.of("symptoms", "đau đầu")))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(BAD_GATEWAY));
        server.verify();
    }

    @Test
    void availabilityForwardsTokenAndRequiresReadyJsonStatus() {
        ReflectionTestUtils.setField(aiService, "aiServiceToken", "shared-service-token");
        server.expect(requestTo("http://ai.test/health"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("X-AI-Service-Token", "shared-service-token"))
            .andRespond(withSuccess("{\"status\":\"ok\",\"ready\":true}", MediaType.APPLICATION_JSON));

        assertThat(aiService.isAvailable()).isTrue();
        server.verify();
    }

    @Test
    void availabilityRejectsMisconfiguredJsonEvenWhenHttpResponseIsSuccessful() {
        ReflectionTestUtils.setField(aiService, "aiServiceToken", "shared-service-token");
        server.expect(requestTo("http://ai.test/health"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("X-AI-Service-Token", "shared-service-token"))
            .andRespond(withSuccess("{\"status\":\"misconfigured\",\"ready\":false}", MediaType.APPLICATION_JSON));

        assertThat(aiService.isAvailable()).isFalse();
        server.verify();
    }

    @Test
    void availabilityRejectsHealthWithoutExplicitReadyFlag() {
        ReflectionTestUtils.setField(aiService, "aiServiceToken", "shared-service-token");
        server.expect(requestTo("http://ai.test/health"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("{\"status\":\"ok\"}", MediaType.APPLICATION_JSON));

        assertThat(aiService.isAvailable()).isFalse();
        server.verify();
    }

    @Test
    void availabilityRejectsUnreadyHttpStatus() {
        ReflectionTestUtils.setField(aiService, "aiServiceToken", "shared-service-token");
        server.expect(requestTo("http://ai.test/health"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withStatus(SERVICE_UNAVAILABLE));

        assertThat(aiService.isAvailable()).isFalse();
        server.verify();
    }

    @Test
    void availabilityRejectsHealthTokenMismatch() {
        ReflectionTestUtils.setField(aiService, "aiServiceToken", "shared-service-token");
        server.expect(requestTo("http://ai.test/health"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("X-AI-Service-Token", "shared-service-token"))
            .andRespond(withStatus(UNAUTHORIZED));

        assertThat(aiService.isAvailable()).isFalse();
        server.verify();
    }

    @Test
    void missingTokenFailsClosedOutsideExplicitLocalEscapeHatch() {
        ReflectionTestUtils.setField(aiService, "aiServiceRuntime", "staging");
        ReflectionTestUtils.setField(aiService, "allowUnauthenticatedLocal", false);

        assertThatThrownBy(() -> aiService.symptomCheck(Map.of("symptoms", "đau đầu")))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                assertThat(exception.getStatusCode()).isEqualTo(SERVICE_UNAVAILABLE));
    }
}
