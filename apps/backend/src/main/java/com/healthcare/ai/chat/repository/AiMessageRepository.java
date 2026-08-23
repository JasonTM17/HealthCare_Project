package com.healthcare.ai.chat.repository;

import com.healthcare.ai.chat.entity.AiMessage;
import com.healthcare.ai.chat.entity.AiMessageStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiMessageRepository extends JpaRepository<AiMessage, UUID> {

    Optional<AiMessage> findByConversationIdAndIdempotencyKey(UUID conversationId, String idempotencyKey);

    Optional<AiMessage> findByRequestMessageId(UUID requestMessageId);

    @Query("select coalesce(max(m.sequenceNumber), 0) from AiMessage m where m.conversation.id = :conversationId")
    long findMaxSequence(@Param("conversationId") UUID conversationId);

    @Query("""
        select m from AiMessage m
        where m.conversation.id = :conversationId
          and m.sequenceNumber < :beforeSequence
        order by m.sequenceNumber desc
        """)
    List<AiMessage> findHistory(
        @Param("conversationId") UUID conversationId,
        @Param("beforeSequence") long beforeSequence,
        Pageable pageable
    );

    List<AiMessage> findByConversationIdAndStatusOrderBySequenceNumberDesc(
        UUID conversationId,
        AiMessageStatus status,
        Pageable pageable
    );

    List<AiMessage> findByConversationIdAndStatus(UUID conversationId, AiMessageStatus status);
}
