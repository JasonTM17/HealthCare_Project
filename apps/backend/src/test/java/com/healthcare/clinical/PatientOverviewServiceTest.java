package com.healthcare.clinical;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.clinical.dto.PatientOverviewResponse;
import com.healthcare.clinical.service.PatientOverviewService;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PatientOverviewServiceTest {
    @Test
    void returnsOwnerScopedNonPhiSummary() {
        PatientProfileRepository profiles = mock(PatientProfileRepository.class);
        UserRepository users = mock(UserRepository.class);
        NotificationRepository notifications = mock(NotificationRepository.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID userId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("patient@example.test");
        PatientProfile profile = new PatientProfile();
        profile.setId(patientId);
        profile.setUserId(userId);
        when(users.findByEmail("patient@example.test")).thenReturn(Optional.of(user));
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(notifications.countByUserIdAndReadFalse(userId)).thenReturn(2L);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of(
            "appointment_date", LocalDate.of(2026, 8, 24),
            "start_time", LocalTime.of(9, 30),
            "status", "CONFIRMED",
            "payment_status", "PAID")));
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class)))
            .thenAnswer(invocation -> {
                String sql = invocation.getArgument(0, String.class);
                if (sql.contains("appointments")) return 4L;
                if (sql.contains("diagnostic_results")) return 3L;
                if (sql.contains("prescriptions")) return 2L;
                return 1L;
            });
        UserDetails principal = org.springframework.security.core.userdetails.User.withUsername(
            "patient@example.test").password("ignored")
            .authorities(new SimpleGrantedAuthority("ROLE_PATIENT")).build();

        PatientOverviewResponse result = new PatientOverviewService(profiles, users, notifications, jdbc)
            .getOverview(principal);

        assertThat(result.latestAppointment().status()).isEqualTo("CONFIRMED");
        assertThat(result.latestAppointment().paymentStatus()).isEqualTo("PAID");
        assertThat(result.appointmentCount()).isEqualTo(4L);
        assertThat(result.diagnosticResultCount()).isEqualTo(3L);
        assertThat(result.prescriptionCount()).isEqualTo(2L);
        assertThat(result.newDiagnosticResult()).isTrue();
        assertThat(result.unreadNotificationCount()).isEqualTo(2L);
        assertThat(result.unreadConsultationCount()).isEqualTo(1L);
        assertThat(result.openCarePlanTaskCount()).isEqualTo(1L);
    }

    @Test
    void rejectsNonPatientPrincipalBeforeReadingOwnerData() {
        UserDetails principal = org.springframework.security.core.userdetails.User.withUsername("staff@example.test")
            .password("ignored").authorities(new SimpleGrantedAuthority("ROLE_DOCTOR")).build();
        assertThatThrownBy(() -> new PatientOverviewService(
            mock(PatientProfileRepository.class), mock(UserRepository.class),
            mock(NotificationRepository.class), mock(JdbcTemplate.class)).getOverview(principal))
            .isInstanceOf(AccessDeniedException.class);
    }
}
