package com.healthcare.notification.repository;

import com.healthcare.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUserIdAndReadFalse(UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from Notification n join fetch n.user " +
           "where n.emailQueuedAt is null and n.emailSuppressedAt is null " +
           "and n.emailAvailableAt <= :now order by n.createdAt asc")
    List<Notification> findEmailPendingForUpdate(@Param("now") OffsetDateTime now, Pageable pageable);

    @Modifying
    @Query("update Notification n set n.read = true, n.readAt = :readAt " +
           "where n.user.id = :userId and n.read = false")
    int markAllAsRead(@Param("userId") UUID userId, @Param("readAt") OffsetDateTime readAt);
}
