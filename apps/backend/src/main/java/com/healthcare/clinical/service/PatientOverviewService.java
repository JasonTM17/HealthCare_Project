package com.healthcare.clinical.service;

import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.clinical.dto.PatientOverviewResponse;
import com.healthcare.notification.repository.NotificationRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PatientOverviewService {
    private final PatientProfileRepository patientProfiles;
    private final UserRepository users;
    private final NotificationRepository notifications;
    private final JdbcTemplate jdbc;

    public PatientOverviewService(
            PatientProfileRepository patientProfiles,
            UserRepository users,
            NotificationRepository notifications,
            JdbcTemplate jdbc) {
        this.patientProfiles = patientProfiles;
        this.users = users;
        this.notifications = notifications;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public PatientOverviewResponse getOverview(UserDetails principal) {
        UUID userId = resolvePatientUser(principal);
        PatientProfile profile = patientProfiles.findByUserId(userId)
            .orElseThrow(() -> new AccessDeniedException("No patient profile is linked to this account"));
        UUID patientId = profile.getId();

        List<Map<String, Object>> latest = jdbc.queryForList("""
            SELECT a.appointment_date, a.start_time, a.status,
                   COALESCE(p.status, a.payment_status) AS payment_status
              FROM appointments a
              LEFT JOIN bank_transfer_payments p ON p.appointment_id = a.id
             WHERE a.patient_id = ?
             ORDER BY a.appointment_time DESC, a.id DESC
             LIMIT 1
            """, patientId);
        PatientOverviewResponse.LatestAppointment latestAppointment = latest.isEmpty()
            ? null : mapLatest(latest.get(0));

        long appointments = scalar("SELECT count(*) FROM appointments WHERE patient_id = ?", patientId);
        long diagnostics = scalar("SELECT count(*) FROM diagnostic_results WHERE patient_id = ?", patientId);
        long prescriptions = scalar("SELECT count(*) FROM prescriptions WHERE patient_id = ?", patientId);
        boolean newDiagnostic = scalar("""
            SELECT count(*) FROM diagnostic_results
             WHERE patient_id = ? AND test_date >= CURRENT_TIMESTAMP - INTERVAL '30 days'
            """, patientId) > 0;
        boolean newPrescription = scalar("""
            SELECT count(*) FROM prescriptions
             WHERE patient_id = ? AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
            """, patientId) > 0;
        long unreadNotifications = notifications.countByUserIdAndReadFalse(userId);
        long unreadConsultations = optionalScalar("""
            SELECT count(*)
              FROM patient_consultation_messages m
              JOIN patient_consultation_threads t ON t.id = m.thread_id
              LEFT JOIN patient_consultation_read_states rs
                ON rs.thread_id = m.thread_id AND rs.user_id = ?
             WHERE t.patient_profile_id = ?
               AND m.author_user_id <> ?
               AND m.sequence_number > COALESCE(
                   (SELECT lm.sequence_number
                      FROM patient_consultation_messages lm
                     WHERE lm.id = rs.last_read_message_id), 0)
            """, userId, patientId, userId);
        long openTasks = optionalScalar("""
            SELECT count(*) FROM patient_care_plan_items
             WHERE patient_profile_id = ? AND status = 'OPEN'
               AND deleted_at IS NULL AND retention_expires_at > CURRENT_TIMESTAMP
            """, patientId);

        return new PatientOverviewResponse(
            latestAppointment, appointments, diagnostics, prescriptions,
            newDiagnostic, newPrescription, unreadNotifications,
            unreadConsultations, openTasks);
    }

    private UUID resolvePatientUser(UserDetails principal) {
        if (principal == null || !principal.getAuthorities().stream()
                .anyMatch(a -> "ROLE_PATIENT".equals(a.getAuthority()))) {
            throw new AccessDeniedException("Patient authentication required");
        }
        if (principal instanceof HealthcareUserPrincipal healthcare) return healthcare.getUserId();
        return users.findByEmail(principal.getUsername()).map(User::getId)
            .orElseThrow(() -> new AccessDeniedException("Authenticated user no longer exists"));
    }

    private long scalar(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0L : value;
    }

    private long optionalScalar(String sql, Object... args) {
        try {
            return scalar(sql, args);
        } catch (DataAccessException ignored) {
            // Additive consultation/care-plan migrations may not be present
            // during a rolling upgrade; the core overview remains usable.
            return 0L;
        }
    }

    private PatientOverviewResponse.LatestAppointment mapLatest(Map<String, Object> row) {
        LocalDate date = row.get("appointment_date") instanceof java.sql.Date value
            ? value.toLocalDate() : (LocalDate) row.get("appointment_date");
        LocalTime time = row.get("start_time") instanceof java.sql.Time value
            ? value.toLocalTime() : (LocalTime) row.get("start_time");
        return new PatientOverviewResponse.LatestAppointment(
            date, time, String.valueOf(row.get("status")), String.valueOf(row.get("payment_status")));
    }
}
