package com.healthcare.ai.chat.repository;

import com.healthcare.ai.chat.entity.AiConversation;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiConversationRepository extends JpaRepository<AiConversation, UUID> {

    Optional<AiConversation> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AiConversation c where c.id = :id and c.user.id = :userId")
    Optional<AiConversation> findOwnedForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

    List<AiConversation> findTop50ByUserIdAndExpiresAtAfterOrderByUpdatedAtDesc(
        UUID userId,
        OffsetDateTime now
    );

    List<AiConversation> findByExpiresAtBeforeOrderByExpiresAtAsc(OffsetDateTime now, Pageable pageable);

    /**
     * Conversations whose in-flight lease has expired while still marked
     * in-flight — the crash window between the committed credit charge and
     * the persisted exchange. Locked so the repair sweep serializes against
     * the live prepare/markFailed paths.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select c from AiConversation c
        where c.inFlight = true
          and c.inFlightStartedAt is not null
          and c.inFlightStartedAt < :cutoff
        """)
    List<AiConversation> findStaleInFlightForUpdate(@Param("cutoff") OffsetDateTime cutoff, Pageable pageable);
}
