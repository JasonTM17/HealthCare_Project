package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.AppointmentAccountClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppointmentAccountClaimRepository extends JpaRepository<AppointmentAccountClaim, UUID> {

    boolean existsByAppointmentIdAndUserId(UUID appointmentId, UUID userId);

    Optional<AppointmentAccountClaim> findByAppointmentId(UUID appointmentId);

    @Query("select c.user.id from AppointmentAccountClaim c where c.appointment.id = :appointmentId")
    List<UUID> findUserIdsByAppointmentId(@Param("appointmentId") UUID appointmentId);
}
