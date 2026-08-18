package com.healthcare.common;

import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.ai.service.AiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.mockito.Mockito.when;

class HealthControllerTest extends TestcontainersIntegrationTest {

    @MockitoBean
    private AiService aiService;

    @BeforeEach
    void configureHealthyAi() {
        when(aiService.isAvailable()).thenReturn(true);
    }

    @Test
    void healthReturnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", equalTo("ok")))
            .andExpect(jsonPath("$.service", equalTo("healthcare-backend")))
            .andExpect(jsonPath("$.ai_ready", equalTo(true)));
    }

    @Test
    void healthFailsClosedWhenAiServiceTokenIsRejected() throws Exception {
        when(aiService.isAvailable()).thenReturn(false);

        mockMvc.perform(get("/api/v1/health"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.status", equalTo("degraded")))
            .andExpect(jsonPath("$.ai_status", equalTo("unavailable")))
            .andExpect(jsonPath("$.ai_ready", equalTo(false)));
    }
}
