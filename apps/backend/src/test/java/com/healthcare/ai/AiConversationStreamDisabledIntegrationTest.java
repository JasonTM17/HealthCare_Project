package com.healthcare.ai;

import com.healthcare.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "ai.chat.chunked-enabled=false")
class AiConversationStreamDisabledIntegrationTest extends AbstractIntegrationTest {

    @Test
    @WithMockUser(username = "patient.stream-disabled@example.com", roles = "PATIENT")
    void disabledStreamReturnsEmpty404InsteadOfMediaNegotiation500() throws Exception {
        mockMvc.perform(post("/api/v1/ai/conversations/{id}/messages/stream", UUID.randomUUID())
                .header("Idempotency-Key", "stream-disabled-regression")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Xin tu van\"}"))
            .andExpect(status().isNotFound())
            .andExpect(content().string(""));
    }
}
