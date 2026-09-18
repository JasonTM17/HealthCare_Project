package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.DoctorSpecialty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository
public interface DoctorSpecialtyRepository extends JpaRepository<DoctorSpecialty, UUID> {
    List<DoctorSpecialty> findByDoctorId(UUID doctorId);

    @org.springframework.data.jpa.repository.Query("select ds from DoctorSpecialty ds join fetch ds.specialty where ds.doctor.id in :doctorIds")
    List<DoctorSpecialty> findByDoctorIdIn(@org.springframework.data.repository.query.Param("doctorIds") java.util.Collection<UUID> doctorIds);

    List<DoctorSpecialty> findBySpecialtyId(UUID specialtyId);

    Optional<DoctorSpecialty> findFirstByDoctorId(UUID doctorId);

    boolean existsByDoctorIdAndSpecialtyId(UUID doctorId, UUID specialtyId);
}
