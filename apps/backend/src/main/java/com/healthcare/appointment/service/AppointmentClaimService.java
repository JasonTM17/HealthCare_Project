package com.healthcare.appointment.service;

import com.healthcare.appointment.entity.Appointment;
import com.healthcare.appointment.entity.AppointmentAccountClaim;
import com.healthcare.appointment.entity.AppointmentStatus;
import com.healthcare.appointment.repository.AppointmentAccountClaimRepository;
import com.healthcare.appointment.repository.AppointmentRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AppointmentClaimService {

    private final AppointmentAccountClaimRepository claimRepository;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    public AppointmentClaimService(AppointmentAccountClaimRepository claimRepository,
            AppointmentRepository appointmentRepository, UserRepository userRepository,
            JdbcTemplate jdbcTemplate) {
        this.claimRepository = claimRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void claimAfterBookingOtp(Appointment appointment) {
        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) return;
        String email = normalizeEmail(appointment.getPatient().getEmail());
        if (email == null) return;
        userRepository.findWithRolesByEmail(email)
            .filter(this::isEligiblePatient)
            .ifPresent(user -> createClaim(appointment, user, "BOOKING_OTP"));
    }

    @Transactional
    public int claimAfterEmailVerification(User user) {
        if (!isEligiblePatient(user)) return 0;
        List<Appointment> appointments = appointmentRepository.findConfirmedUnclaimedByPatientEmail(user.getEmail());
        appointments.forEach(appointment -> createClaim(appointment, user, "EMAIL_VERIFICATION"));
        return appointments.size();
    }

    @Transactional(readOnly = true)
    public boolean isOwned(UUID appointmentId, UUID userId) {
        return claimRepository.existsByAppointmentIdAndUserId(appointmentId, userId);
    }

    @Transactional(readOnly = true)
    public List<UUID> claimedUserIds(UUID appointmentId) {
        return claimRepository.findUserIdsByAppointmentId(appointmentId);
    }

    private void createClaim(Appointment appointment, User user, String source) {
        if (appointment.getPatient().getUserId() != null
                && !appointment.getPatient().getUserId().equals(user.getId())) return;
        AppointmentAccountClaim existing = claimRepository.findByAppointmentId(appointment.getId()).orElse(null);
        if (existing != null) return;
        jdbcTemplate.update(
            "insert into appointment_account_claims (id, appointment_id, user_id, claim_source) "
                + "values (?, ?, ?, ?) on conflict (appointment_id) do nothing",
            UUID.randomUUID(), appointment.getId(), user.getId(), source
        );
    }

    private boolean isEligiblePatient(User user) {
        return user.isEmailVerified()
            && "ACTIVE".equals(user.getStatus())
            && user.getRoles().stream().anyMatch(role -> "PATIENT".equals(role.getCode()));
    }

    private String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
