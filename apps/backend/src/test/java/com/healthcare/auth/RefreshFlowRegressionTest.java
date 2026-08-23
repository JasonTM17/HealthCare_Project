package com.healthcare.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.auth.mail.EmailSender;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RefreshFlowRegressionTest extends TestcontainersIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private EmailSender emailSender;

    @Test
    void refreshSucceedsOutsideTestTransaction() throws Exception {
        AtomicReference<String> emailBody = new AtomicReference<>("");
        doAnswer(invocation -> {
            emailBody.set(invocation.getArgument(2, String.class));
            return null;
        }).when(emailSender).send(anyString(), anyString(), anyString());

        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "refresh.flow@example.com",
                      "password": "Str0ng!Pass",
                      "displayName": "Refresh Flow"
                    }
                    """))
            .andExpect(status().isAccepted())
            .andReturn();
        JsonNode body = objectMapper.readTree(reg.getResponse().getContentAsString());
        String email = body.get("email").asText();
        Matcher matcher = Pattern.compile("\\b(\\d{6})\\b").matcher(emailBody.get());
        if (!matcher.find()) {
            throw new AssertionError("Verification email did not contain an OTP");
        }

        MvcResult confirmation = mockMvc.perform(post("/api/v1/auth/email-verifications/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"otp\":\"%s\"}".formatted(email, matcher.group(1))))
            .andExpect(status().isOk())
            .andReturn();
        String refreshToken = objectMapper.readTree(confirmation.getResponse().getContentAsString())
            .get("refreshToken").asText();

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isOk());
    }
}
