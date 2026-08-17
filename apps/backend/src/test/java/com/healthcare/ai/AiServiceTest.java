package com.healthcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.ai.service.AiService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
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
    void invalidSymptomsAreRejectedBeforeCallingUpstream() {
        assertThatThrownBy(() -> aiService.symptomCheck(Map.of("symptoms", " ")))
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
}
