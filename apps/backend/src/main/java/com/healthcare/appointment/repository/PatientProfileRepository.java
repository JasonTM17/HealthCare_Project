package com.healthcare.appointment.repository;

import com.healthcare.appointment.entity.PatientProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientProfileRepository extends JpaRepository<PatientProfile, UUID> {
    Optional<PatientProfile> findByPhone(String phone);

    Optional<PatientProfile> findByUserId(UUID userId);

    /**
     * Atomically consumes one AI credit. The conditional bulk update
     * serializes concurrent chat sends: it returns 1 when the balance was
     * decremented, and 0 when the profile is missing or has no credits left,
     * so a concurrent send can never lose the other's deduction.
     */
    @Modifying
    @Query("update PatientProfile p set p.aiCredits = p.aiCredits - 1"
            + " where p.userId = :userId and p.aiCredits > 0")
    int deductAiCreditByUserId(@Param("userId") UUID userId);

    /**
     * Scalar projection used to read the post-decrement balance for the
     * credit ledger; unlike an entity find it never serves a stale
     * persistence-context copy after the bulk update above.
     */
    @Query("select p.aiCredits from PatientProfile p where p.userId = :userId")
    Optional<Integer> findAiCreditsByUserId(@Param("userId") UUID userId);
}
