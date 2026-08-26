package com.healthcare.auth.mail;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface EmailOutboxRepository extends JpaRepository<EmailOutboxEntry, UUID> {

    Optional<EmailOutboxEntry> findByIdempotencyKey(String idempotencyKey);

    /**
     * Inserts one encrypted envelope atomically. The database conflict target
     * is the idempotency authority; a read-then-save sequence is not safe when
     * two transactions enqueue the same logical email concurrently.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        INSERT INTO email_outbox (
            id, user_id, event_reference_id, event_type, template_key,
            template_version, idempotency_key, payload_ciphertext,
            payload_nonce, payload_digest, delivery_message_id, status, attempts, available_at, expires_at,
            created_at, updated_at
        ) VALUES (
            :id, :userId, :eventReferenceId, :eventType, :templateKey,
            :templateVersion, :idempotencyKey, :payloadCiphertext,
            :payloadNonce, :payloadDigest, :deliveryMessageId, 'QUEUED', 0, :availableAt, :expiresAt,
            :createdAt, :updatedAt
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        """, nativeQuery = true)
    int insertQueuedIfAbsent(@Param("id") UUID id,
                             @Param("userId") UUID userId,
                             @Param("eventReferenceId") UUID eventReferenceId,
                             @Param("eventType") String eventType,
                             @Param("templateKey") String templateKey,
                             @Param("templateVersion") int templateVersion,
                             @Param("idempotencyKey") String idempotencyKey,
                             @Param("payloadCiphertext") byte[] payloadCiphertext,
                             @Param("payloadNonce") byte[] payloadNonce,
                             @Param("payloadDigest") String payloadDigest,
                             @Param("deliveryMessageId") String deliveryMessageId,
                             @Param("availableAt") OffsetDateTime availableAt,
                             @Param("expiresAt") OffsetDateTime expiresAt,
                             @Param("createdAt") OffsetDateTime createdAt,
                             @Param("updatedAt") OffsetDateTime updatedAt);

    @Query("select e from EmailOutboxEntry e where e.id = :id and e.leaseToken = :leaseToken")
    Optional<EmailOutboxEntry> findByIdAndLeaseToken(@Param("id") UUID id,
                                                     @Param("leaseToken") UUID leaseToken);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EmailOutboxEntry e where e.status in :statuses "
        + "and e.availableAt <= :now and e.expiresAt > :now "
        + "and (e.leaseExpiresAt is null or e.leaseExpiresAt <= :now) "
        + "order by e.createdAt asc")
    List<EmailOutboxEntry> findDueForUpdate(@Param("statuses") java.util.Collection<EmailOutboxStatus> statuses,
                                            @Param("now") OffsetDateTime now,
                                            org.springframework.data.domain.Pageable pageable);

    /**
     * Claims the oldest due row using database time and PostgreSQL's
     * SKIP LOCKED so parallel workers do not wait on one another.
     */
    @Query(value = """
        SELECT * FROM email_outbox
        WHERE status IN (:statuses)
          AND available_at <= CURRENT_TIMESTAMP
          AND expires_at > CURRENT_TIMESTAMP
          AND (lease_expires_at IS NULL OR lease_expires_at <= CURRENT_TIMESTAMP)
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
        """, nativeQuery = true)
    List<EmailOutboxEntry> findDueForUpdateSkipLocked(@Param("statuses") java.util.Collection<String> statuses);

    @Query(value = "SELECT CURRENT_TIMESTAMP", nativeQuery = true)
    /** Native PostgreSQL CURRENT_TIMESTAMP is materialized by Hibernate as an Instant. */
    Instant databaseNow();

    /**
     * Re-check the database-owned expiry/lease boundary immediately before
     * handing a message to SMTP. The claim may have been valid when it was
     * selected but expire while the payload is decrypted/rendered.
     */
    @Query(value = """
        SELECT EXISTS (
            SELECT 1 FROM email_outbox
            WHERE id = :id
              AND lease_token = :leaseToken
              AND status = 'PROCESSING'
              AND expires_at > CURRENT_TIMESTAMP
              AND lease_expires_at > CURRENT_TIMESTAMP
        )
        """, nativeQuery = true)
    boolean isLeaseActive(@Param("id") UUID id, @Param("leaseToken") UUID leaseToken);

    /**
     * Terminal transitions are fenced by both the lease token and database
     * time. A slow SMTP call therefore cannot turn an expired OTP into SENT.
     */
    @Modifying
    @Query(value = """
        UPDATE email_outbox
        SET status = 'SENT', sent_at = CURRENT_TIMESTAMP,
            payload_ciphertext = NULL, payload_nonce = NULL,
            lease_token = NULL, lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
          AND lease_token = :leaseToken
          AND status = 'PROCESSING'
          AND expires_at > CURRENT_TIMESTAMP
          AND lease_expires_at > CURRENT_TIMESTAMP
        """, nativeQuery = true)
    int markSentIfLeaseActive(@Param("id") UUID id, @Param("leaseToken") UUID leaseToken);

    @Modifying
    @Query(value = """
        UPDATE email_outbox
        SET status = 'EXPIRED', payload_ciphertext = NULL, payload_nonce = NULL,
            lease_token = NULL, lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
          AND lease_token = :leaseToken
          AND status = 'PROCESSING'
          AND (expires_at <= CURRENT_TIMESTAMP OR lease_expires_at <= CURRENT_TIMESTAMP)
        """, nativeQuery = true)
    int markExpiredIfLeaseActive(@Param("id") UUID id, @Param("leaseToken") UUID leaseToken);

    @Modifying
    @Query(value = """
        UPDATE email_outbox
        SET status = 'RETRY', last_error_code = 'DELIVERY_UNAVAILABLE',
            available_at = CURRENT_TIMESTAMP + (:backoffSeconds * INTERVAL '1 second'),
            lease_token = NULL, lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
          AND lease_token = :leaseToken
          AND status = 'PROCESSING'
          AND expires_at > CURRENT_TIMESTAMP
          AND lease_expires_at > CURRENT_TIMESTAMP
        """, nativeQuery = true)
    int markRetryIfLeaseActive(@Param("id") UUID id,
                               @Param("leaseToken") UUID leaseToken,
                               @Param("backoffSeconds") long backoffSeconds);

    @Modifying
    @Query(value = """
        UPDATE email_outbox
        SET status = 'DEAD', last_error_code = :errorCode,
            payload_ciphertext = NULL, payload_nonce = NULL,
            lease_token = NULL, lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
          AND lease_token = :leaseToken
          AND status = 'PROCESSING'
          AND expires_at > CURRENT_TIMESTAMP
          AND lease_expires_at > CURRENT_TIMESTAMP
        """, nativeQuery = true)
    int markDeadIfLeaseActive(@Param("id") UUID id,
                              @Param("leaseToken") UUID leaseToken,
                              @Param("errorCode") String errorCode);

    @Modifying
    @Query(value = """
        UPDATE email_outbox
        SET status = 'EXPIRED', payload_ciphertext = NULL, payload_nonce = NULL,
            lease_token = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE status IN (:statuses) AND expires_at <= CURRENT_TIMESTAMP
        """, nativeQuery = true)
    int expireDueAtDatabaseTime(@Param("statuses") java.util.Collection<String> statuses);

    @Modifying
    @Query(value = """
        DELETE FROM email_outbox
        WHERE status IN ('SENT', 'EXPIRED', 'DEAD')
          AND updated_at < CURRENT_TIMESTAMP - make_interval(days => :retentionDays)
        """, nativeQuery = true)
    int deleteTerminalBeforeDatabaseTime(@Param("retentionDays") int retentionDays);

    @Modifying
    @Query("update EmailOutboxEntry e set e.status = com.healthcare.auth.mail.EmailOutboxStatus.EXPIRED, "
        + "e.payloadCiphertext = null, e.payloadNonce = null, e.leaseToken = null, "
        + "e.leaseExpiresAt = null, e.updatedAt = :now "
        + "where e.status in :statuses and e.expiresAt <= :now")
    int expireDue(@Param("statuses") java.util.Collection<EmailOutboxStatus> statuses,
                  @Param("now") OffsetDateTime now);

    @Modifying
    @Query("update EmailOutboxEntry e set e.status = :status, e.leaseToken = null, "
        + "e.leaseExpiresAt = null, e.updatedAt = :now "
        + "where e.id = :id and e.leaseToken = :leaseToken")
    int releaseLease(@Param("id") UUID id, @Param("leaseToken") UUID leaseToken,
                     @Param("status") EmailOutboxStatus status, @Param("now") OffsetDateTime now);
}
