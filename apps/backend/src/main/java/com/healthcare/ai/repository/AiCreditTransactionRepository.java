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
}
