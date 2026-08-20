package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Doctor;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, UUID> {
    Optional<Doctor> findBySlug(String slug);

    Optional<Doctor> findByUserId(UUID userId);

    Page<Doctor> findByActiveTrue(Pageable pageable);

    /**
     * Serializes the availability decision for a booking transition with a
     * concurrent admin activation/deactivation update.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Doctor d where d.id = :id and d.active = true")
    Optional<Doctor> findActiveByIdForUpdate(@Param("id") UUID id);

    @Query("""
        select d from Doctor d
        where d.active = true
          and (:specialtySlug = '' or exists (
              select ds.id from DoctorSpecialty ds
              join ds.specialty specialty
              where ds.doctor = d
                and specialty.slug = :specialtySlug
                and specialty.active = true
          ))
          and (:branchSlug = '' or exists (
              select db.id from DoctorBranch db
              join db.branch branch
              where db.doctor = d
                and branch.slug = :branchSlug
                and branch.active = true
          ))
          and (:query = '' or lower(d.fullName) like lower(concat('%', :query, '%')))
        """)
    Page<Doctor> findActiveWithFilters(
        @Param("specialtySlug") String specialtySlug,
        @Param("branchSlug") String branchSlug,
        @Param("query") String query,
        Pageable pageable
    );

    Optional<Doctor> findBySlugAndActiveTrue(String slug);
}
