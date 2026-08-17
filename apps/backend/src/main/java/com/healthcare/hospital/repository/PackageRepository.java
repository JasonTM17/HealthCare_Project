package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Package;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PackageRepository extends JpaRepository<Package, UUID> {
    Optional<Package> findBySlug(String slug);

    Page<Package> findByActiveTrue(Pageable pageable);
}
