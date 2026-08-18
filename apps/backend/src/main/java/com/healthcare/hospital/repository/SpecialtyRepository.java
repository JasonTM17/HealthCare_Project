package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Specialty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository
public interface SpecialtyRepository extends JpaRepository<Specialty, UUID> {
    Optional<Specialty> findBySlug(String slug);

    Optional<Specialty> findBySlugAndActiveTrue(String slug);

    Page<Specialty> findByActiveTrue(Pageable pageable);

    List<Specialty> findByActiveTrue();
}
