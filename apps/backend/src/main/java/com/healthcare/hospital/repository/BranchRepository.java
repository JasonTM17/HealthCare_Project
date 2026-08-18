package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Branch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface BranchRepository extends JpaRepository<Branch, UUID> {
    Optional<Branch> findBySlug(String slug);

    Optional<Branch> findBySlugAndActiveTrue(String slug);

    Page<Branch> findByActiveTrue(Pageable pageable);
}
