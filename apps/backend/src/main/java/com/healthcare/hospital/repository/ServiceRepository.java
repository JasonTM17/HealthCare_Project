package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.MedicalService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ServiceRepository extends JpaRepository<MedicalService, UUID> {
    Optional<MedicalService> findBySlug(String slug);

    Optional<MedicalService> findBySlugAndActiveTrue(String slug);

    Page<MedicalService> findByActiveTrue(Pageable pageable);
}
