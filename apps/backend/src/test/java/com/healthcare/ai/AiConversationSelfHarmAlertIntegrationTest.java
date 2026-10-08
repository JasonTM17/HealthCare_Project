package com.healthcare.ai;

import com.healthcare.AbstractRedisIntegrationTest;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.ai.service.AiService;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.notification.entity.Notification;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A persisted self-harm chat turn must alert the admin review queue: the
 * {@code AI_SAFETY_ALERT} notification fans out to every active admin after
 * the exchange commits, names the patient, and carries a bounded excerpt so
 * severity can be judged without opening the thread. Benign turns alert no
 * one — the flag is reserved for the unambiguous crisis marker, not negative
 * sentiment in general.
 */
@TestPropertySource(properties = {
    "app.security.bff.service-token=test-bff-chat-commit-token-32-bytes-minimum"
})
class AiConversationSelfHarmAlertIntegrationTest extends AbstractRedisIntegrationTest {

    @MockitoBean
    private AiService aiService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Test
    @WithMockUser(username = "patient.self-harm-alert@example.com", roles = "PATIENT")
    void selfHarmTurnAlertsEveryActiveAdminAfterCommit() throws Exception {
        User admin = createAdmin("admin.self-harm-alert@example.com");
        User patient = createUser("patient.self-harm-alert@example.com");
        createPatientProfile(patient, "0901003101", 3);

        String conversationId = createConversation();
        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "self-harm-alert-0001")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Tôi muốn chết\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assistantMessage.safetyAction").value("EMERGENCY"))
            .andExpect(jsonPath("$.assistantMessage.routingReason").value("self_harm_crisis"));

        List<Notification> alerts = notificationRepository
            .findByUserIdOrderByCreatedAtDesc(admin.getId(), PageRequest.of(0, 10))
            .stream()
            .filter(n -> n.getEventType() == EventType.AI_SAFETY_ALERT)
            .toList();
        assertThat(alerts).hasSize(1);
        Notification alert = alerts.get(0);
        assertThat(alert.getReferenceId().toString()).isEqualTo(conversationId);
        assertThat(alert.getTitle()).isEqualTo("Cảnh báo an toàn AI");
        assertThat(alert.getMessage()).contains("Test Patient");
        assertThat(alert.getMessage()).contains("Tôi muốn chết");

        // The patient who triggered the flag is not also made its reviewer.
        assertThat(notificationRepository
            .findByUserIdOrderByCreatedAtDesc(patient.getId(), PageRequest.of(0, 10))
            .stream()
            .filter(n -> n.getEventType() == EventType.AI_SAFETY_ALERT))
            .isEmpty();
    }

    @Test
    @WithMockUser(username = "patient.benign-alert@example.com", roles = "PATIENT")
    void benignTurnAlertsNoAdmin() throws Exception {
        User admin = createAdmin("admin.benign-alert@example.com");
        User patient = createUser("patient.benign-alert@example.com");
        createPatientProfile(patient, "0901003102", 3);

        String conversationId = createConversation();
        mockMvc.perform(post("/api/v1/ai/conversations/" + conversationId + "/messages")
                .header("Idempotency-Key", "benign-alert-0001")
                .contentType(MediaType.APPLICATION_JSON)
                // Sad-but-safe phrasing must not page reviewers: only the
                // unambiguous self-harm marker alerts.
                .content("{\"content\":\"Tôi cảm thấy hơi buồn hôm nay\"}"))
            .andExpect(status().isOk());

        assertThat(notificationRepository
            .findByUserIdOrderByCreatedAtDesc(admin.getId(), PageRequest.of(0, 10))
            .stream()
            .filter(n -> n.getEventType() == EventType.AI_SAFETY_ALERT))
            .isEmpty();
    }

    private String createConversation() throws Exception {
        return mockMvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"consentAccepted\":true}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\\\"id\\\":\\\"([^\\\"]+)\\\".*", "$1");
    }

    private User createUser(String email) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("test-password-hash");
        user.setDisplayName("Test Patient");
        user.setStatus("ACTIVE");
        user.setEmailVerified(true);
        user.setEmailVerifiedAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private User createAdmin(String email) {
        User admin = createUser(email);
        admin.setDisplayName("Test Admin");
        admin.addRole(roleRepository.findByCode("ADMIN").orElseThrow());
        return userRepository.save(admin);
    }

    private PatientProfile createPatientProfile(User user, String phone, int credits) {
        PatientProfile profile = new PatientProfile();
        profile.setUserId(user.getId());
        profile.setFullName("Test Patient");
        profile.setEmail(user.getEmail());
        profile.setPhone(phone);
        profile.setAiCredits(credits);
        profile.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        profile.setLastCreditRefillPeriod(AiCreditService.currentRefillPeriod());
        return patientProfileRepository.save(profile);
    }
}
