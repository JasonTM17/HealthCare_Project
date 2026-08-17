package com.healthcare.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.notification.entity.Notification;
import com.healthcare.notification.entity.Notification.EventType;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Transactional
class NotificationIntegrationTest extends AbstractIntegrationTest {

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    private String tokenFor(String roleCode) {
        User user = new User();
        user.setEmail("notif.test." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Notif Test");
        user.setStatus("ACTIVE");
        user.setCreatedAt(java.time.OffsetDateTime.now());
        user.setUpdatedAt(java.time.OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        user = userRepository.saveAndFlush(user);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    @Test
    void patientCanListOwnNotifications() throws Exception {
        String token = tokenFor("PATIENT");
        User user = userRepository.findAll().stream()
            .filter(u -> u.getEmail().startsWith("notif.test."))
            .findFirst().orElseThrow();

        Notification n = new Notification();
        n.setUser(user);
        n.setEventType(EventType.APPOINTMENT_CONFIRMED);
        n.setTitle("Lịch hẹn đã xác nhận");
        n.setMessage("Lịch khám của bạn đã được xác nhận.");
        notificationRepository.saveAndFlush(n);

        mockMvc.perform(get("/api/v1/notifications").header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].title").value("Lịch hẹn đã xác nhận"));
    }

    @Test
    void unauthenticatedCannotListNotifications() throws Exception {
        mockMvc.perform(get("/api/v1/notifications"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void markAsReadUpdatesState() throws Exception {
        String token = tokenFor("PATIENT");
        User user = userRepository.findAll().stream()
            .filter(u -> u.getEmail().startsWith("notif.test."))
            .findFirst().orElseThrow();

        Notification n = new Notification();
        n.setUser(user);
        n.setEventType(EventType.DIAGNOSTIC_RESULT_AVAILABLE);
        n.setTitle("Kết quả xét nghiệm");
        n.setMessage("Kết quả xét nghiệm của bạn đã sẵn sàng.");
        n = notificationRepository.saveAndFlush(n);

        mockMvc.perform(put("/api/v1/notifications/" + n.getId() + "/read")
                .header("Authorization", token))
            .andExpect(status().isOk());

        Notification updated = notificationRepository.findById(n.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(updated.isRead()).isTrue();
    }

    @Test
    void markAllAsReadClearsUnread() throws Exception {
        String token = tokenFor("PATIENT");
        User user = userRepository.findAll().stream()
            .filter(u -> u.getEmail().startsWith("notif.test."))
            .findFirst().orElseThrow();

        for (int i = 0; i < 3; i++) {
            Notification n = new Notification();
            n.setUser(user);
            n.setEventType(EventType.APPOINTMENT_REMINDER);
            n.setTitle("Nhắc nhở lịch hẹn " + i);
            n.setMessage("Bạn có lịch hẹn vào ngày mai.");
            notificationRepository.saveAndFlush(n);
        }

        mockMvc.perform(patch("/api/v1/notifications/read-all")
                .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updated").value(3));
    }
}
