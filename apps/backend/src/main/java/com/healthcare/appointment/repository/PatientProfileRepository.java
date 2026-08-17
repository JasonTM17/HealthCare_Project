package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.PatientProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientProfileRepository extends JpaRepository<PatientProfile, UUID> {
    Optional<PatientProfile> findByPhone(String phone);

    Optional<PatientProfile> findByUserId(UUID userId);
}
