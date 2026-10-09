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

    java.util.List<PatientProfile> findByUserIdIn(java.util.Collection<UUID> userIds);

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
     * Atomically returns one AI credit. Mirrors
     * {@link #deductAiCreditByUserId(UUID)} so a refund that races another
     * refund or a spend on the same profile cannot lose an update; returns 0
     * only when the profile does not exist.
     */
    @Modifying
    @Query("update PatientProfile p set p.aiCredits = p.aiCredits + 1"
            + " where p.userId = :userId")
    int refundAiCreditByUserId(@Param("userId") UUID userId);

    /**
     * Scalar projection used to read the post-decrement balance for the
     * credit ledger; unlike an entity find it never serves a stale
     * persistence-context copy after the bulk update above.
     */
    @Query("select p.aiCredits from PatientProfile p where p.userId = :userId")
    Optional<Integer> findAiCreditsByUserId(@Param("userId") UUID userId);

    /**
     * Atomically refills the weekly AI credit allowance (V108). The balance is
     * set to the caller-supplied tier maximum and the ISO-week stamp is
     * advanced, but only when the stored stamp differs from {@code period}
     * (or is null — never refilled). The conditional bulk update serializes
     * concurrent refills of the same patient: exactly one caller sees 1, every
     * other caller (same-period race, retry, second instance) sees 0 because
     * the re-evaluated WHERE no longer matches, so a double grant would have
     * to bypass this method and hit the {@code ux_ai_credit_refill_patient_week}
     * unique index instead. Returns 0 also when the profile does not exist.
     */
    @Modifying
    @Query("update PatientProfile p set p.aiCredits = :tierMax, p.lastCreditRefillPeriod = :period"
            + " where p.userId = :userId"
            + " and (p.lastCreditRefillPeriod is null or p.lastCreditRefillPeriod <> :period)")
    int refillAiCreditsByUserId(@Param("userId") UUID userId,
                                @Param("tierMax") int tierMax,
                                @Param("period") String period);

    /**
     * Atomically tops the AI credit balance up to a promotional floor, at
     * most once per {@code period} marker. Unlike the weekly refill this
     * never lowers a balance: the WHERE excludes balances already at or
     * above the floor, so admin grants and higher tiers are preserved. The
     * stamp is written to the same {@code last_credit_refill_period} column —
     * a {@code promo-…} marker can never collide with an ISO-week stamp —
     * and the conditional update serializes concurrent top-ups exactly like
     * the weekly grant, with
     * {@code ux_ai_credit_refill_patient_week (user_id, refill_period)} as
     * the ledger backstop.
     */
    @Modifying
    @Query("update PatientProfile p set p.aiCredits = :floor, p.lastCreditRefillPeriod = :period"
            + " where p.userId = :userId and p.aiCredits < :floor"
            + " and (p.lastCreditRefillPeriod is null or p.lastCreditRefillPeriod <> :period)")
    int topUpAiCreditsToFloor(@Param("userId") UUID userId,
                              @Param("floor") int floor,
                              @Param("period") String period);

    /**
     * Scalar projection of the membership tier for the weekly refill. It is
     * deliberately a projection and not an entity find: the refill path must
     * not load the {@code PatientProfile} into the persistence context before
     * its own bulk update runs, or a later {@code findByUserId} in the same
     * prepare transaction — the chat credit gate — would serve the pre-refill
     * managed copy and deny a patient whose balance was just topped up.
     */
    @Query("select p.patientTier from PatientProfile p where p.userId = :userId")
    Optional<String> findPatientTierByUserId(@Param("userId") UUID userId);

    /**
     * Atomically applies an admin credit delta (grant or revocation). The
     * entity read-modify-write it replaces lost any atomic deduct/refill that
     * committed between the load and the save; the conditional bulk update
     * serializes against {@link #deductAiCreditByUserId} exactly like refunds
     * do. A negative delta is floored at zero — matching the previous
     * {@code Math.max(0, …)} clamp — and legacy null balances read as 0.
     * Returns 0 when the profile does not exist.
     */
    @Modifying
    @Query("update PatientProfile p set p.aiCredits = case"
            + " when coalesce(p.aiCredits, 0) + :delta < 0 then 0"
            + " else coalesce(p.aiCredits, 0) + :delta end"
            + " where p.userId = :userId")
    int applyAiCreditDeltaByUserId(@Param("userId") UUID userId, @Param("delta") int delta);

    /**
     * Atomically applies an admin tier change together with its absolute
     * credit assignment. Pairing the two columns in one bulk update removes
     * the same read-modify-write window as the credit delta variant; the
     * caller's absolute {@code credits} value is the intended end state, so
     * last-writer-wins is correct for an explicit admin set.
     */
    @Modifying
    @Query("update PatientProfile p set p.patientTier = :tier, p.aiCredits = :credits"
            + " where p.id = :id")
    int applyTierAndCreditsById(@Param("id") UUID id,
                                @Param("tier") String tier,
                                @Param("credits") int credits);
}
