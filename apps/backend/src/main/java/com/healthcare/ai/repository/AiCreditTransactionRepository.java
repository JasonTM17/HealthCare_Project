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
}
