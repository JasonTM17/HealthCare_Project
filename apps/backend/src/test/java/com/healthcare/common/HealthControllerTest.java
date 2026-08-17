package com.healthcare.common;

import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

class HealthControllerTest extends AbstractIntegrationTest {

    @Test
    void healthReturnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", equalTo("ok")))
            .andExpect(jsonPath("$.service", equalTo("healthcare-backend")));
    }
}
