package com.healthcare.notification;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
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
        assertThat(updated.isRead()).isTrue();
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

    @Test
    void emailPendingQueryReturnsOnlyDueUnqueuedNotifications() {
        tokenFor("PATIENT");
        User user = userRepository.findAll().stream()
            .filter(u -> u.getEmail().startsWith("notif.test."))
            .findFirst().orElseThrow();
        OffsetDateTime now = OffsetDateTime.parse("2026-09-07T02:00:00Z");

        Notification due = notification(user, "Due");
        due.setCreatedAt(now.minusMinutes(4));
        due.setEmailAvailableAt(now.minusMinutes(1));
        Notification future = notification(user, "Future");
        future.setCreatedAt(now.minusMinutes(3));
        future.setEmailAvailableAt(now.plusMinutes(10));
        Notification queued = notification(user, "Queued");
        queued.setCreatedAt(now.minusMinutes(2));
        queued.setEmailAvailableAt(now.minusMinutes(1));
        queued.setEmailQueuedAt(now.minusSeconds(30));
        Notification suppressed = notification(user, "Suppressed");
        suppressed.setCreatedAt(now.minusMinutes(1));
        suppressed.setEmailAvailableAt(now.minusMinutes(1));
        suppressed.setEmailSuppressedAt(now.minusSeconds(20));
        notificationRepository.saveAllAndFlush(List.of(due, future, queued, suppressed));

        List<Notification> pending = notificationRepository.findEmailPendingForUpdate(
            now, PageRequest.of(0, 10));

        assertThat(pending).extracting(Notification::getId).containsExactly(due.getId());
    }

    @Test
    void allEventTypesCanBePersistedAndHydratedWithoutException() {
        User user = userRepository.findAll().stream().findFirst().orElseGet(() -> {
            User u = new User();
            u.setEmail("enum.test." + UUID.randomUUID() + "@healthcare.local");
            u.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
            u.setDisplayName("Enum Test");
            u.setStatus("ACTIVE");
            u.setCreatedAt(OffsetDateTime.now());
            u.setUpdatedAt(OffsetDateTime.now());
            u.addRole(roleRepository.findByCode("PATIENT").orElseThrow());
            return userRepository.saveAndFlush(u);
        });

        for (EventType type : EventType.values()) {
            Notification n = new Notification();
            n.setUser(user);
            n.setEventType(type);
            n.setTitle("Test " + type);
            n.setMessage("Message for " + type);
            notificationRepository.save(n);
        }
        notificationRepository.flush();

        List<Notification> loaded = notificationRepository.findAll();
        assertThat(loaded).isNotEmpty();
        for (Notification n : loaded) {
            assertThat(n.getEventType()).isNotNull();
        }
    }

    @Test
    void databaseRejectsInvalidNotificationEventTypeConstraint() {
        User user = userRepository.findAll().stream().findFirst().orElseGet(() -> {
            User u = new User();
            u.setEmail("chk.test." + UUID.randomUUID() + "@healthcare.local");
            u.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
            u.setDisplayName("Chk Test");
            u.setStatus("ACTIVE");
            u.setCreatedAt(OffsetDateTime.now());
            u.setUpdatedAt(OffsetDateTime.now());
            u.addRole(roleRepository.findByCode("PATIENT").orElseThrow());
            return userRepository.saveAndFlush(u);
        });

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> {
            jdbcTemplate.update(
                "INSERT INTO notifications (id, user_id, event_type, title, message, is_read, created_at, email_available_at) " +
                "VALUES (?, ?, ?, ?, ?, false, NOW(), NOW())",
                UUID.randomUUID(), user.getId(), "INVALID_EVENT_TYPE", "Test Title", "Test Message"
            );
        }).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    private Notification notification(User user, String title) {
        Notification n = new Notification();
        n.setUser(user);
        n.setEventType(EventType.DIAGNOSTIC_RESULT_AVAILABLE);
        n.setTitle(title);
        n.setMessage(title + " notification");
        return n;
    }
}
