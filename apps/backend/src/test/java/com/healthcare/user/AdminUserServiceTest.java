package com.healthcare.user;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.dto.AdminUserResponse;
import com.healthcare.user.entity.RefreshToken;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit coverage for {@link AdminUserService}: the account inventory read plus
 * the two governance mutations (status flip, role rewrite) with their safety
 * guards — self-lockout, last-admin protection, eager session/token revocation.
 */
class AdminUserServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final RoleRepository roleRepository = mock(RoleRepository.class);
    private final PatientProfileRepository patientProfileRepository = mock(PatientProfileRepository.class);
    private final DoctorRepository doctorRepository = mock(DoctorRepository.class);
    private final RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
    private final BrowserSessionService browserSessionService = mock(BrowserSessionService.class);
    private final ClinicalAccessAuditService auditService = mock(ClinicalAccessAuditService.class);
    private final UserSecurityLock userSecurityLock = new UserSecurityLock(userRepository);
    private final AdminUserService service = new AdminUserService(
        userRepository, roleRepository, patientProfileRepository, doctorRepository,
        refreshTokenRepository, browserSessionService, userSecurityLock, auditService);

    private static Role role(String code) {
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setCode(code);
        role.setName(code);
        return role;
    }

    private static User user(UUID id, String email, String status, Role... roles) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setDisplayName("Người dùng " + email);
        user.setStatus(status);
        user.setEmailVerified(true);
        user.setCreatedAt(java.time.OffsetDateTime.parse("2026-01-15T08:30:00Z"));
        user.setUpdatedAt(java.time.OffsetDateTime.parse("2026-01-15T08:30:00Z"));
        user.setRoles(Set.of(roles));
        return user;
    }

    private UserDetails adminPrincipal;
    private User adminActor;

    @BeforeEach
    void setUp() {
        adminActor = user(UUID.fromString("00000000-0000-0000-0000-00000000a001"),
            "admin@healthcare.test", "ACTIVE", role("ADMIN"));
        adminPrincipal = HealthcareUserPrincipal.from(adminActor);
    }

    // ── list ──────────────────────────────────────────────────────────────

    @Test
    void listExposesCreatedAtRolesStatusAndLinkedProfilePhone() {
        UUID patientUserId = UUID.fromString("00000000-0000-0000-0000-00000000b001");
        User patient = user(patientUserId, "patient@x.test", "ACTIVE", role("PATIENT"));
        Pageable pageable = PageRequest.of(0, 20);
        when(userRepository.findForAdmin(isNull(), isNull(), isNull(), eq(pageable)))
            .thenReturn(new PageImpl<>(List.of(patient), pageable, 1));
        when(userRepository.findAllWithRolesByIdIn(anyCollection())).thenReturn(List.of(patient));
        PatientProfile profile = new PatientProfile();
        profile.setId(UUID.randomUUID());
        profile.setUserId(patientUserId);
        profile.setPhone("0901234567");
        when(patientProfileRepository.findAllByUserIdIn(anyCollection())).thenReturn(List.of(profile));
        when(doctorRepository.findAllByUserIdIn(anyCollection())).thenReturn(List.of());

        Page<AdminUserResponse> result = service.list(null, null, null, pageable);

        AdminUserResponse row = result.getContent().get(0);
        assertThat(row.createdAt()).isEqualTo("2026-01-15T08:30:00Z");
        assertThat(row.status()).isEqualTo("ACTIVE");
        assertThat(row.roles()).containsExactly("PATIENT");
        assertThat(row.phone()).isEqualTo("0901234567");
        assertThat(row.patientProfileId()).isEqualTo(profile.getId());
        assertThat(row.doctorProfileId()).isNull();
    }

    @Test
    void listRejectsUnknownStatusAndRoleFilters() {
        assertThatThrownBy(() -> service.list(null, "BANNED", null, PageRequest.of(0, 20)))
            .isInstanceOf(BusinessException.class);
        when(roleRepository.existsByCode("SUPERUSER")).thenReturn(false);
        assertThatThrownBy(() -> service.list("superuser", null, null, PageRequest.of(0, 20)))
            .isInstanceOf(BusinessException.class);
    }

    // ── updateStatus ──────────────────────────────────────────────────────

    @Test
    void disableRevokesRefreshTokensAndBrowserSessions() {
        User target = user(UUID.randomUUID(), "patient@x.test", "ACTIVE", role("PATIENT"));
        when(userRepository.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        RefreshToken token = new RefreshToken();
        token.setUser(target);
        when(refreshTokenRepository.findAllActiveByUserId(target.getId())).thenReturn(List.of(token));

        AdminUserResponse result = service.updateStatus(target.getId(), "disabled", adminPrincipal);

        assertThat(result.status()).isEqualTo("DISABLED");
        assertThat(token.getRevokedAt()).isNotNull();
        verify(refreshTokenRepository).save(token);
        verify(browserSessionService).revokeAllForUser(target.getId(), "ADMIN_DISABLED_ACCOUNT");
        verify(auditService).record(eq(adminPrincipal), isNull(),
            eq(ClinicalAccessAuditService.TARGET_USER), eq(target.getId().toString()),
            eq(ClinicalAccessAuditService.ACTION_ADMIN_UPDATE_USER_STATUS),
            eq(ClinicalAccessAuditService.DECISION_ALLOW));
    }

    @Test
    void enableDoesNotTouchSessions() {
        User target = user(UUID.randomUUID(), "patient@x.test", "DISABLED", role("PATIENT"));
        when(userRepository.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminUserResponse result = service.updateStatus(target.getId(), "ACTIVE", adminPrincipal);

        assertThat(result.status()).isEqualTo("ACTIVE");
        verify(refreshTokenRepository, never()).findAllActiveByUserId(any());
        verify(browserSessionService, never()).revokeAllForUser(any(), anyString());
    }

    @Test
    void cannotDisableOwnAccount() {
        when(userRepository.findByIdForUpdate(adminActor.getId())).thenReturn(Optional.of(adminActor));

        assertThatThrownBy(() -> service.updateStatus(adminActor.getId(), "DISABLED", adminPrincipal))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("chính mình");
        verify(userRepository, never()).save(any());
    }

    @Test
    void cannotDisableLastActiveAdmin() {
        User lastAdmin = user(UUID.randomUUID(), "other-admin@x.test", "ACTIVE", role("ADMIN"));
        when(userRepository.findByIdForUpdate(lastAdmin.getId())).thenReturn(Optional.of(lastAdmin));
        when(userRepository.findActiveAdminUserIds(any())).thenReturn(List.of(lastAdmin.getId()));

        assertThatThrownBy(() -> service.updateStatus(lastAdmin.getId(), "DISABLED", adminPrincipal))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("quản trị viên cuối cùng");
        verify(userRepository, never()).save(any());
    }

    @Test
    void disableSucceedsWhenAnotherAdminRemains() {
        User other = user(UUID.randomUUID(), "other-admin@x.test", "ACTIVE", role("ADMIN"));
        when(userRepository.findByIdForUpdate(other.getId())).thenReturn(Optional.of(other));
        when(userRepository.findActiveAdminUserIds(any()))
            .thenReturn(List.of(adminActor.getId(), other.getId()));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(refreshTokenRepository.findAllActiveByUserId(other.getId())).thenReturn(List.of());

        AdminUserResponse result = service.updateStatus(other.getId(), "DISABLED", adminPrincipal);

        assertThat(result.status()).isEqualTo("DISABLED");
    }

    @Test
    void adminRosterSentinelIsLockedBeforeTheTargetRow() {
        // The last-admin invariant only holds if the roster check is
        // serialized: locking the ADMIN role row first means a concurrent
        // disable/demote of the other admin cannot interleave between the
        // count read and this account's write.
        User other = user(UUID.randomUUID(), "other-admin@x.test", "ACTIVE", role("ADMIN"));
        when(userRepository.findByIdForUpdate(other.getId())).thenReturn(Optional.of(other));
        when(userRepository.findActiveAdminUserIds(any()))
            .thenReturn(List.of(adminActor.getId(), other.getId()));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateStatus(other.getId(), "DISABLED", adminPrincipal);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(roleRepository, userRepository);
        order.verify(roleRepository).findByCodeForUpdate("ADMIN");
        order.verify(userRepository).findByIdForUpdate(other.getId());
        order.verify(userRepository).findActiveAdminUserIds(any());
    }

    @Test
    void unknownAccountAndInvalidStatusRejected() {
        UUID missing = UUID.randomUUID();
        when(userRepository.findByIdForUpdate(missing)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.updateStatus(missing, "DISABLED", adminPrincipal))
            .isInstanceOf(ResourceNotFoundException.class);

        User target = user(UUID.randomUUID(), "p@x.test", "ACTIVE", role("PATIENT"));
        when(userRepository.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target));
        assertThatThrownBy(() -> service.updateStatus(target.getId(), "DELETED", adminPrincipal))
            .isInstanceOf(BusinessException.class);
    }

    // ── updateRoles ───────────────────────────────────────────────────────

    @Test
    void updateRolesReplacesTheRoleSet() {
        User target = user(UUID.randomUUID(), "staff@x.test", "ACTIVE", role("PATIENT"));
        when(userRepository.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        Role doctorRole = role("DOCTOR");
        when(roleRepository.findByCode("DOCTOR")).thenReturn(Optional.of(doctorRole));
        when(roleRepository.findByCode("PATIENT")).thenReturn(Optional.of(role("PATIENT")));

        AdminUserResponse result = service.updateRoles(target.getId(), List.of("doctor", "patient"), adminPrincipal);

        assertThat(result.roles()).containsExactlyInAnyOrder("DOCTOR", "PATIENT");
        verify(auditService).record(eq(adminPrincipal), isNull(),
            eq(ClinicalAccessAuditService.TARGET_USER), eq(target.getId().toString()),
            eq(ClinicalAccessAuditService.ACTION_ADMIN_UPDATE_USER_ROLES),
            eq(ClinicalAccessAuditService.DECISION_ALLOW));
    }

    @Test
    void updateRolesRejectsUnknownCodeSelfEditAndLastAdminStrip() {
        User target = user(UUID.randomUUID(), "staff@x.test", "ACTIVE", role("PATIENT"));
        when(userRepository.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target));
        when(roleRepository.findByCode("ROOT")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.updateRoles(target.getId(), List.of("ROOT"), adminPrincipal))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Vai trò không hợp lệ");

        // Self-edit is refused regardless of the requested set.
        when(userRepository.findByIdForUpdate(adminActor.getId())).thenReturn(Optional.of(adminActor));
        when(roleRepository.findByCode("PATIENT")).thenReturn(Optional.of(role("PATIENT")));
        assertThatThrownBy(() -> service.updateRoles(adminActor.getId(), List.of("PATIENT"), adminPrincipal))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("chính mình");

        // Removing ADMIN from the last active admin is refused.
        User lastAdmin = user(UUID.randomUUID(), "only-admin@x.test", "ACTIVE", role("ADMIN"));
        when(userRepository.findByIdForUpdate(lastAdmin.getId())).thenReturn(Optional.of(lastAdmin));
        when(userRepository.findActiveAdminUserIds(any())).thenReturn(List.of(lastAdmin.getId()));
        assertThatThrownBy(() -> service.updateRoles(lastAdmin.getId(), List.of("PATIENT"), adminPrincipal))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("quản trị viên cuối cùng");
    }
}
