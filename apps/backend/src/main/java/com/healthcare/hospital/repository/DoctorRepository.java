package com.healthcare.hospital.repository;

import com.healthcare.hospital.entity.Doctor;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Doctor d where d.id = :id")
    Optional<Doctor> findByIdForUpdate(@Param("id") UUID id);

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

    /**
     * Atomically consumes one AI credit. The conditional bulk update
     * serializes concurrent sends: it returns 1 when the balance was
     * decremented, and 0 when the doctor record is missing or has no credits
     * left, so a concurrent send can never lose the other's deduction.
     */
    @Modifying
    @Query("update Doctor d set d.aiCredits = d.aiCredits - 1"
            + " where d.userId = :userId and d.aiCredits > 0")
    int deductAiCreditByUserId(@Param("userId") UUID userId);

    /**
     * Scalar projection used to read the post-decrement balance for the
     * credit ledger; unlike an entity find it never serves a stale
     * persistence-context copy after the bulk update above.
     */
    @Query("select d.aiCredits from Doctor d where d.userId = :userId")
    Optional<Integer> findAiCreditsByUserId(@Param("userId") UUID userId);
}
