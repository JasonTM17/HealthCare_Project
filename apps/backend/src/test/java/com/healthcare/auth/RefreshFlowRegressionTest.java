package com.healthcare.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RefreshFlowRegressionTest extends TestcontainersIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void refreshSucceedsOutsideTestTransaction() throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "refresh.flow@example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "Refresh Flow"
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();
        JsonNode body = objectMapper.readTree(reg.getResponse().getContentAsString());
        String refreshToken = body.get("refreshToken").asText();

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isOk());
    }
}
