package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.DoctorSpecialty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorSpecialtyRepository extends JpaRepository<DoctorSpecialty, UUID> {
    Optional<DoctorSpecialty> findFirstByDoctorId(UUID doctorId);
}
