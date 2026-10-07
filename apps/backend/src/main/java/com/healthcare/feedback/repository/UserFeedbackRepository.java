package com.healthcare.feedback.repository;

import com.healthcare.feedback.entity.UserFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, UUID> {

    List<UserFeedback> findTop20ByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndCreatedAtAfter(UUID userId, OffsetDateTime since);
}
