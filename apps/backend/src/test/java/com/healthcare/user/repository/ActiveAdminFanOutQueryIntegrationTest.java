package com.healthcare.user.repository;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The admin fan-out query behind payment review and health-question
 * moderation: {@code findActiveAdminUserIds} must return ACTIVE ADMIN accounts
 * only, and it must respect the caller's {@link org.springframework.data.domain.Pageable}
 * so one submission can never trigger an unbounded notification write.
 */
@Transactional
class ActiveAdminFanOutQueryIntegrationTest extends AbstractIntegrationTest {

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    @DisplayName("Only ACTIVE users holding ADMIN are returned")
    void returnsActiveAdminsOnly() {
        UUID activeAdmin = createUser("ADMIN", "ACTIVE");
        UUID otherActiveAdmin = createUser("ADMIN", "ACTIVE");
        UUID disabledAdmin = createUser("ADMIN", "DISABLED");
        UUID activePatient = createUser("PATIENT", "ACTIVE");
        UUID activeDoctor = createUser("DOCTOR", "ACTIVE");

        List<UUID> admins = userRepository.findActiveAdminUserIds(PageRequest.of(0, 50));

        assertThat(admins).contains(activeAdmin, otherActiveAdmin);
        assertThat(admins).doesNotContain(disabledAdmin, activePatient, activeDoctor);
    }

    @Test
    @DisplayName("The Pageable bound caps the fan-out and pages deterministically")
    void honorsThePageableBound() {
        createUser("ADMIN", "ACTIVE");
        createUser("ADMIN", "ACTIVE");
        createUser("ADMIN", "ACTIVE");
        createUser("PATIENT", "ACTIVE");

        List<UUID> unbounded = userRepository.findActiveAdminUserIds(PageRequest.of(0, 50));
        assertThat(unbounded).hasSize(3);

        // The query orders by user id, so the pages are an exact partition of
        // the unbounded result: the limit is applied, not ignored, and the
        // offset moves forward instead of repeating the first row.
        assertThat(userRepository.findActiveAdminUserIds(PageRequest.of(0, 1)))
            .containsExactly(unbounded.get(0));
        assertThat(userRepository.findActiveAdminUserIds(PageRequest.of(1, 1)))
            .containsExactly(unbounded.get(1));
        assertThat(userRepository.findActiveAdminUserIds(PageRequest.of(0, 2)))
            .containsExactly(unbounded.get(0), unbounded.get(1));
        assertThat(userRepository.findActiveAdminUserIds(PageRequest.of(3, 1))).isEmpty();
    }

    private UUID createUser(String roleCode, String status) {
        User user = new User();
        user.setEmail("fanout.test." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Fan-out " + roleCode + " " + status);
        user.setStatus(status);
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        return userRepository.saveAndFlush(user).getId();
    }
}
