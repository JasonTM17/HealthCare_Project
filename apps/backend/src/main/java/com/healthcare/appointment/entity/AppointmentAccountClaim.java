package com.healthcare.appointment.entity;

import com.healthcare.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "appointment_account_claims")
public class AppointmentAccountClaim {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "appointment_id", nullable = false, unique = true)
    private Appointment appointment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "claim_source", nullable = false, length = 40)
    private String claimSource;

    @Column(name = "claimed_at", nullable = false)
    private OffsetDateTime claimedAt = OffsetDateTime.now();

    public UUID getId() { return id; }
    public Appointment getAppointment() { return appointment; }
    public void setAppointment(Appointment appointment) { this.appointment = appointment; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getClaimSource() { return claimSource; }
    public void setClaimSource(String claimSource) { this.claimSource = claimSource; }
    public OffsetDateTime getClaimedAt() { return claimedAt; }
}
