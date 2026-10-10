package com.healthcare.demo;

import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DashboardReviewerAuthorityTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final DashboardDemonstrationGuard guard = new DashboardDemonstrationGuard(jdbc);

    private HealthcareUserPrincipal principal(UUID id, boolean demo) {
        User user = new User();
        user.setId(id);
        user.setEmail("owner@fixture.invalid");
        user.setStatus("ACTIVE");
        user.setDemo(demo);
        user.setSecurityVersion(7);
        return HealthcareUserPrincipal.from(user);
    }

    @Test
    void revokedOrRestoredAtAnotherEpochIsDeniedAfterStableRowLock() {
        when(jdbc.queryForList(anyString(), eq(UUID.class), eq(DashboardDemonstration.OWNER_ADMIN)))
            .thenReturn(List.of(DashboardDemonstration.OWNER_ADMIN));
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(7L), eq(DashboardDemonstration.OWNER_ADMIN)))
            .thenReturn(false);
        assertThatThrownBy(() -> guard.requireReviewer(principal(DashboardDemonstration.OWNER_ADMIN, false)))
            .isInstanceOf(AccessDeniedException.class);
        var order = inOrder(jdbc);
        order.verify(jdbc).queryForList(contains("FOR SHARE"), eq(UUID.class), eq(DashboardDemonstration.OWNER_ADMIN));
        order.verify(jdbc).queryForObject(contains("security_version=?"), eq(Boolean.class), eq(7L), eq(DashboardDemonstration.OWNER_ADMIN));
    }

    @Test
    void currentDesignatedRealOwnerCanDecide() {
        when(jdbc.queryForList(anyString(), eq(UUID.class), eq(DashboardDemonstration.OWNER_ADMIN)))
            .thenReturn(List.of(DashboardDemonstration.OWNER_ADMIN));
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(7L), eq(DashboardDemonstration.OWNER_ADMIN)))
            .thenReturn(true);
        guard.requireReviewer(principal(DashboardDemonstration.OWNER_ADMIN, false));
    }

    @Test
    void foreignAndDemoPrincipalsAreRejectedBeforeDatabaseAccess() {
        assertThatThrownBy(() -> guard.requireReviewer(principal(UUID.randomUUID(), false)))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> guard.requireReviewer(principal(DashboardDemonstration.OWNER_ADMIN, true)))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(jdbc);
    }
}
