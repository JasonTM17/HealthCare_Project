package com.healthcare.demo;

import com.healthcare.exception.ForbiddenException;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.*;
import com.healthcare.hospital.service.AdminDoctorService;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.UserSecurityLock;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import com.healthcare.user.service.AccountDoctorLinker;
import com.healthcare.user.service.AccountGovernance;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DashboardGovernanceContainmentTest {
    private final DoctorRepository doctors = mock(DoctorRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final AccountGovernance governance = mock(AccountGovernance.class);
    private final AdminDoctorService service = new AdminDoctorService(doctors, users,
        mock(DoctorBranchRepository.class), mock(DoctorSpecialtyRepository.class),
        mock(BranchRepository.class), mock(SpecialtyRepository.class), null, governance);

    private User owner() {
        User user = new User();
        user.setId(DashboardDemonstration.OWNER_ADMIN);
        user.setEmail("owner@fixture.invalid");
        user.setStatus("ACTIVE");
        return user;
    }

    private Doctor privateDoctor() {
        Doctor doctor = new Doctor();
        doctor.setId(DashboardDemonstration.id("doctor"));
        doctor.setSlug("owned-private-doctor");
        return doctor;
    }

    @Test
    void immutablePatientIsRejectedBeforeAnyGovernanceUserLock() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserSecurityLock locks = mock(UserSecurityLock.class);
        var boundary = new AccountGovernance(jdbc, locks, null, null, null);
        assertThatThrownBy(() -> boundary.lockUsersAndAuthorize(List.of(DashboardDemonstration.id("patientUser"))))
            .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(jdbc, locks);
    }

    @Test
    void ordinaryAffectedUserStillUsesExistingAuthorityAndLockPath() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UserSecurityLock locks = mock(UserSecurityLock.class);
        User actor = owner();
        var role = new com.healthcare.user.entity.Role();
        role.setCode("ADMIN");
        actor.setRoles(Set.of(role));
        actor.setEmailVerified(true);
        when(locks.findByIdForUpdate(actor.getId())).thenReturn(Optional.of(actor));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(HealthcareUserPrincipal.from(actor), null, List.of()));
        SecurityContextHolder.setContext(context);
        try {
            var boundary = new AccountGovernance(jdbc, locks, null, null, null);
            assertThat(boundary.lockUsersAndAuthorize(List.of()).get(actor.getId())).isSameAs(actor);
            verify(locks).findByIdForUpdate(actor.getId());
        } finally { SecurityContextHolder.clearContext(); }
    }

    @Test
    void selectedPrivateDoctorIsRejectedBeforeRepositoryAccess() {
        var linker = new AccountDoctorLinker(doctors);
        assertThatThrownBy(() -> linker.apply(owner(), Set.of("ADMIN", "DOCTOR"),
            DashboardDemonstration.id("doctor"), false, "Owner", true)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(doctors);
    }

    @Test
    void corruptedCurrentPrivateBindingIsRejectedBeforeProviderLocks() {
        when(doctors.findByUserId(DashboardDemonstration.OWNER_ADMIN)).thenReturn(Optional.of(privateDoctor()));
        var linker = new AccountDoctorLinker(doctors);
        assertThatThrownBy(() -> linker.apply(owner(), Set.of("ADMIN"), null, true, "Owner", false))
            .isInstanceOf(AccessDeniedException.class);
        verify(doctors, never()).findByIdForUpdate(any());
        verify(doctors, never()).save(any());
    }

    @Test
    void ordinaryUnlinkedAccountIsUnchanged() {
        when(doctors.findByUserId(DashboardDemonstration.OWNER_ADMIN)).thenReturn(Optional.empty());
        assertThat(new AccountDoctorLinker(doctors).apply(owner(), Set.of("ADMIN"), null, false, "Owner", false)).isFalse();
        verify(doctors, never()).findByIdForUpdate(any());
    }

    @Test
    void directPrivateDoctorUpdateRejectsBeforeUserAndProviderLocks() {
        when(doctors.findBySlug("owned-private-doctor")).thenReturn(Optional.of(privateDoctor()));
        var request = new DoctorRequest("Private", "owned-private-doctor", null, null, false, null, false, null, null);
        assertThatThrownBy(() -> service.update("owned-private-doctor", request)).isInstanceOf(AccessDeniedException.class);
        verify(governance, never()).lockUsersAndAuthorize(any());
        verify(doctors, never()).findByIdForUpdate(any());
        verify(doctors, never()).save(any());
    }

    @Test
    void directPrivateDoctorDeleteRejectsBeforeUserAndProviderLocks() {
        when(doctors.findBySlug("owned-private-doctor")).thenReturn(Optional.of(privateDoctor()));
        assertThatThrownBy(() -> service.delete("owned-private-doctor")).isInstanceOf(AccessDeniedException.class);
        verify(governance, never()).lockUsersAndAuthorize(any());
        verify(doctors, never()).findByIdForUpdate(any());
        verify(doctors, never()).delete(any());
    }
}
