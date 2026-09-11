package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Package;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PackageRepository extends JpaRepository<Package, UUID> {
    @Query(value = "SELECT pg_advisory_xact_lock(721001)", nativeQuery = true)
    void lockCatalogOrder();

    @Query("select p from Package p order by p.displayOrder asc, p.id asc")
    java.util.List<Package> findAllInDisplayOrder();

    @Query("select coalesce(max(p.displayOrder), -1) from Package p")
    int findMaxDisplayOrder();

    Optional<Package> findBySlug(String slug);

    Optional<Package> findBySlugAndActiveTrue(String slug);

    Optional<Package> findByIdAndActiveTrue(UUID id);

    Page<Package> findByActiveTrue(Pageable pageable);
}
