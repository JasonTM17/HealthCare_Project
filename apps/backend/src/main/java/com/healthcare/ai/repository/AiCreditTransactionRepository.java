package com.healthcare.ai.repository;

import com.healthcare.ai.entity.AiCreditTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AiCreditTransactionRepository extends JpaRepository<AiCreditTransaction, UUID> {
    List<AiCreditTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Page<AiCreditTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
