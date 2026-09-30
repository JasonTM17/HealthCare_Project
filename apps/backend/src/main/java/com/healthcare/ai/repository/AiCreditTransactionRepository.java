package com.healthcare.ai.repository;

import com.healthcare.ai.entity.AiCreditTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AiCreditTransactionRepository extends JpaRepository<AiCreditTransaction, UUID> {
    List<AiCreditTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Page<AiCreditTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUserId(UUID userId);

    /** Highest balance the user ever reached; drives the status screen's maxCredits. */
    @Query("select coalesce(max(t.balanceAfter), 0) from AiCreditTransaction t where t.userId = :userId")
    int findMaxBalanceAfterByUserId(@Param("userId") UUID userId);

    /**
     * Whether a chat usage charge for one exchange attempt exists in the
     * ledger. The attempt marker travels inside the free-text description
     * ({@code [chat:<requestMessageId>]}), which keeps the per-attempt
     * attribution without a schema change on the ledger table.
     */
    @Query("select count(t) > 0 from AiCreditTransaction t"
        + " where t.userId = :userId and t.transactionType = 'AI_CHAT_USAGE'"
        + " and t.description like concat('%', :marker, '%')")
    boolean existsPatientAiChatUsage(@Param("userId") UUID userId, @Param("marker") String marker);

    /**
     * Whether a refund was already recorded for one exchange attempt; this is
     * the idempotency gate that lets the stale-lease sweep and the live
     * failure path share the same recovery without double-refunding.
     */
    @Query("select count(t) > 0 from AiCreditTransaction t"
        + " where t.userId = :userId and t.transactionType = 'AI_CHAT_REFUND'"
        + " and t.description like concat('%', :marker, '%')")
    boolean existsPatientRefund(@Param("userId") UUID userId, @Param("marker") String marker);

    /**
     * Whether this patient's weekly refill row already exists for one ISO
     * period. The refill pre-check uses it so the inconsistent-history state
     * (the grant row present while the profile stamp lags) short-circuits
     * before the conditional balance update, instead of letting the ledger
     * insert die on {@code ux_ai_credit_refill_patient_week} and poison the
     * surrounding transaction. Scoped to {@code AI_CHAT_REFILL} so a
     * {@code TIER_UPGRADE} row sharing the stamp cannot mask a real grant —
     * exactly the predicate the V108 partial index uses.
     */
    @Query("select count(t) > 0 from AiCreditTransaction t"
        + " where t.userId = :userId and t.transactionType = 'AI_CHAT_REFILL'"
        + " and t.refillPeriod = :period")
    boolean existsPatientRefillInPeriod(@Param("userId") UUID userId, @Param("period") String period);
}
