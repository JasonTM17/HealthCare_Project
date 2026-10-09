package com.healthcare.user;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.auth.AuthOtpService;
import com.healthcare.auth.security.AuthRateLimiter;
import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.clinical.service.ClinicalAccessAuditService;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.notification.service.NotificationPreferenceService;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.dto.AdminUserResponse;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RefreshTokenRepository;
import com.healthcare.user.repository.RoleRepository;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.user.service.AccountDoctorLinker;
import com.healthcare.user.service.AccountGovernance;
import com.healthcare.user.service.AdminAccountService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Legacy facade exercises the actual shared writer, with only persistence/side effects mocked. */
class AdminUserServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final RoleRepository roles = mock(RoleRepository.class);
    private final PatientProfileRepository patients = mock(PatientProfileRepository.class);
    private final DoctorRepository doctors = mock(DoctorRepository.class);
    private final RefreshTokenRepository tokens = mock(RefreshTokenRepository.class);
    private final BrowserSessionService sessions = mock(BrowserSessionService.class);
    private final AuthOtpService otp = mock(AuthOtpService.class);
    private final ClinicalAccessAuditService audit = mock(ClinicalAccessAuditService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AccountGovernance governance = new AccountGovernance(jdbc, new UserSecurityLock(users), tokens, sessions, otp);
    private final AdminAccountService accounts = new AdminAccountService(users, roles, governance, new AccountDoctorLinker(doctors),
        doctors, patients, mock(PasswordEncoder.class), otp, mock(NotificationPreferenceService.class), mock(AuthRateLimiter.class), audit);
    private final AdminUserService service = new AdminUserService(accounts);
    private User actor;
    private HealthcareUserPrincipal principal;

    @BeforeEach void setUp() {
        actor = user("admin@healthcare.test", "ACTIVE", "ADMIN");
        principal = HealthcareUserPrincipal.from(actor);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        TransactionSynchronizationManager.setActualTransactionActive(true);
        when(users.findByIdForUpdate(actor.getId())).thenReturn(Optional.of(actor));
        when(users.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        for (String code : List.of("ADMIN", "PATIENT", "DOCTOR")) {
            Role role = role(code); when(roles.findByCode(code)).thenReturn(Optional.of(role));
        }
        when(users.countEligibleAdministrators()).thenReturn(2L);
    }
    @AfterEach void tearDown() {
        SecurityContextHolder.clearContext();
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }
    private static Role role(String code) { Role role = new Role(); role.setId(UUID.randomUUID()); role.setCode(code); role.setName(code); return role; }
    private static User user(String email, String status, String... codes) {
        User user = new User(); user.setId(UUID.randomUUID()); user.setEmail(email); user.setDisplayName("Người dùng " + email);
        user.setStatus(status); user.setEmailVerified(true); user.setCreatedAt(OffsetDateTime.parse("2026-01-15T08:30:00Z")); user.setUpdatedAt(user.getCreatedAt());
        user.setRoles(java.util.Arrays.stream(codes).map(AdminUserServiceTest::role).collect(java.util.stream.Collectors.toSet())); return user;
    }
    private User target(String status, String... codes) {
        User target = user("target@healthcare.test", status, codes);
        when(users.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target)); return target;
    }
    private void verifyRevoked(User target) {
        assertThat(target.getSecurityVersion()).isEqualTo(1);
        verify(tokens).revokeAllActiveByUserId(target.getId());
        verify(sessions).revokeAllForUser(target.getId(), "ADMIN_ACCOUNT_CHANGED");
        verify(otp).invalidateAll(target);
    }
    private void verifyAudit(User target, String action) {
        verify(audit).recordGovernance(eq(principal), isNull(), eq(ClinicalAccessAuditService.TARGET_USER),
            eq(target.getId().toString()), eq(action), eq(ClinicalAccessAuditService.DECISION_ALLOW));
        verify(audit, never()).record(any(), any(), any(), any(), any(), any());
    }
    @Test void listExposesCreatedAtRolesStatusAndLinkedProfilePhone() {
        User target = target("ACTIVE", "PATIENT");
        PatientProfile profile = new PatientProfile(); profile.setId(UUID.randomUUID()); profile.setUserId(target.getId()); profile.setPhone("0901234567");
        when(users.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(target), PageRequest.of(0,20),1));
        when(patients.findByUserIdIn(anyCollection())).thenReturn(List.of(profile));
        AdminUserResponse row = service.list(null,null,null,PageRequest.of(0,20)).getContent().get(0);
        assertThat(row.createdAt()).isEqualTo(OffsetDateTime.parse("2026-01-15T08:30:00Z"));
        assertThat(row.status()).isEqualTo("ACTIVE"); assertThat(row.roles()).containsExactly("PATIENT");
        assertThat(row.phone()).isEqualTo("0901234567"); assertThat(row.patientProfileId()).isEqualTo(profile.getId()); assertThat(row.doctorProfileId()).isNull();
    }
    @Test void listRejectsUnknownStatusAndRoleFilters() {
        assertThatThrownBy(() -> service.list(null,"BANNED",null,PageRequest.of(0,20))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.list("superuser",null,null,PageRequest.of(0,20))).isInstanceOf(BusinessException.class);
    }
    @Test void disableRevokesEveryCredentialAndAuditsOnce() {
        User target = target("ACTIVE","PATIENT");
        assertThat(service.updateStatus(target.getId(),"disabled",principal).status()).isEqualTo("DISABLED");
        verifyRevoked(target); verifyAudit(target,ClinicalAccessAuditService.ACTION_ADMIN_UPDATE_USER_STATUS);
    }
    @Test void enableAlsoInvalidatesPreviouslyRevokedCredentials() {
        User target = target("DISABLED","PATIENT");
        assertThat(service.updateStatus(target.getId(),"ACTIVE",principal).status()).isEqualTo("ACTIVE"); verifyRevoked(target);
    }
    @Test void statusPatchPreservesHistoricalFieldsAndDoesNotRelinkDoctor() {
        User target = target("ACTIVE","DOCTOR");
        target.setDisplayName(null); target.setEmail("Legacy@healthcare.test"); target.setGoogleSubject("local-fixture-subject");
        service.updateStatus(target.getId(),"DISABLED",principal);
        assertThat(target.getDisplayName()).isNull(); assertThat(target.getEmail()).isEqualTo("Legacy@healthcare.test");
        assertThat(target.getGoogleSubject()).isEqualTo("local-fixture-subject"); assertThat(target.isEmailVerified()).isTrue();
        verify(doctors,never()).findByIdForUpdate(any()); verifyRevoked(target);
    }
    @Test void noOpKeepsEpochTimestampAndAuditUnchanged() {
        User target = target("ACTIVE","PATIENT"); OffsetDateTime before = target.getUpdatedAt();
        service.updateStatus(target.getId(),"ACTIVE",principal); service.updateRoles(target.getId(),List.of("patient"),principal);
        assertThat(target.getSecurityVersion()).isZero(); assertThat(target.getUpdatedAt()).isEqualTo(before);
        verifyNoInteractions(tokens,sessions,otp,audit); verify(users,never()).saveAndFlush(any());
    }
    @Test void cannotDisableOrPatchRolesOfOwnAccount() {
        assertThatThrownBy(() -> service.updateStatus(actor.getId(),"DISABLED",principal)).isInstanceOf(BusinessException.class).hasMessageContaining("own account");
        assertThatThrownBy(() -> service.updateRoles(actor.getId(),List.of("PATIENT"),principal)).isInstanceOf(BusinessException.class).hasMessageContaining("own account");
        verify(users,never()).saveAndFlush(any());
    }
    @Test void cannotDisableOrDemoteLastEligibleAdmin() {
        User target = target("ACTIVE","ADMIN"); when(users.countEligibleAdministrators()).thenReturn(1L);
        assertThatThrownBy(() -> service.updateStatus(target.getId(),"DISABLED",principal)).isInstanceOf(BusinessException.class).hasMessageContaining("final active verified");
        assertThatThrownBy(() -> service.updateRoles(target.getId(),List.of("PATIENT"),principal)).isInstanceOf(BusinessException.class).hasMessageContaining("final active verified");
        verify(users,never()).saveAndFlush(any());
    }
    @Test void disableSucceedsWhenAnotherEligibleAdminRemains() {
        User target = target("ACTIVE","ADMIN"); assertThat(service.updateStatus(target.getId(),"DISABLED",principal).status()).isEqualTo("DISABLED"); verifyRevoked(target);
    }
    @Test void bothPatchesAcquireSharedGlobalGovernanceBeforeSortedUserLocks() {
        User target = target("ACTIVE","PATIENT"); service.updateStatus(target.getId(),"DISABLED",principal);
        var order = inOrder(jdbc,users); order.verify(jdbc).query(eq("select pg_advisory_xact_lock(?)"), any(org.springframework.jdbc.core.RowCallbackHandler.class),eq(AccountGovernance.LOCK_KEY));
        for(UUID id : new java.util.TreeSet<>(Set.of(actor.getId(),target.getId()))) order.verify(users).findByIdForUpdate(id);
        verify(roles,never()).findByCodeForUpdate(anyString());
    }
    @Test void unknownAccountAndInvalidStatusRejected() {
        assertThatThrownBy(() -> service.updateStatus(UUID.randomUUID(),"DISABLED",principal)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.updateStatus(UUID.randomUUID(),"DELETED",principal)).isInstanceOf(BusinessException.class);
    }
    @Test void updateRolesReplacesSetRevokesAndAuditsOnce() {
        User target = target("ACTIVE","PATIENT");
        assertThat(service.updateRoles(target.getId(),List.of("ADMIN","PATIENT"),principal).roles()).containsExactly("ADMIN","PATIENT");
        verifyRevoked(target); verifyAudit(target,ClinicalAccessAuditService.ACTION_ADMIN_UPDATE_USER_ROLES);
    }
    @Test void invalidEmptyAndNullRoleCodesRejected() {
        User target = target("ACTIVE","PATIENT");
        for(List<String> invalid : List.of(List.of("ROOT"),List.<String>of(),java.util.Arrays.asList((String)null))) {
            assertThatThrownBy(() -> service.updateRoles(target.getId(),invalid,principal)).isInstanceOf(BusinessException.class);
        }
    }
    @Test void doctorGrantRequiresAnActiveAlreadyBoundProfile() {
        User target = target("ACTIVE","PATIENT");
        assertThatThrownBy(() -> service.updateRoles(target.getId(),List.of("DOCTOR"),principal)).isInstanceOf(BusinessException.class).hasMessageContaining("active doctor profile");
        verify(users,never()).saveAndFlush(any());
    }
    @Test void validBoundDoctorGrantRetainsLinkAndSafeResponse() {
        User target = target("ACTIVE","PATIENT"); Doctor profile = new Doctor(); profile.setId(UUID.randomUUID()); profile.setUserId(target.getId()); profile.setFullName(target.getDisplayName()); profile.setActive(true);
        when(doctors.findByUserId(target.getId())).thenReturn(Optional.of(profile)); when(doctors.findByIdForUpdate(profile.getId())).thenReturn(Optional.of(profile));
        AdminUserResponse row = service.updateRoles(target.getId(),List.of("DOCTOR"),principal);
        assertThat(row.doctorProfileId()).isEqualTo(profile.getId()); assertThat(profile.getUserId()).isEqualTo(target.getId()); verifyRevoked(target);
    }
    @Test void attachedDoctorRemovalRequiresExplicitProfessionalUnlink() {
        User target = target("ACTIVE","DOCTOR"); Doctor profile = new Doctor(); profile.setId(UUID.randomUUID()); profile.setUserId(target.getId()); profile.setFullName(target.getDisplayName()); profile.setActive(true);
        when(doctors.findByUserId(target.getId())).thenReturn(Optional.of(profile)); when(doctors.findByIdForUpdate(profile.getId())).thenReturn(Optional.of(profile));
        assertThatThrownBy(() -> service.updateRoles(target.getId(),List.of("PATIENT"),principal)).isInstanceOf(BusinessException.class).hasMessageContaining("Confirm unlinking");
        assertThat(profile.getUserId()).isEqualTo(target.getId()); verify(users,never()).saveAndFlush(any());
    }
    @Test void freshActorEpochAndDemoTargetAreRejectedBeforeMutation() {
        User target = target("ACTIVE","PATIENT"); target.setDemo(true);
        assertThatThrownBy(() -> service.updateStatus(target.getId(),"DISABLED",principal)).isInstanceOf(BusinessException.class).hasMessageContaining("demo");
        target.setDemo(false); actor.setSecurityVersion(1);
        assertThatThrownBy(() -> service.updateRoles(target.getId(),List.of("ADMIN"),principal)).isInstanceOf(BusinessException.class).hasMessageContaining("access changed");
        verify(users,never()).saveAndFlush(any());
    }
}
