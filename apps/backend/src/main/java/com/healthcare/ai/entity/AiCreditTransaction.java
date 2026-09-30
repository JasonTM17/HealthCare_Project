package com.healthcare.ai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_credit_transactions")
public class AiCreditTransaction {

    @Id
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "target_role", nullable = false, length = 24)
    private String targetRole; // PATIENT, DOCTOR

    @Column(name = "amount", nullable = false)
    private int amount;

    @Column(name = "balance_after", nullable = false)
    private int balanceAfter;

    @Column(name = "transaction_type", nullable = false, length = 48)
    private String transactionType; // ADMIN_GRANT, TIER_UPGRADE, AI_CHAT_USAGE, MONTHLY_REFILL

    @Column(name = "description", length = 500)
    private String description;

    /**
     * ISO-week stamp carried only by {@code AI_CHAT_REFILL} rows (V108). The
     * partial unique index {@code ux_ai_credit_refill_patient_week} over
     * {@code (user_id, refill_period)} is the database backstop that makes
     * the weekly refill once-per-patient-per-week even if a caller forgets
     * the conditional update. {@code null} for every other transaction type,
     * which keeps those rows outside the predicate.
     */
    @Column(name = "refill_period", length = 16)
    private String refillPeriod;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public AiCreditTransaction() {}

    public AiCreditTransaction(UUID userId, String targetRole, int amount, int balanceAfter, String transactionType, String description) {
        this.userId = userId;
        this.targetRole = targetRole;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.transactionType = transactionType;
        this.description = description;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(String targetRole) {
        this.targetRole = targetRole;
    }

    public int getAmount() {
        return amount;
    }

    public void setAmount(int amount) {
        this.amount = amount;
    }

    public int getBalanceAfter() {
        return balanceAfter;
    }

    public void setBalanceAfter(int balanceAfter) {
        this.balanceAfter = balanceAfter;
    }

    public String getTransactionType() {
        return transactionType;
    }

    public void setTransactionType(String transactionType) {
        this.transactionType = transactionType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getRefillPeriod() {
        return refillPeriod;
    }

    public void setRefillPeriod(String refillPeriod) {
        this.refillPeriod = refillPeriod;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
